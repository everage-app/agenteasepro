import { Router } from 'express';
import { SignatureType, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { verifyESignToken } from '../lib/esignToken';
import { addSigningGuidesToPdf, generateSignedContractPdf, fillRepcPdf } from '../services/pdfService';
import path from 'path';
import fs from 'fs';

export const router = Router();

router.get('/envelopes/:envelopeId/:signerId/:token', async (req, res) => {
  const { envelopeId, signerId, token } = req.params;

  const tokenResult = verifyESignToken(token, envelopeId, signerId);
  if (!tokenResult.valid) {
    return res.status(401).json({
      error: tokenResult.reason === 'expired' ? 'Signing link has expired' : 'Invalid token',
    });
  }

  const envelope = await prisma.signatureEnvelope.findUnique({
    where: { id: envelopeId },
    include: {
      signers: true,
      deal: {
        include: {
          property: true,
        },
      },
    },
  });
  if (!envelope) return res.status(404).json({ error: 'Envelope not found' });

  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return res.status(404).json({ error: 'Signer not found' });

  const signerViewedAt = (signer as any).viewedAt as Date | string | null | undefined;
  const viewedAt = signerViewedAt ? new Date(signerViewedAt) : new Date();
  if (!signerViewedAt) {
    await prisma.$executeRawUnsafe(
      'UPDATE "Signer" SET "viewedAt" = $1 WHERE id = $2 AND "viewedAt" IS NULL',
      viewedAt,
      signer.id,
    );
  }

  return res.json({
    envelopeId: envelope.id,
    envelopeType: envelope.type,
    envelopeCompletedAt: (envelope as any).completedAt ?? null,
    packetTitle: envelope.deal?.property?.street || envelope.id,
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      role: signer.role,
      viewedAt,
      signedAt: signer.signedAt,
    },
    contractSnapshot: envelope.contractSnapshot,
  });
});

