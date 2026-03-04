import { Router } from 'express';
import { SignatureEnvelopeType, SignerRole, Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { sendSigningRequestEmail } from '../services/emailService';
import { generateSignedContractPdf, fillRepcPdf } from '../services/pdfService';
import { createESignToken } from '../lib/esignToken';
import path from 'path';
import fs from 'fs';
export const router = Router();

const getAppBaseUrl = () =>
  process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || 'http://localhost:5174';

const buildSigningLink = (envelopeId: string, signerId: string) => {
  const token = createESignToken(envelopeId, signerId);
  return `${getAppBaseUrl()}/esign/${envelopeId}/${signerId}/${token}`;
};

async function sendEnvelopeEmails(params: {
  envelopeId: string;
  signers: Array<{ id: string; name: string; email: string }>;
  subject: string;
  message: string;
  propertyLabel: string;
  agentName?: string;
  agentEmail?: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    brokerageName?: string;
    emailSignature?: string;
  };
}) {
  const emailResults = await Promise.all(
    params.signers.map(async (signer) => {
      if (!signer.email) {
        return { signerId: signer.id, success: false, error: 'No email address' };
      }

      const result = await sendSigningRequestEmail({
        signerName: signer.name,
        signerEmail: signer.email,
        property: params.propertyLabel,
        subject: params.subject,
        message: params.message,
        signingLink: buildSigningLink(params.envelopeId, signer.id),
        agentName: params.agentName,
        agentEmail: params.agentEmail,
        branding: params.branding,
      });

      return { signerId: signer.id, email: signer.email, ...result };
    }),
  );

  const emailsSent = emailResults.filter((r) => r.success).length;
  const emailsFailed = emailResults.filter((r) => !r.success).length;

  return {
    sent: emailsSent,
    failed: emailsFailed,
    results: emailResults,
  };
}

router.get('/envelopes', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const envelopes = await prisma.signatureEnvelope.findMany({
    where: { deal: { agentId: req.agentId } },
    include: {
      signers: true,
      deal: { include: { property: true, buyer: true, seller: true, repc: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(envelopes);
});

router.post('/envelopes', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId, type, signers, fields } = req.body as {
    dealId: string;
    type: SignatureEnvelopeType;
    signers: { role: SignerRole; name: string; email: string }[];
    fields?: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      page: number;
      value?: string;
      placeholder?: string;
      assignedTo?: string;
      required?: boolean;
    }>;
  };

  const subject = req.body?.subject as string | undefined;
  const message = req.body?.message as string | undefined;

  // Get agent info for email reply-to and from name
  const [agent, profileSettings] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: req.agentId },
      select: { name: true, email: true, brokerageName: true },
    }),
    prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: {
        logoUrl: true,
        brokerageLogoUrl: true,
        brandColor: true,
        accentColor: true,
        emailFooter: true,
        brokerageName: true,
      },
    }),
  ]);

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { repc: true, addendums: true, property: true },
  });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const contractSnapshot =
    type === 'REPC' ? deal.repc : deal.addendums[deal.addendums.length - 1];
  if (!contractSnapshot) {
    return res.status(400).json({ error: 'No contract data to sign' });
  }

  const normalizedFields = Array.isArray(fields)
    ? fields
        .filter((field) =>
          field &&
          typeof field.id === 'string' &&
          typeof field.type === 'string' &&
          Number.isFinite(field.x) &&
          Number.isFinite(field.y) &&
          Number.isFinite(field.width) &&
          Number.isFinite(field.height) &&
          Number.isFinite(field.page),
        )
        .map((field) => ({
          id: field.id,
          type: field.type,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          page: field.page,
          value: typeof field.value === 'string' ? field.value : '',
          placeholder: typeof field.placeholder === 'string' ? field.placeholder : '',
          assignedTo: typeof field.assignedTo === 'string' ? field.assignedTo : undefined,
          required: field.required !== false,
        }))
    : [];

  const contractSnapshotWithFields = {
    ...(contractSnapshot as Record<string, unknown>),
    __esignFieldPlacements: normalizedFields,
  };

  const envelope = await prisma.signatureEnvelope.create({
    data: {
      dealId,
      type,
      documentVersion: 1,
      contractSnapshot: contractSnapshotWithFields as unknown as Prisma.JsonValue,
      signers: {
        create: signers.map((s) => ({
          role: s.role,
          name: s.name,
          email: s.email,
        })),
      },
    },
    include: { signers: true },
  });

  const propertyLabel = deal.property?.street || deal.title || 'Property';
  const defaultSubject = `Please Sign: Contract for ${propertyLabel}`;
  const defaultMessage = 'Please review and sign the attached Real Estate Purchase Contract.';
  const agentName = agent?.name || undefined;
  const agentEmail = agent?.email || undefined;
  const branding = {
    logoUrl: profileSettings?.logoUrl || profileSettings?.brokerageLogoUrl || undefined,
    primaryColor: profileSettings?.brandColor || undefined,
    secondaryColor: profileSettings?.accentColor || undefined,
    brokerageName: profileSettings?.brokerageName || agent?.brokerageName || undefined,
    emailSignature: profileSettings?.emailFooter || undefined,
  };

  const links = envelope.signers.map((signer) => ({
    signerId: signer.id,
    url: buildSigningLink(envelope.id, signer.id),
  }));

  const emailStatus = await sendEnvelopeEmails({
    envelopeId: envelope.id,
    signers: envelope.signers.map((s) => ({ id: s.id, name: s.name, email: s.email })),
    subject: subject || defaultSubject,
    message: message || defaultMessage,
    propertyLabel,
    agentName,
    agentEmail,
    branding,
  });

  console.log(`📬 Envelope ${envelope.id}: ${emailStatus.sent} emails sent, ${emailStatus.failed} failed`);

  res.status(201).json({ 
    envelope, 
    links, 
    emailStatus,
  });
});

