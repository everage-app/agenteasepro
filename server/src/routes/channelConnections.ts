import { Router } from 'express';
import { ChannelConnectionType } from '@prisma/client';
import { prisma } from '../lib/prisma';
export const router = Router();

type ChannelConnectionDto = {
  type: ChannelConnectionType;
  status: 'connected' | 'missing';
  displayName?: string;
  config?: any;
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
      return { type, status: 'missing' };
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
  };

  res.json(dto);
});
