import { Router } from 'express';
import { ChannelConnectionType } from '@prisma/client';
import { prisma } from '../lib/prisma';
export const router = Router();

type ChannelConnectionDto = {
  type: ChannelConnectionType;
  status: 'connected' | 'missing';
  displayName?: string;
  config?: any;
  readiness: {
    score: number;
    checks: Array<{ label: string; ok: boolean; detail?: string }>;
  };
};

const allChannelTypes: ChannelConnectionType[] = [
  'EMAIL',
  'SMS',
  'FACEBOOK',
  'INSTAGRAM',
  'LINKEDIN',
  'X',
  'WEBSITE',
];

function buildReadiness(type: ChannelConnectionType, config: any) {
  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];

  if (!config) {
    checks.push({ label: 'Connected', ok: false });
    return { score: 0, checks };
  }

  if (type === 'WEBSITE') {
    checks.push({ label: 'Webhook token', ok: Boolean(config.webhookToken) });
    checks.push({ label: 'Source label', ok: Boolean(config.defaultSourceLabel || config.primaryUrl) });
    checks.push({ label: 'First response task', ok: config.followUpEnabled !== false, detail: `${Number(config.followUpMinutes || config.slaMinutes || 15)}m` });
    checks.push({ label: 'Spam shield', ok: config.spamShieldEnabled !== false });
  } else if (type === 'EMAIL') {
    checks.push({ label: 'Sender email', ok: Boolean(config.fromEmail) });
    checks.push({ label: 'SendGrid key', ok: Boolean(process.env.SENDGRID_API_KEY || process.env.SENDGRID_KEY) });
  } else if (type === 'SMS') {
    checks.push({ label: 'Sender label', ok: Boolean(config.fromLabel) });
    checks.push({ label: 'Telnyx config', ok: Boolean(process.env.TELNYX_API_KEY && process.env.TELNYX_MESSAGING_PROFILE_ID) });
  } else {
    checks.push({ label: 'Connected account', ok: Boolean(config.displayName || config.pageName || config.accessToken) });
  }

  const passed = checks.filter((check) => check.ok).length;
  return {
    score: checks.length ? Math.round((passed / checks.length) * 100) : 0,
    checks,
  };
}

// GET /api/channels
router.get('/', async (req, res) => {
  const agentId = (req as any).agentId;
  if (!agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const connections = await prisma.agentChannelConnection.findMany({
    where: { agentId },
  });

  const dtos: ChannelConnectionDto[] = allChannelTypes.map((type) => {
    const conn = connections.find((c) => c.type === type);
    if (!conn) {
      return { type, status: 'missing', readiness: buildReadiness(type, null) };
    }
    const config = conn.config as any;
    let displayName: string | undefined;
    if (type === 'EMAIL' && config?.fromEmail) {
      displayName = config.fromEmail;
    } else if (type === 'SMS' && config?.fromLabel) {
      displayName = config.fromLabel;
    } else if (type === 'FACEBOOK' && config?.pageName) {
      displayName = config.pageName;
    } else if (type === 'INSTAGRAM' && config?.pageName) {
      displayName = config.pageName;
    } else if (type === 'LINKEDIN' && config?.displayName) {
      displayName = config.displayName;
    } else if (type === 'X' && config?.displayName) {
      displayName = config.displayName;
    } else if (type === 'WEBSITE' && config?.primaryUrl) {
      displayName = config.primaryUrl;
    }
    return {
      type,
      status: 'connected',
      displayName,
      config,
      readiness: buildReadiness(type, config),
    };
  });

  res.json(dtos);
});

// PUT /api/channels/:type
router.put('/:type', async (req, res) => {
  const agentId = (req as any).agentId;
  if (!agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type } = req.params;
  const { config } = req.body;

  if (!allChannelTypes.includes(type as ChannelConnectionType)) {
    return res.status(400).json({ error: 'Invalid channel type' });
  }

  const updated = await prisma.agentChannelConnection.upsert({
    where: {
      agentId_type: {
        agentId,
        type: type as ChannelConnectionType,
      },
    },
    create: {
      agentId,
      type: type as ChannelConnectionType,
      config,
    },
    update: {
      config,
    },
  });

  const configData = updated.config as any;
  let displayName: string | undefined;
  if (type === 'EMAIL' && configData?.fromEmail) {
    displayName = configData.fromEmail;
  } else if (type === 'SMS' && configData?.fromLabel) {
    displayName = configData.fromLabel;
  } else if (type === 'FACEBOOK' && configData?.pageName) {
    displayName = configData.pageName;
  } else if (type === 'INSTAGRAM' && configData?.pageName) {
    displayName = configData.pageName;
  } else if (type === 'LINKEDIN' && configData?.displayName) {
    displayName = configData.displayName;
  } else if (type === 'X' && configData?.displayName) {
    displayName = configData.displayName;
  } else if (type === 'WEBSITE' && configData?.primaryUrl) {
    displayName = configData.primaryUrl;
  }

  const dto: ChannelConnectionDto = {
    type: updated.type,
    status: 'connected',
    displayName,
    config: updated.config,
    readiness: buildReadiness(updated.type, updated.config),
  };

  res.json(dto);
});

// POST /api/channels/:type/test
router.post('/:type/test', async (req, res) => {
  const agentId = (req as any).agentId;
  if (!agentId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type } = req.params;
  const { testTo } = req.body;

  if (type !== 'SMS') {
    return res.status(400).json({ error: 'Only SMS test is currently supported in this route.' });
  }

  if (!testTo) {
    return res.status(400).json({ error: 'Missing "testTo" field in request body' });
  }

  try {
    const conn = await prisma.agentChannelConnection.findUnique({
      where: { agentId_type: { agentId, type: 'SMS' } }
    });
    
    if (!conn) {
      return res.status(404).json({ error: 'SMS channel not connected' });
    }

    const config = conn.config as any;
    const fromLabel = config?.fromLabel;

    // We dynamically import to avoid breaking if not used
    const { telnyxService } = await import('../services/telnyxService.js');
    const result = await telnyxService.sendSms({
      to: testTo,
      from: fromLabel,
      text: 'This is a test message from AgentEasePro integration.',
    });

    res.json({ success: true, messageId: result?.id });
  } catch (err: any) {
    console.error('Error testing SMS channel:', err);
    res.status(500).json({ error: 'Failed to send test message: ' + (err.message || 'Unknown error') });
  }
});