router.post('/envelopes/:envelopeId/remind', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { envelopeId } = req.params;

  const envelope = await prisma.signatureEnvelope.findFirst({
    where: { id: envelopeId, deal: { agentId: req.agentId } },
    include: {
      signers: true,
      deal: { include: { property: true } },
    },
  });

  if (!envelope) {
    return res.status(404).json({ error: 'Envelope not found' });
  }

  const pendingSigners = envelope.signers.filter((s) => !s.signedAt);
  if (pendingSigners.length === 0) {
    return res.status(400).json({ error: 'All signers have already completed this envelope.' });
  }

  const [agent, profileSettings] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: req.agentId },
      select: { name: true, email: true, brokerageName: true },
    }),
    prisma.agentProfileSettings.findUnique({
      where: { agentId: req.agentId },
      select: {
        logoUrl: true,
        brokerageLogoUrl: true,
        brandColor: true,
        accentColor: true,
        emailFooter: true,
        brokerageName: true,
      },
    }),
  ]);

  const propertyLabel = envelope.deal?.property?.street || envelope.deal?.title || 'Property';
  const branding = {
    logoUrl: profileSettings?.logoUrl || profileSettings?.brokerageLogoUrl || undefined,
    primaryColor: profileSettings?.brandColor || undefined,
    secondaryColor: profileSettings?.accentColor || undefined,
    brokerageName: profileSettings?.brokerageName || agent?.brokerageName || undefined,
    emailSignature: profileSettings?.emailFooter || undefined,
  };
  const emailStatus = await sendEnvelopeEmails({
    envelopeId: envelope.id,
    signers: pendingSigners.map((s) => ({ id: s.id, name: s.name, email: s.email })),
    subject: `Reminder: Signature needed for ${propertyLabel}`,
    message: 'This is a friendly reminder to review and sign your contract packet. It usually takes less than 2 minutes.',
    propertyLabel,
    agentName: agent?.name || undefined,
    agentEmail: agent?.email || undefined,
    branding,
  });

  return res.json({
    envelopeId,
    reminded: pendingSigners.length,
    emailStatus,
  });
});

