import { Router } from 'express';
import { SignatureEnvelopeType, SignerRole, Prisma, TaskPriority } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { resolveSnapshotWithEnvelopeFields } from '../lib/esignFieldPlan';
import { sendSigningRequestEmail } from '../services/emailService';
import { addSigningGuidesToPdf, generateSignedContractPdf, fillRepcPdf } from '../services/pdfService';
import { createESignToken } from '../lib/esignToken';
import { runBestEffortPrisma } from '../lib/prismaRetry';
import {
  completeESignFollowUpTasks,
  logESignDealEvent,
  upsertESignFollowUpTask,
} from '../services/esignAutomationService';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
export const router = Router();

const REMINDER_COOLDOWN_MS = 90_000;
const AUTO_REMINDER_INTERVAL_MS = 18 * 60 * 60 * 1000;
const MAX_AUTOMATED_REMINDERS_PER_FETCH = 3;
const DOCUMENT_ENVELOPE_MAX_BYTES = 15 * 1024 * 1024;

const documentEnvelopeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_ENVELOPE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfName = file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdfMime || isPdfName) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF files can be sent for document e-sign.'));
  },
});

const handleDocumentEnvelopeUpload = (req: AuthenticatedRequest, res: any, next: (err?: any) => void) => {
  documentEnvelopeUpload.single('file')(req as any, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'PDF is too large. Upload a document under 15 MB.'
        : err.message;
      return res.status(400).json({ error: message });
    }
    if (err) {
      return res.status(400).json({ error: err?.message || 'Failed to upload document.' });
    }
    next();
  });
};

const getReminderDueAt = (params: { createdAt: Date; lastReminderSentAt: Date | null }) => {
  const anchor = params.lastReminderSentAt || params.createdAt;
  return new Date(anchor.getTime() + AUTO_REMINDER_INTERVAL_MS);
};

const getAppBaseUrl = () =>
  process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || 'http://localhost:5174';

const formatEmailStatusSummary = (status: { sent: number; failed: number; skipped?: number }) => {
  const parts = [`${status.sent} sent`];
  if ((status.skipped || 0) > 0) parts.push(`${status.skipped} link-only`);
  if (status.failed > 0) parts.push(`${status.failed} failed`);
  return parts.join(', ');
};

const buildSigningLink = (envelopeId: string, signerId: string) => {
  const token = createESignToken(envelopeId, signerId);
  return `${getAppBaseUrl()}/esign/${envelopeId}/${signerId}/${token}`;
};

const parseJsonBodyField = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeSigners = (signers: unknown) => Array.isArray(signers)
  ? signers.map((signer: any) => ({
      role: signer.role as SignerRole,
      name: String(signer.name || '').trim(),
      email: String(signer.email || '').trim(),
    }))
  : [];

const buildEnvelopeLinks = (envelope: { id: string; signers: Array<{ id: string; role: string; name: string; email?: string | null }> }) =>
  envelope.signers.map((signer) => ({
    signerId: signer.id,
    role: signer.role,
    name: signer.name,
    email: signer.email || '',
    deliveryMethod: signer.email ? 'EMAIL' : 'LINK_ONLY',
    url: buildSigningLink(envelope.id, signer.id),
  }));

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

