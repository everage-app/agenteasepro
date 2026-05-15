import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getWebhooks(req: AuthenticatedRequest, res: Response) {
  try {
    const webhooks = await prisma.webhookSubscription.findMany({
      where: { agentId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(webhooks);
  } catch (error) {
    console.error('Failed to get webhook subscriptions:', error);
    res.status(500).json({ error: 'Failed to retrieve webhooks' });
  }
}

export async function createWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const { url, events, secret } = req.body;

    const webhook = await prisma.webhookSubscription.create({
      data: {
        agentId: req.user!.id,
        url,
        events: events || [],
        secret: secret || null,
      },
    });

    res.status(201).json(webhook);
  } catch (error) {
    console.error('Failed to create webhook subscription:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
}

export async function updateWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { url, events, secret, isActive } = req.body;

    const webhook = await prisma.webhookSubscription.update({
      where: { id, agentId: req.user!.id },
      data: {
        url,
        events,
        secret,
        isActive,
      },
    });

    res.json(webhook);
  } catch (error) {
    console.error('Failed to update webhook subscription:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
}

export async function deleteWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await prisma.webhookSubscription.delete({
      where: { id, agentId: req.user!.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete webhook subscription:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
}