// Download signed contract PDF
router.get('/envelopes/:envelopeId/pdf', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { envelopeId } = req.params;
  const download = req.query.download === '1' || req.query.download === 'true';

  const envelope = await prisma.signatureEnvelope.findFirst({
    where: { 
      id: envelopeId,
      deal: { agentId: req.agentId }
    },
    include: { 
      signers: true,
      deal: { 
        include: { 
          property: true, 
          buyer: true, 
          seller: true,
          repc: true 
        } 
      },
    },
  });

  if (!envelope) {
    return res.status(404).json({ error: 'Envelope not found' });
  }

  const contractSnapshot = envelope.contractSnapshot as any;
  const deal = envelope.deal;

  // Build contract data from snapshot and deal info
  const contractData = {
    // Property info
    street: deal?.property?.street || contractSnapshot?.street,
    city: deal?.property?.city || contractSnapshot?.city,
    state: deal?.property?.state || contractSnapshot?.state,
    zip: deal?.property?.zip || contractSnapshot?.zip,
    county: deal?.property?.county || contractSnapshot?.county,
    mlsId: deal?.property?.mlsId || contractSnapshot?.mlsId,
    taxId: deal?.property?.taxId || contractSnapshot?.propertyTaxId,
    
    // Parties
    buyerNames: deal?.buyer 
      ? `${deal.buyer.firstName} ${deal.buyer.lastName}`.trim()
      : contractSnapshot?.buyerNames,
    buyerEmail: deal?.buyer?.email || contractSnapshot?.buyerEmail,
    sellerNames: deal?.seller
      ? `${deal.seller.firstName} ${deal.seller.lastName}`.trim()
      : contractSnapshot?.sellerNames,
    sellerEmail: deal?.seller?.email || contractSnapshot?.sellerEmail,
    
    // Price & Terms
    purchasePrice: contractSnapshot?.purchasePrice,
    earnestMoney: contractSnapshot?.earnestMoney,
    
    // Dates
    dueDiligenceDeadline: contractSnapshot?.dueDiligenceDeadline,
    financingAppraisalDeadline: contractSnapshot?.financingAppraisalDeadline,
    settlementDeadline: contractSnapshot?.settlementDeadline,
    
    // Signatures from signers
    buyerSignature: envelope.signers.find(s => s.role === 'BUYER')?.name,
    buyerSignedDate: envelope.signers.find(s => s.role === 'BUYER')?.signedAt?.toISOString(),
    sellerSignature: envelope.signers.find(s => s.role === 'SELLER')?.name,
    sellerSignedDate: envelope.signers.find(s => s.role === 'SELLER')?.signedAt?.toISOString(),
  };

  // Build signers info for summary
  const signersSummary = envelope.signers.map(s => ({
    name: s.name,
    role: s.role,
    signedAt: s.signedAt?.toISOString(),
  }));

  // Generate the signed contract PDF
  try {
    let pdfBuffer: Buffer;
    
    // Try to fill the official template first
    if (envelope.type === 'REPC') {
      const def = await prisma.formDefinition.findUnique({ where: { code: 'REPC' } });
      if (def) {
        const repoRoot = path.resolve(__dirname, '..', '..', '..');
        const templatePath = path.resolve(repoRoot, def.officialPdfPath);
        
        if (fs.existsSync(templatePath)) {
          pdfBuffer = await fillRepcPdf(templatePath, contractData);
        } else {
          // Fallback to summary PDF
          pdfBuffer = await generateSignedContractPdf(contractData, signersSummary);
        }
      } else {
        pdfBuffer = await generateSignedContractPdf(contractData, signersSummary);
      }
    } else {
      // For addendums and other types, generate a summary PDF
      pdfBuffer = await generateSignedContractPdf(contractData, signersSummary);
    }

    const filename = `${envelope.type}-${deal?.property?.street || envelope.id}-signed.pdf`
      .replace(/[^a-zA-Z0-9.-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating signed PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

