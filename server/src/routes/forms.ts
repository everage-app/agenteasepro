import { Router } from 'express';
import { FormInstance, Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiInterpretFormAnswer, aiSmartFormPrompt } from '../services/aiService';
import { syncDealEventsFromRepc } from '../services/calendarService';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../lib/prisma';
export const router = Router();

function getUploadsBaseDir() {
  const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';
  return process.env.NODE_ENV === 'production'
    ? path.join(tmpDir, 'agentease-uploads')
    : path.join(__dirname, '../uploads');
}

function getAgentTemplatePrefix(agentId: string) {
  return `AGENT_${agentId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}_`;
}

function isTemplateVisibleToAgent(def: { code: string; schemaJson: Prisma.JsonValue }, agentId?: string | null) {
  if (!def.code.startsWith('AGENT_')) return true;
  if (!agentId) return false;
  const expectedPrefix = getAgentTemplatePrefix(agentId);
  if (def.code.startsWith(expectedPrefix)) return true;
  const schemaObj = (def.schemaJson && typeof def.schemaJson === 'object') ? (def.schemaJson as Record<string, any>) : null;
  return schemaObj?.ownerAgentId === agentId;
}

function resolveTemplatePdfPath(officialPdfPath: string): string {
  const normalized = officialPdfPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.startsWith('uploads/')) {
    const relative = normalized.replace(/^uploads\//, '');
    return path.join(getUploadsBaseDir(), relative);
  }
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  return path.resolve(repoRoot, officialPdfPath);
}

const templateUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(getUploadsBaseDir(), 'forms');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const base = file.originalname
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9-_ ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'template';
    cb(null, `${Date.now()}-${base}.pdf`);
  },
});

const templateUpload = multer({
  storage: templateUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfName = file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdfMime || isPdfName) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF files are allowed'));
  },
});

const handleTemplateUpload = (req: any, res: any, next: (err?: any) => void) => {
  templateUpload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err?.message || 'Failed to upload template' });
    }
    next();
  });
};

function deriveFormCode(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function deriveCategory(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('addendum')) return 'Addendum';
  if (lower.includes('disclosure')) return 'Disclosures';
  if (lower.includes('receipt')) return 'Receipt';
  if (lower.includes('repc') || lower.includes('contract')) return 'Contract';
  return 'General';
}

async function ensureFormDefinitionsSeeded(): Promise<void> {
  const existing = await prisma.formDefinition.count({ where: { isActive: true } });
  if (existing > 0) return;

  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const templatesDir = path.resolve(repoRoot, 'contracts', 'templates');
  if (!fs.existsSync(templatesDir)) return;

  const files = fs
    .readdirSync(templatesDir)
    .filter((name) => name.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) return;

  for (const fileName of files) {
    const code = deriveFormCode(fileName);
    try {
      await prisma.formDefinition.upsert({
        where: { code },
        update: {
          isActive: true,
          displayName: fileName.replace(/\.pdf$/i, ''),
          category: deriveCategory(fileName),
          officialPdfPath: `contracts/templates/${fileName}`,
        },
        create: {
          code,
          displayName: fileName.replace(/\.pdf$/i, ''),
          category: deriveCategory(fileName),
          version: 'auto-seeded',
          officialPdfPath: `contracts/templates/${fileName}`,
          schemaJson: { sections: [], questions: [] },
          isActive: true,
        },
      });
    } catch (error) {
      console.warn('Skipping form definition seed for', fileName, error);
    }
  }
}

router.get('/definitions', async (_req: AuthenticatedRequest, res) => {
  try {
    await ensureFormDefinitionsSeeded();
    const defs = await prisma.formDefinition.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });
    const visible = defs.filter((def) => isTemplateVisibleToAgent(def, _req.agentId));
    res.json(visible);
  } catch (error) {
    console.error('Failed to load form definitions:', error);
    res.status(500).json({ error: 'Failed to load form definitions' });
  }
});

router.post('/definitions/upload', handleTemplateUpload, async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const uploadedFile = (req as any).file as { filename: string; originalname: string } | undefined;
  if (!uploadedFile) return res.status(400).json({ error: 'No file uploaded' });

  const displayNameInput = String(req.body?.displayName || '').trim();
  const categoryInput = String(req.body?.category || '').trim();
  const usageScopeRaw = String(req.body?.usageScope || 'DEAL').toUpperCase();
  const usageScope = usageScopeRaw === 'CLIENT' || usageScopeRaw === 'BOTH' ? usageScopeRaw : 'DEAL';

  const displayName = displayNameInput || uploadedFile.originalname.replace(/\.pdf$/i, '').trim();
  const category = categoryInput || `Custom ${usageScope === 'BOTH' ? 'Deal + Client' : usageScope === 'CLIENT' ? 'Client' : 'Deal'}`;

  const prefix = getAgentTemplatePrefix(req.agentId);
  const codeBase = deriveFormCode(displayName).slice(0, 40) || 'CUSTOM_TEMPLATE';

  let code = `${prefix}${codeBase}`;
  let suffix = 2;
  while (await prisma.formDefinition.findUnique({ where: { code } })) {
    code = `${prefix}${codeBase}_${suffix}`;
    suffix += 1;
  }

  const saved = await prisma.formDefinition.create({
    data: {
      code,
      displayName,
      category,
      version: 'custom-upload',
      officialPdfPath: `/uploads/forms/${uploadedFile.filename}`,
      schemaJson: {
        sections: [],
        questions: [],
        usageScope,
        ownerAgentId: req.agentId,
        source: 'custom-upload',
      },
      isActive: true,
    },
  });

  res.status(201).json(saved);
});