async function sendEnvelopeEmails(params: {
  envelopeId: string;
  agentId?: string;
  signers: Array<{ id: string; name: string; email?: string | null; role?: string | null }>;
  subject: string;
  message: string;
  propertyLabel: string;
  documentName?: string;
  deliveryType?: 'initial' | 'reminder' | 'auto_reminder';
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
  const deliveryType = params.deliveryType || 'initial';
  const emailResults = await Promise.all(
    params.signers.map(async (signer) => {
      const email = String(signer.email || '').trim();
      if (!email) {
        return {
          signerId: signer.id,
          email: null,
          status: 'skipped' as const,
          success: false,
          reason: 'No email address',
        };
      }

      const result = await sendSigningRequestEmail({
        signerName: signer.name,
        signerEmail: email,
        property: params.propertyLabel,
        subject: params.subject,
        message: params.message,
        signingLink: buildSigningLink(params.envelopeId, signer.id),
        agentName: params.agentName,
        agentEmail: params.agentEmail,
        branding: params.branding,
        categories: ['esign', deliveryType === 'initial' ? 'esign_initial' : 'esign_reminder'],
        customArgs: {
          agentId: params.agentId || '',
          envelopeId: params.envelopeId,
          signerId: signer.id,
          signerRole: String(signer.role || ''),
          deliveryType,
          documentName: params.documentName || params.propertyLabel,
        },
      });

      return {
        signerId: signer.id,
        email,
        status: result.success ? ('sent' as const) : ('failed' as const),
        ...result,
      };
    }),
  );

  const emailsSent = emailResults.filter((r) => r.status === 'sent').length;
  const emailsFailed = emailResults.filter((r) => r.status === 'failed').length;
  const emailsSkipped = emailResults.filter((r) => r.status === 'skipped').length;

  return {
    sent: emailsSent,
    failed: emailsFailed,
    skipped: emailsSkipped,
    results: emailResults,
  };
}

router.get('/envelopes', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const [envelopes, agent, profileSettings] = await Promise.all([
    prisma.signatureEnvelope.findMany({
      where: {
        OR: [
          { agentId: req.agentId },
          { deal: { agentId: req.agentId } },
        ],
      },
      include: {
        signers: true,
        deal: { include: { property: true, buyer: true, seller: true, repc: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
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

  const branding = {
    logoUrl: profileSettings?.brokerageLogoUrl || profileSettings?.logoUrl || undefined,
    primaryColor: profileSettings?.brandColor || undefined,
    secondaryColor: profileSettings?.accentColor || undefined,
    brokerageName: profileSettings?.brokerageName || agent?.brokerageName || undefined,
    emailSignature: profileSettings?.emailFooter || undefined,
  };

  const autoReminderCandidates = envelopes
    .map((envelope) => {
      const pendingSigners = envelope.signers.filter((signer) => !signer.signedAt);
      const dueAt = getReminderDueAt({
        createdAt: envelope.createdAt,
        lastReminderSentAt: envelope.lastReminderSentAt,
      });
      return { envelope, pendingSigners, dueAt };
    })
    .filter((item) => item.pendingSigners.length > 0 && item.dueAt.getTime() <= Date.now())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, MAX_AUTOMATED_REMINDERS_PER_FETCH);

  for (const item of autoReminderCandidates) {
    const propertyLabel = item.envelope.documentName || item.envelope.deal?.property?.street || item.envelope.deal?.title || 'Document packet';
    const emailStatus = await sendEnvelopeEmails({
      envelopeId: item.envelope.id,
      agentId: req.agentId,
      signers: item.pendingSigners.map((signer) => ({
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role: signer.role,
      })),
      subject: `Reminder: Signature needed for ${propertyLabel}`,
      message:
        'Automated reminder: your contract packet is still awaiting signature. Please review and sign when ready.',
      propertyLabel,
      documentName: item.envelope.documentName || propertyLabel,
      deliveryType: 'auto_reminder',
      agentName: agent?.name || undefined,
      agentEmail: agent?.email || undefined,
      branding,
    });

    const reminderAttempted = emailStatus.sent > 0 || emailStatus.failed > 0;
    if (!reminderAttempted) continue;

    const reminderAt = new Date();
    await runBestEffortPrisma('Auto e-sign reminder bookkeeping', async () => {
      await prisma.signatureEnvelope.update({
        where: { id: item.envelope.id },
        data: { lastReminderSentAt: reminderAt },
      });
      item.envelope.lastReminderSentAt = reminderAt;

      if (item.envelope.dealId) {
        await logESignDealEvent({
          agentId: req.agentId!,
          dealId: item.envelope.dealId,
          title: 'Auto reminder sent for e-sign packet',
          description: `Reminder delivery: ${formatEmailStatusSummary(emailStatus)}.`,
          date: reminderAt,
        });

        await upsertESignFollowUpTask({
          agentId: req.agentId!,
          dealId: item.envelope.dealId,
          envelopeId: item.envelope.id,
          propertyLabel,
          dueAt: new Date(reminderAt.getTime() + AUTO_REMINDER_INTERVAL_MS),
          note: `${item.pendingSigners.length} signer(s) still pending. Last reminder sent automatically.`,
          priority: item.pendingSigners.some((signer) => Boolean(signer.viewedAt))
            ? TaskPriority.HIGH
            : TaskPriority.NORMAL,
        });
      }
    });
  }

  for (const envelope of envelopes) {
    const hasPendingSigners = envelope.signers.some((signer) => !signer.signedAt);
    if (hasPendingSigners) continue;
    if (envelope.dealId) {
      await completeESignFollowUpTasks({
        agentId: req.agentId,
        dealId: envelope.dealId,
        envelopeId: envelope.id,
        completionNote: 'Closed automatically: all signers have completed this packet.',
      });
    }
  }

  res.json(envelopes);
});

router.post('/envelopes', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId, type, signers, fields } = req.body as {
    dealId: string;
    type: SignatureEnvelopeType;
    signers: { role: SignerRole; name: string; email?: string | null }[];
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
  const requestedEmailDelivery = req.body?.sendEmails !== false;
  const normalizedSigners = normalizeSigners(signers);

  if (normalizedSigners.length === 0) {
    return res.status(400).json({ error: 'Add at least one signer before creating an envelope.' });
  }

  if (normalizedSigners.some((signer) => !signer.name)) {
    return res.status(400).json({ error: 'Each included signer needs a name.' });
  }

  const sendEmails = requestedEmailDelivery && normalizedSigners.some((signer) => !!signer.email);

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

  const contractSnapshotWithFields = resolveSnapshotWithEnvelopeFields({
    envelopeType: type,
    signers: normalizedSigners,
    snapshot: {
      ...(contractSnapshot as Record<string, unknown>),
      __esignFieldPlacements: fields,
    },
  });

  const envelope = await prisma.signatureEnvelope.create({
    data: {
      agentId: req.agentId,
      dealId,
      type,
      documentVersion: 1,
      contractSnapshot: contractSnapshotWithFields as unknown as Prisma.JsonValue,
      signers: {
        create: normalizedSigners.map((s) => ({
          role: s.role,
          name: s.name,
          email: s.email || '',
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
    logoUrl: profileSettings?.brokerageLogoUrl || profileSettings?.logoUrl || undefined,
    primaryColor: profileSettings?.brandColor || undefined,
    secondaryColor: profileSettings?.accentColor || undefined,
    brokerageName: profileSettings?.brokerageName || agent?.brokerageName || undefined,
    emailSignature: profileSettings?.emailFooter || undefined,
  };

  const links = buildEnvelopeLinks(envelope);

  const emailStatus = sendEmails
    ? await sendEnvelopeEmails({
        envelopeId: envelope.id,
        agentId: req.agentId,
        signers: envelope.signers.map((s) => ({ id: s.id, name: s.name, email: s.email, role: s.role })),
        subject: subject || defaultSubject,
        message: message || defaultMessage,
        propertyLabel,
        documentName: type,
        deliveryType: 'initial',
        agentName,
        agentEmail,
        branding,
      })
    : {
        sent: 0,
        failed: 0,
        skipped: envelope.signers.length,
        results: envelope.signers.map((signer) => ({
          signerId: signer.id,
          email: signer.email || null,
          status: 'skipped' as const,
          success: false,
          reason: 'Email delivery skipped',
        })),
      };

  if (sendEmails) {
    console.log(`📬 Envelope ${envelope.id}: ${emailStatus.sent} emails sent, ${emailStatus.failed} failed`);
  } else {
    console.log(`📭 Envelope ${envelope.id}: outbound email dispatch skipped by request`);
  }

  await runBestEffortPrisma('E-sign envelope follow-up logging', async () => {
    const initialFollowUpDueAt = new Date(Date.now() + AUTO_REMINDER_INTERVAL_MS);
    await upsertESignFollowUpTask({
      agentId: req.agentId!,
      dealId,
      envelopeId: envelope.id,
      propertyLabel,
      dueAt: initialFollowUpDueAt,
      note: `${envelope.signers.length} signer(s) invited. Auto-reminders run every 18 hours until complete.`,
      priority: TaskPriority.NORMAL,
    });

    await logESignDealEvent({
      agentId: req.agentId!,
      dealId,
      title: sendEmails ? 'E-sign packet sent' : 'E-sign packet prepared',
      description: sendEmails
        ? `${envelope.signers.length} signer(s) invited. Delivery: ${formatEmailStatusSummary(emailStatus)}.`
        : `${envelope.signers.length} signer(s) added. ${emailStatus.skipped || envelope.signers.length} signing link(s) ready for manual sharing.`,
    });
  });

  res.status(201).json({ 
    envelope, 
    links, 
    emailStatus,
  });
});

router.post('/document-envelopes', handleDocumentEnvelopeUpload, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const uploadedFile = (req as any).file as Express.Multer.File | undefined;
  if (!uploadedFile?.buffer?.length) {
    return res.status(400).json({ error: 'Upload a PDF document before sending for e-sign.' });
  }

  const normalizedSigners = normalizeSigners(parseJsonBodyField(req.body?.signers, []));
  if (normalizedSigners.length === 0) {
    return res.status(400).json({ error: 'Add at least one signer before creating an envelope.' });
  }

  if (normalizedSigners.some((signer) => !signer.name)) {
    return res.status(400).json({ error: 'Each included signer needs a name.' });
  }

  const fields = parseJsonBodyField(req.body?.fields, []);
  const requestedEmailDelivery = req.body?.sendEmails !== false && req.body?.sendEmails !== 'false';
  const sendEmails = requestedEmailDelivery && normalizedSigners.some((signer) => !!signer.email);
  const dealId = String(req.body?.dealId || '').trim();
  const originalDocumentName = uploadedFile.originalname.replace(/\.pdf$/i, '').trim();
  const documentName = String(req.body?.documentName || originalDocumentName || 'Document packet')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'Document packet';

  const [agent, profileSettings, deal] = await Promise.all([
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
    dealId
      ? prisma.deal.findFirst({
          where: { id: dealId, agentId: req.agentId },
          include: { property: true, buyer: true, seller: true },
        })
      : Promise.resolve(null),
  ]);

  if (dealId && !deal) {
    return res.status(404).json({ error: 'Deal not found for this document envelope.' });
  }

  const contextType = String(req.body?.contextType || (deal ? 'deal' : 'document')).trim() || 'document';
  const contextLabel = String(req.body?.contextLabel || '').trim();
  const propertyLabel = deal?.property?.street || deal?.title || documentName;
  const contractSnapshotWithFields = resolveSnapshotWithEnvelopeFields({
    envelopeType: SignatureEnvelopeType.DOCUMENT,
    signers: normalizedSigners,
    snapshot: {
      documentName,
      documentMimeType: 'application/pdf',
      contextType,
      contextLabel: contextLabel || propertyLabel,
      dealId: deal?.id,
      street: deal?.property?.street,
      city: deal?.property?.city,
      state: deal?.property?.state,
      zip: deal?.property?.zip,
      county: deal?.property?.county,
      mlsId: deal?.property?.mlsId,
      propertyTaxId: deal?.property?.taxId,
      buyerNames: deal?.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}`.trim() : undefined,
      buyerEmail: deal?.buyer?.email,
      sellerNames: deal?.seller ? `${deal.seller.firstName} ${deal.seller.lastName}`.trim() : undefined,
      sellerEmail: deal?.seller?.email,
      __esignFieldPlacements: fields,
    },
  });

  const envelope = await prisma.signatureEnvelope.create({
    data: {
      agentId: req.agentId,
      dealId: deal?.id || null,
      type: SignatureEnvelopeType.DOCUMENT,
      documentVersion: 1,
      contractSnapshot: contractSnapshotWithFields as unknown as Prisma.JsonValue,
      documentName,
      documentMimeType: 'application/pdf',
      documentData: uploadedFile.buffer,
      signers: {
        create: normalizedSigners.map((signer) => ({
          role: signer.role,
          name: signer.name,
          email: signer.email || '',
        })),
      },
    },
    include: { signers: true },
  });

  const branding = {
    logoUrl: profileSettings?.brokerageLogoUrl || profileSettings?.logoUrl || undefined,
    primaryColor: profileSettings?.brandColor || undefined,
    secondaryColor: profileSettings?.accentColor || undefined,
    brokerageName: profileSettings?.brokerageName || agent?.brokerageName || undefined,
    emailSignature: profileSettings?.emailFooter || undefined,
  };
  const links = buildEnvelopeLinks(envelope);
  const defaultSubject = `Please Sign: ${documentName}`;
  const defaultMessage = 'Please review and sign the attached document.';
  const subject = String(req.body?.subject || defaultSubject).trim() || defaultSubject;
  const message = String(req.body?.message || defaultMessage).trim() || defaultMessage;
  const emailStatus = sendEmails
    ? await sendEnvelopeEmails({
        envelopeId: envelope.id,
        agentId: req.agentId,
        signers: envelope.signers.map((signer) => ({ id: signer.id, name: signer.name, email: signer.email, role: signer.role })),
        subject,
        message,
        propertyLabel,
        documentName,
        deliveryType: 'initial',
        agentName: agent?.name || undefined,
        agentEmail: agent?.email || undefined,
        branding,
      })
    : {
        sent: 0,
        failed: 0,
        skipped: envelope.signers.length,
        results: envelope.signers.map((signer) => ({
          signerId: signer.id,
          email: signer.email || null,
          status: 'skipped' as const,
          success: false,
          reason: 'Email delivery skipped',
        })),
      };

  if (deal?.id) {
    await runBestEffortPrisma('Document e-sign follow-up logging', async () => {
      const dueAt = new Date(Date.now() + AUTO_REMINDER_INTERVAL_MS);
      await upsertESignFollowUpTask({
        agentId: req.agentId!,
        dealId: deal.id,
        envelopeId: envelope.id,
        propertyLabel,
        dueAt,
        note: `${envelope.signers.length} signer(s) invited for ${documentName}. Auto-reminders run every 18 hours until complete.`,
        priority: TaskPriority.NORMAL,
      });

      await logESignDealEvent({
        agentId: req.agentId!,
        dealId: deal.id,
        title: sendEmails ? 'Document e-sign packet sent' : 'Document e-sign packet prepared',
        description: sendEmails
          ? `${documentName}: ${envelope.signers.length} signer(s) invited. Delivery: ${formatEmailStatusSummary(emailStatus)}.`
          : `${documentName}: ${envelope.signers.length} signer(s) added. ${emailStatus.skipped || envelope.signers.length} signing link(s) ready for manual sharing.`,
      });
    });
  }

  return res.status(201).json({
    envelope,
    links,
    emailStatus,
  });
});

router.post('/envelopes/:envelopeId/remind', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { envelopeId } = req.params;

  const envelope = await prisma.signatureEnvelope.findFirst({
    where: {
      id: envelopeId,
      OR: [
        { agentId: req.agentId },
        { deal: { agentId: req.agentId } },
      ],
    },
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

  if (envelope.lastReminderSentAt) {
    const cooldownUntilTs = envelope.lastReminderSentAt.getTime() + REMINDER_COOLDOWN_MS;
    if (cooldownUntilTs > Date.now()) {
      const retryAfterSeconds = Math.ceil((cooldownUntilTs - Date.now()) / 1000);
      return res.status(429).json({
        error: `Please wait ${retryAfterSeconds}s before sending another reminder.`,
        retryAfterSeconds,
        cooldownUntil: new Date(cooldownUntilTs).toISOString(),
      });
    }
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

  const propertyLabel = envelope.documentName || envelope.deal?.property?.street || envelope.deal?.title || 'Document packet';
  const branding = {
    logoUrl: profileSettings?.brokerageLogoUrl || profileSettings?.logoUrl || undefined,
    primaryColor: profileSettings?.brandColor || undefined,
    secondaryColor: profileSettings?.accentColor || undefined,
    brokerageName: profileSettings?.brokerageName || agent?.brokerageName || undefined,
    emailSignature: profileSettings?.emailFooter || undefined,
  };
  const emailStatus = await sendEnvelopeEmails({
    envelopeId: envelope.id,
    agentId: req.agentId,
    signers: pendingSigners.map((s) => ({ id: s.id, name: s.name, email: s.email, role: s.role })),
    subject: `Reminder: Signature needed for ${propertyLabel}`,
    message: 'This is a friendly reminder to review and sign your contract packet. It usually takes less than 2 minutes.',
    propertyLabel,
    documentName: envelope.documentName || propertyLabel,
    deliveryType: 'reminder',
    agentName: agent?.name || undefined,
    agentEmail: agent?.email || undefined,
    branding,
  });

  const reminderAttempted = emailStatus.sent > 0 || emailStatus.failed > 0;
  const lastReminderSentAt = reminderAttempted ? new Date() : envelope.lastReminderSentAt;
  if (reminderAttempted && lastReminderSentAt) {
    await runBestEffortPrisma('Manual e-sign reminder bookkeeping', async () => {
      await prisma.signatureEnvelope.update({
        where: { id: envelope.id },
        data: { lastReminderSentAt },
      });

      if (envelope.dealId) {
        await upsertESignFollowUpTask({
          agentId: req.agentId!,
          dealId: envelope.dealId,
          envelopeId: envelope.id,
          propertyLabel,
          dueAt: new Date(lastReminderSentAt.getTime() + AUTO_REMINDER_INTERVAL_MS),
          note: `${pendingSigners.length} signer(s) still pending after reminder.`,
          priority: pendingSigners.some((signer) => Boolean(signer.viewedAt))
            ? TaskPriority.HIGH
            : TaskPriority.NORMAL,
        });

        await logESignDealEvent({
          agentId: req.agentId!,
          dealId: envelope.dealId,
          title: 'Reminder sent for e-sign packet',
          description: `Reminder delivery: ${formatEmailStatusSummary(emailStatus)}.`,
          date: lastReminderSentAt,
        });
      }
    });
  }

  return res.json({
    envelopeId,
    reminded: pendingSigners.length,
    emailStatus,
    lastReminderSentAt: lastReminderSentAt ? lastReminderSentAt.toISOString() : null,
    cooldownUntil: lastReminderSentAt
      ? new Date(lastReminderSentAt.getTime() + REMINDER_COOLDOWN_MS).toISOString()
      : null,
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
      OR: [
        { agentId: req.agentId },
        { deal: { agentId: req.agentId } },
      ],
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
    const documentBuffer = envelope.type === SignatureEnvelopeType.DOCUMENT
      ? getEnvelopeDocumentBuffer(envelope.documentData)
      : null;
    
    // Try to fill the official template first
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

    if (envelope.type === SignatureEnvelopeType.DOCUMENT) {
      pdfBuffer = await addSigningGuidesToPdf(pdfBuffer, {
        signers: envelope.signers.map(getSignerGuidePayload),
        formCode: envelope.type,
        fields: Array.isArray(contractSnapshot?.__esignFieldPlacements) ? contractSnapshot.__esignFieldPlacements : undefined,
        propertyAddress: envelope.documentName || [contractData.street, contractData.city, contractData.state, contractData.zip]
          .filter(Boolean)
          .join(', '),
      });
    }

    const filename = envelope.type === SignatureEnvelopeType.DOCUMENT
      ? safePdfFilename(`${envelope.documentName || envelope.id}-signed`)
      : `${envelope.type}-${deal?.property?.street || envelope.id}-signed.pdf`
        .replace(/[^a-zA-Z0-9.-]/g, '_');

    const responseBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(responseBuffer.length));
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    return res.end(responseBuffer);
  } catch (error) {
    console.error('Error generating signed PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

