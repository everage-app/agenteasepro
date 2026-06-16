import { Router } from 'express';
import { SignatureType, Prisma, TaskPriority } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { verifyESignToken } from '../lib/esignToken';
import { isFieldAssignedToSigner, resolveSnapshotWithEnvelopeFields } from '../lib/esignFieldPlan';
import { addSigningGuidesToPdf, generateSignedContractPdf, fillRepcPdf } from '../services/pdfService';
import {
  completeESignFollowUpTasks,
  logESignDealEvent,
  upsertESignFollowUpTask,
} from '../services/esignAutomationService';
import path from 'path';
import fs from 'fs';

export const router = Router();

const getSignerGuidePayload = (signer: { role: string; name: string; signedAt?: Date | null; signatureData?: Prisma.JsonValue | null }) => {
  const signaturePayload = (signer.signatureData && typeof signer.signatureData === 'object')
    ? signer.signatureData as Record<string, unknown>
    : {};

  return {
    role: signer.role,
    name: signer.name,
    signedAt: signer.signedAt?.toISOString(),
    initials: typeof signaturePayload.initials === 'string' ? signaturePayload.initials : undefined,
    completedFields: Array.isArray(signaturePayload.completedFields)
      ? signaturePayload.completedFields as Array<{ id?: string; type?: string; value?: unknown }>
      : undefined,
  };
};

const getEnvelopeDocumentBuffer = (value: unknown) => {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
};

const safePdfFilename = (value: string) => {
  const cleaned = (value || 'document').replace(/[^a-zA-Z0-9.-]/g, '_');
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
};

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

  const resolvedSnapshot = resolveSnapshotWithEnvelopeFields({
    envelopeType: envelope.type,
    signers: envelope.signers,
    snapshot: envelope.contractSnapshot as Record<string, unknown>,
  });

  const signerViewedAt = (signer as any).viewedAt as Date | string | null | undefined;
  const viewedAt = signerViewedAt ? new Date(signerViewedAt) : new Date();
  if (!signerViewedAt) {
    await prisma.$executeRaw(Prisma.sql`UPDATE "Signer" SET "viewedAt" = ${viewedAt} WHERE id = ${signer.id} AND "viewedAt" IS NULL`);
  }

  return res.json({
    envelopeId: envelope.id,
    envelopeType: envelope.type,
    envelopeCompletedAt: (envelope as any).completedAt ?? null,
    packetTitle: envelope.documentName || envelope.deal?.property?.street || envelope.id,
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      role: signer.role,
      viewedAt,
      signedAt: signer.signedAt,
    },
    signers: envelope.signers.map((participant) => ({
      id: participant.id,
      name: participant.name,
      role: participant.role,
      signedAt: participant.signedAt,
    })),
    contractSnapshot: resolvedSnapshot,
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
    const documentBuffer = envelope.type === 'DOCUMENT'
      ? getEnvelopeDocumentBuffer(envelope.documentData)
      : null;

    if (documentBuffer) {
      pdfBuffer = documentBuffer;
    } else if (envelope.type === 'REPC') {
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
      signers: envelope.signers.map(getSignerGuidePayload),
      currentSignerRole: signer.role,
      currentSignerName: signer.name,
      formCode: envelope.type,
      fields: Array.isArray(contractSnapshot?.__esignFieldPlacements) ? contractSnapshot.__esignFieldPlacements : undefined,
      propertyAddress: envelope.documentName || [contractData.street, contractData.city, contractData.state, contractData.zip]
        .filter(Boolean)
        .join(', '),
      mlsId: contractData.mlsId,
      purchasePrice: contractData.purchasePrice,
      buyerNames: contractData.buyerNames,
      sellerNames: contractData.sellerNames,
    });

    const filename = envelope.type === 'DOCUMENT'
      ? safePdfFilename(`${envelope.documentName || envelope.id}-packet`)
      : `${envelope.type}-${deal?.property?.street || envelope.id}-packet.pdf`
        .replace(/[^a-zA-Z0-9.-]/g, '_');

    const responseBuffer = Buffer.isBuffer(guidedPdf) ? guidedPdf : Buffer.from(guidedPdf);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(responseBuffer.length));
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
    return res.end(responseBuffer);
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
    include: {
      signers: true,
      deal: {
        select: {
          id: true,
          agentId: true,
          title: true,
          property: {
            select: {
              street: true,
            },
          },
        },
      },
    },
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

  const resolvedSnapshot = resolveSnapshotWithEnvelopeFields({
    envelopeType: envelope.type,
    signers: envelope.signers,
    snapshot: (envelope.contractSnapshot as Record<string, unknown>) || {},
  });
  const placementRaw = Array.isArray((resolvedSnapshot as any).__esignFieldPlacements)
    ? ((resolvedSnapshot as any).__esignFieldPlacements as Array<{
        id?: string;
        type?: string;
        required?: boolean;
        assignedTo?: string;
      }>)
    : [];

  const assignedRequired = placementRaw.filter((field) => {
    if (!field?.id || !field?.type) return false;
    if (field.required === false) return false;
    return isFieldAssignedToSigner({
      field,
      signerRole: existingSigner.role,
      signerCount: envelope.signers.length,
    });
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
    await prisma.$executeRaw(Prisma.sql`UPDATE "SignatureEnvelope" SET "completedAt" = COALESCE("completedAt", ${timestamp}) WHERE id = ${envelopeId}`);
    envelopeCompletedAt = timestamp;
  }

  const dealAgentId = envelope.deal?.agentId;
  const dealId = envelope.deal?.id;
  const propertyLabel = envelope.documentName || envelope.deal?.property?.street || envelope.deal?.title || 'Document packet';

  if (dealAgentId && dealId) {
    if (unsignedCount === 0) {
      await logESignDealEvent({
        agentId: dealAgentId,
        dealId,
        title: 'E-sign packet fully signed',
        description: `${signer.name} completed the final signature for ${propertyLabel}.`,
        date: timestamp,
      });

      await completeESignFollowUpTasks({
        agentId: dealAgentId,
        dealId,
        envelopeId,
        completionNote: `Completed by ${signer.name} on ${timestamp.toISOString()}.`,
      });
    } else {
      await logESignDealEvent({
        agentId: dealAgentId,
        dealId,
        title: 'Signer completed e-sign step',
        description: `${signer.name} (${existingSigner.role}) signed. ${unsignedCount} signer(s) still pending.`,
        date: timestamp,
      });

      await upsertESignFollowUpTask({
        agentId: dealAgentId,
        dealId,
        envelopeId,
        propertyLabel,
        dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        note: `${signer.name} signed. ${unsignedCount} signer(s) are still pending.`,
        priority: TaskPriority.HIGH,
      });
    }
  }

  res.json({ signer, auditHash: hash, envelopeCompletedAt });
});

export default router;