router.get('/definitions/:code/pdf', async (req: AuthenticatedRequest, res) => {
  const { code } = req.params;
  const download = req.query.download === '1' || req.query.download === 'true';

  const def = await prisma.formDefinition.findUnique({ where: { code } });
  if (!def) return res.status(404).json({ error: 'Form definition not found' });
  if (!isTemplateVisibleToAgent(def, req.agentId)) {
    return res.status(404).json({ error: 'Form definition not found' });
  }

  const absolutePath = resolveTemplatePdfPath(def.officialPdfPath);

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({
      error: 'Official PDF template not found on server',
      code: def.code,
      expectedPath: def.officialPdfPath,
    });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${(def.displayName || def.code).replace(/[^a-zA-Z0-9._ -]/g, '').trim() || def.code}.pdf"`,
  );
  return res.sendFile(absolutePath);
});

router.get('/definitions/:code', async (req: AuthenticatedRequest, res) => {
  const { code } = req.params;
  const def = await prisma.formDefinition.findUnique({ where: { code } });
  if (!def) return res.status(404).json({ error: 'Form definition not found' });
  if (!isTemplateVisibleToAgent(def, req.agentId)) {
    return res.status(404).json({ error: 'Form definition not found' });
  }
  res.json(def);
});

router.get('/deals/:dealId/forms', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId } = req.params;

  const deal = await prisma.deal.findFirst({ where: { id: dealId, agentId: req.agentId } });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const forms = await prisma.formInstance.findMany({
    where: { dealId },
    include: { definition: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(forms);
});

router.post('/deals/:dealId/forms', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId } = req.params;
  const { formCode, title, data } = req.body as {
    formCode: string;
    title?: string;
    data?: Record<string, unknown>;
  };

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, agentId: req.agentId },
    include: { property: true, buyer: true, seller: true },
  });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const def = await prisma.formDefinition.findUnique({ where: { code: formCode } });
  if (!def) return res.status(404).json({ error: 'Form definition not found' });
  if (!isTemplateVisibleToAgent(def, req.agentId)) {
    return res.status(404).json({ error: 'Form definition not found' });
  }

  const prefill: Record<string, unknown> = {
    buyerNames: deal.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}` : undefined,
    sellerNames: deal.seller ? `${deal.seller.firstName} ${deal.seller.lastName}` : undefined,
    buyerEmail: deal.buyer?.email || undefined,
    sellerEmail: deal.seller?.email || undefined,
    street: deal.property.street,
    city: deal.property.city,
    county: deal.property.county,
    state: deal.property.state,
    zip: deal.property.zip,
    mlsId: deal.property.mlsId || undefined,
    propertyTaxId: deal.property.taxId || undefined,
    fullAddress: [deal.property.street, deal.property.city, deal.property.state, deal.property.zip]
      .filter(Boolean)
      .join(', '),
  };

  const instance = await prisma.formInstance.create({
    data: {
      dealId: deal.id,
      formDefinitionId: def.id,
      title: title || def.displayName,
      status: 'DRAFT',
      data: { ...prefill, ...(data || {}) } as Prisma.JsonValue,
    },
    include: { definition: true },
  });

  res.status(201).json(instance);
});

router.put('/:formInstanceId', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { formInstanceId } = req.params;
  const { data, status } = req.body as { data?: unknown; status?: string };

  const instance = await prisma.formInstance.findUnique({
    where: { id: formInstanceId },
    include: { deal: true },
  });
  if (!instance || instance.deal.agentId !== req.agentId) {
    return res.status(404).json({ error: 'Form instance not found' });
  }

  const updated = await prisma.formInstance.update({
    where: { id: formInstanceId },
    data: {
      data: (data as Prisma.JsonValue | undefined) ?? (instance.data as Prisma.JsonValue),
      status: status ?? instance.status,
    },
    include: { definition: true },
  });

  res.json(updated);
});

router.get('/:formInstanceId', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { formInstanceId } = req.params;

  const instance = await prisma.formInstance.findUnique({
    where: { id: formInstanceId },
    include: { definition: true, deal: true },
  });

  if (!instance || instance.deal.agentId !== req.agentId) {
    return res.status(404).json({ error: 'Form instance not found' });
  }

  res.json(instance);
});

// Guided Q&A: list questions with answer status
router.get('/:formInstanceId/questions', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { formInstanceId } = req.params;
  const instance = await prisma.formInstance.findUnique({
    where: { id: formInstanceId },
    include: { definition: true, deal: true },
  });
  if (!instance || instance.deal.agentId !== req.agentId) {
    return res.status(404).json({ error: 'Form instance not found' });
  }
  const schema: any = instance.definition.schemaJson || {};
  const questions: any[] = schema.questions || [];
  const data: any = instance.data || {};
  const enriched = questions.map((q) => {
    const answered = q.targets.every((t: string) => data[t] !== undefined && data[t] !== '');
    return { ...q, status: answered ? 'answered' : 'pending' };
  });
  res.json({ formInstanceId, questions: enriched });
});

async function updateRepcFromFormInstance(instance: FormInstance) {
  // Only sync if this is REPC
  const definition = await prisma.formDefinition.findUnique({ where: { id: instance.formDefinitionId } });
  if (!definition || definition.code !== 'REPC') return;
  const deal = await prisma.deal.findUnique({ where: { id: instance.dealId }, include: { repc: true } });
  if (!deal || !deal.repc) return; // skip if no REPC row yet
  const data: any = instance.data || {};

  const updatePayload: any = {};
  // Monetary
  if (data.purchasePrice) updatePayload.purchasePrice = data.purchasePrice;
  if (data.earnestMoneyAmount) updatePayload.earnestMoneyAmount = data.earnestMoneyAmount;
  if (data.additionalEarnestMoneyAmount) updatePayload.additionalEarnestMoneyAmount = data.additionalEarnestMoneyAmount;
  // Deadlines (dates stored as ISO)
  const dateFields = [
    'sellerDisclosureDeadline',
    'dueDiligenceDeadline',
    'financingAppraisalDeadline',
    'settlementDeadline',
  ];
  for (const f of dateFields) {
    if (data[f]) {
      try { updatePayload[f] = new Date(data[f]); } catch { /* ignore parse errors */ }
    }
  }
  // Possession
  if (data.possessionTiming) updatePayload.possessionTiming = data.possessionTiming;
  if (data.possessionOffset !== undefined) updatePayload.possessionOffset = data.possessionOffset;

  if (Object.keys(updatePayload).length) {
    await prisma.repc.update({ where: { dealId: deal.id }, data: updatePayload });
    await syncDealEventsFromRepc(deal.id);
  }
}

// Answer a single guided question
router.post('/:formInstanceId/questions/:questionId/answer', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { formInstanceId, questionId } = req.params;
  const { answerText, overwriteExisting } = req.body as { answerText: string; overwriteExisting?: boolean };
  const instance = await prisma.formInstance.findUnique({ where: { id: formInstanceId }, include: { definition: true, deal: true } });
  if (!instance || instance.deal.agentId !== req.agentId) return res.status(404).json({ error: 'Form instance not found' });
  const schema: any = instance.definition.schemaJson || {};
  const question = (schema.questions || []).find((q: any) => q.id === questionId);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  const formData: any = instance.data || {};
  const ai = await aiInterpretFormAnswer({ agentId: req.agentId, formDefinition: instance.definition, question, formData, answerText });
  // Merge updates
  const newData = { ...formData };
  for (const [k, v] of Object.entries(ai.updates)) {
    if (!overwriteExisting && newData[k] !== undefined && newData[k] !== '') continue;
    newData[k] = v;
  }
  const updated = await prisma.formInstance.update({ where: { id: formInstanceId }, data: { data: newData as Prisma.JsonValue } });
  await updateRepcFromFormInstance(updated);
  res.json({ updates: ai.updates, explanation: ai.explanation, data: newData });
});

// Smart prompt bulk update
router.post('/:formInstanceId/smart-prompt', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { formInstanceId } = req.params;
  const { text } = req.body as { text: string };
  const instance = await prisma.formInstance.findUnique({ where: { id: formInstanceId }, include: { definition: true, deal: true } });
  if (!instance || instance.deal.agentId !== req.agentId) return res.status(404).json({ error: 'Form instance not found' });
  const formData: any = instance.data || {};
  const ai = await aiSmartFormPrompt({ agentId: req.agentId, formDefinition: instance.definition, formData, naturalText: text });
  const newData = { ...formData, ...ai.updates };
  const updated = await prisma.formInstance.update({ where: { id: formInstanceId }, data: { data: newData as Prisma.JsonValue } });
  await updateRepcFromFormInstance(updated);
  res.json({ updates: ai.updates, explanation: ai.explanation, data: newData });
});