router.get('/envelopes/:envelopeId/:signerId/:token/pdf', async (req, res) => {
  const { envelopeId, signerId, token } = req.params;
  const download = req.query.download === '1' || req.query.download === 'true';

  const tokenResult = verifyESignToken(token, envelopeId, signerId);
  if (!tokenResult.valid) {
    return res.status(401).json({
      error: tokenResult.reason === 'expired' ? 'Signing link has expired' : 'Invalid token',
    });
  }

  const envelope = await prisma.signatureEnvelope.findUnique({
    where: { id: envelopeId },
    include: {
      signers: true,
      deal: {
        include: {
          property: true,
          buyer: true,
          seller: true,
          repc: true,
        },
      },
    },
  });
  if (!envelope) return res.status(404).json({ error: 'Envelope not found' });

  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return res.status(404).json({ error: 'Signer not found' });

  const contractSnapshot = envelope.contractSnapshot as any;
  const deal = envelope.deal;

  const contractData = {
    street: deal?.property?.street || contractSnapshot?.street,
    city: deal?.property?.city || contractSnapshot?.city,
    state: deal?.property?.state || contractSnapshot?.state,
    zip: deal?.property?.zip || contractSnapshot?.zip,
    county: deal?.property?.county || contractSnapshot?.county,
    mlsId: deal?.property?.mlsId || contractSnapshot?.mlsId,
    taxId: deal?.property?.taxId || contractSnapshot?.propertyTaxId,
    buyerNames: deal?.buyer
      ? `${deal.buyer.firstName} ${deal.buyer.lastName}`.trim()
      : contractSnapshot?.buyerNames,
    buyerEmail: deal?.buyer?.email || contractSnapshot?.buyerEmail,
    sellerNames: deal?.seller
      ? `${deal.seller.firstName} ${deal.seller.lastName}`.trim()
      : contractSnapshot?.sellerNames,
    sellerEmail: deal?.seller?.email || contractSnapshot?.sellerEmail,
    purchasePrice: contractSnapshot?.purchasePrice,
    earnestMoney: contractSnapshot?.earnestMoney,
    dueDiligenceDeadline: contractSnapshot?.dueDiligenceDeadline,
    financingAppraisalDeadline: contractSnapshot?.financingAppraisalDeadline,
    settlementDeadline: contractSnapshot?.settlementDeadline,
    buyerSignature: envelope.signers.find((s) => s.role === 'BUYER')?.name,
    buyerSignedDate: envelope.signers.find((s) => s.role === 'BUYER')?.signedAt?.toISOString(),
    sellerSignature: envelope.signers.find((s) => s.role === 'SELLER')?.name,
    sellerSignedDate: envelope.signers.find((s) => s.role === 'SELLER')?.signedAt?.toISOString(),
  };

  const signersSummary = envelope.signers.map((s) => ({
    name: s.name,
    role: s.role,
    signedAt: s.signedAt?.toISOString(),
  }));

  try {
    let pdfBuffer: Buffer;

    if (envelope.type === 'REPC') {
      const def = await prisma.formDefinition.findUnique({ where: { code: 'REPC' } });
      if (def) {
        const repoRoot = path.resolve(__dirname, '..', '..', '..');
        const templatePath = path.resolve(repoRoot, def.officialPdfPath);

        if (fs.existsSync(templatePath)) {
          pdfBuffer = await fillRepcPdf(templatePath, contractData);
        } else {
          pdfBuffer = await generateSignedContractPdf(contractData, signersSummary);
        }
      } else {
        pdfBuffer = await generateSignedContractPdf(contractData, signersSummary);
      }
    } else {
      pdfBuffer = await generateSignedContractPdf(contractData, signersSummary);
    }

    const guidedPdf = await addSigningGuidesToPdf(pdfBuffer, {
      signers: envelope.signers.map((s) => {
        const payload = (s.signatureData as any) || {};
        return {
          role: s.role,
          name: s.name,
          signedAt: s.signedAt?.toISOString(),
          initials: typeof payload.initials === 'string' ? payload.initials : undefined,
        };
      }),
      currentSignerRole: signer.role,
      currentSignerName: signer.name,
      formCode: envelope.type,
      propertyAddress: [contractData.street, contractData.city, contractData.state, contractData.zip]
        .filter(Boolean)
        .join(', '),
      mlsId: contractData.mlsId,
      purchasePrice: contractData.purchasePrice,
      buyerNames: contractData.buyerNames,
      sellerNames: contractData.sellerNames,
    });

    const filename = `${envelope.type}-${deal?.property?.street || envelope.id}-packet.pdf`
      .replace(/[^a-zA-Z0-9.-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
    return res.send(guidedPdf);
  } catch (error) {
    console.error('Error generating public signing PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

router.post('/sign/:envelopeId/:signerId/:token', async (req, res) => {
  const { envelopeId, signerId, token } = req.params;

  const tokenResult = verifyESignToken(token, envelopeId, signerId);
  if (!tokenResult.valid) {
    return res.status(401).json({
      error: tokenResult.reason === 'expired' ? 'Signing link has expired' : 'Invalid token',
    });
  }

  const { name, signatureType, signatureData } = (req.body || {}) as {
    name?: string;
    signatureType?: SignatureType;
    signatureData?: unknown;
  };
  const acceptedEsignRules = (req.body as any)?.acceptedEsignRules === true;
  const completedFields = Array.isArray((req.body as any)?.completedFields)
    ? ((req.body as any).completedFields as Array<{ id?: string; type?: string; value?: unknown }>)
    : [];

  if (!name || !signatureType) {
    return res.status(400).json({ error: 'Missing required signature fields' });
  }

  const envelope = await prisma.signatureEnvelope.findUnique({
    where: { id: envelopeId },
  });
  if (!envelope) return res.status(404).json({ error: 'Envelope not found' });

  const existingSigner = await prisma.signer.findUnique({ where: { id: signerId } });
  if (!existingSigner) return res.status(404).json({ error: 'Signer not found' });

  if (existingSigner.signedAt) {
    return res.status(409).json({
      error: 'Already signed',
      signer: {
        id: existingSigner.id,
        name: existingSigner.name,
        email: existingSigner.email,
        role: existingSigner.role,
        signedAt: existingSigner.signedAt,
      },
    });
  }

  const snapshot = (envelope.contractSnapshot as Record<string, unknown>) || {};
  const placementRaw = Array.isArray((snapshot as any).__esignFieldPlacements)
    ? ((snapshot as any).__esignFieldPlacements as Array<{
        id?: string;
        type?: string;
        required?: boolean;
        assignedTo?: string;
      }>)
    : [];

  const assignedRequired = placementRaw.filter((field) => {
    if (!field?.id || !field?.type) return false;
    if (field.required === false) return false;
    if (!field.assignedTo) return true;
    return field.assignedTo === existingSigner.role;
  });

  const completedMap = new Map<string, string>();
  completedFields.forEach((field) => {
    if (!field?.id) return;
    completedMap.set(field.id, typeof field.value === 'string' ? field.value : String(field.value ?? ''));
  });

  const signaturePayload = (signatureData as Record<string, unknown>) || {};
  const rulesInPayload = signaturePayload.rulesAcknowledged === true;
  if (!acceptedEsignRules && !rulesInPayload) {
    return res.status(400).json({
      error: 'Please acknowledge e-sign rules before signing.',
    });
  }
  const payloadInitials = typeof signaturePayload.initials === 'string' ? signaturePayload.initials.trim() : '';
  const missingRequired = assignedRequired.filter((field) => {
    if (field.type === 'signature') return !name.trim();
    if (field.type === 'initials') {
      const local = completedMap.get(field.id as string)?.trim() || '';
      return !(local || payloadInitials);
    }
    if (field.type === 'checkbox') {
      const local = (completedMap.get(field.id as string) || '').toLowerCase();
      return local !== 'checked' && local !== 'true';
    }
    return !(completedMap.get(field.id as string)?.trim());
  });

  if (missingRequired.length > 0) {
    return res.status(400).json({
      error: 'Please complete all required assigned fields before signing.',
      missingFieldIds: missingRequired.map((field) => field.id),
    });
  }

  const ipAddress =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const timestamp = new Date();

  const hash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        envelopeId,
        signerId,
        contractSnapshot: envelope.contractSnapshot,
        timestamp,
      }),
    )
    .digest('hex');

  const signer = await prisma.signer.update({
    where: { id: signerId },
    data: {
      name,
      signatureType,
      signatureData: {
        ...((signatureData as Record<string, unknown>) || {}),
        completedFields,
      } as Prisma.JsonValue,
      signedAt: timestamp,
      ipAddress,
      userAgent,
      auditHash: hash,
    },
  });

  const unsignedCount = await prisma.signer.count({
    where: {
      envelopeId,
      signedAt: null,
    },
  });

  let envelopeCompletedAt: Date | null = null;
  if (unsignedCount === 0) {
    await prisma.$executeRawUnsafe(
      'UPDATE "SignatureEnvelope" SET "completedAt" = COALESCE("completedAt", $1) WHERE id = $2',
      timestamp,
      envelopeId,
    );
    envelopeCompletedAt = timestamp;
  }

  res.json({ signer, auditHash: hash, envelopeCompletedAt });
});

export default router;
