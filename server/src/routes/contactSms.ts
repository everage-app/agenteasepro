import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { telnyxService } from '../services/telnyxService';

export const router = Router();

router.use(authenticateToken);

const sendContactSmsSchema = z
  .object({
    contactType: z.enum(['lead', 'client']),
    contactId: z.string().trim().min(1),
    text: z.string().trim().min(1).max(1600, 'Message text is too long'),
  })
  .strict();

async function getContact(params: {
  agentId: string;
  contactType: 'lead' | 'client';
  contactId: string;
}) {
  if (params.contactType === 'lead') {
    const lead = await prisma.lead.findFirst({
      where: { id: params.contactId, agentId: params.agentId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    if (!lead) return null;
    return {
      id: lead.id,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      phone: lead.phone,
      leadId: lead.id,
      clientId: null as string | null,
    };
  }

  const client = await prisma.client.findFirst({
    where: { id: params.contactId, agentId: params.agentId },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  if (!client) return null;

  return {
    id: client.id,
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    name: `${client.firstName} ${client.lastName}`.trim(),
    phone: client.phone,
    leadId: null as string | null,
    clientId: client.id,
  };
}

router.post('/send', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = sendContactSmsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid SMS payload', details: parsed.error });
    }

    const { contactType, contactId, text } = parsed.data;
    const agentId = req.agentId;

    const [agent, contact, smsChannel] = await Promise.all([
        prisma.agent.findUnique({
          where: { id: agentId },
          select: { id: true, email: true, name: true },
        }),
        getContact({ agentId, contactType, contactId }),
        prisma.agentChannelConnection.findUnique({
          where: { agentId_type: { agentId, type: 'SMS' } },
          select: { config: true },
        }),
      ]);

    if (!agent) return res.status(401).json({ error: 'Unauthorized' });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!contact.phone) return res.status(400).json({ error: 'Contact does not have a phone number' });

    const smsConfig = (smsChannel?.config || {}) as Record<string, unknown>;
    const fromLabel = typeof smsConfig.fromLabel === 'string' && smsConfig.fromLabel.trim().length > 0 
      ? smsConfig.fromLabel.trim() 
      : undefined;

    let sendResult;
    let success = false;
    let messageId = null;
    let errorMsg = null;

    try {
      sendResult = await telnyxService.sendSms({
        to: contact.phone,
        from: fromLabel,
        text,
      });
      success = true;
      messageId = sendResult?.id || null;
    } catch (err: any) {
      errorMsg = err.message || 'Telnyx sending failed';
    }

    const sentAt = new Date();

    await prisma.internalEvent.create({
      data: {
        agentId,
        kind: success ? 'contact_sms_sent' : 'contact_sms_failed',
        path: '/api/contact-sms/send',
        meta: {
          contactType,
          contactId,
          contactPhone: contact.phone,
          contactName: contact.name,
          text,
          fromLabel,
          messageId,
          error: errorMsg,
        },
      },
    });

    if (contactType === 'lead' && contact.leadId) {
      await prisma.leadActivity.create({
        data: {
          leadId: contact.leadId,
          activityType: 'SMS',
          description: success
            ? `SMS sent: ${text.substring(0, 50)}...`
            : `SMS failed: ${errorMsg}`,
          metadata: {
            source: 'contact_sms',
            messageId,
          },
        },
      });

      if (success) {
        await prisma.lead.update({
          where: { id: contact.leadId },
          data: { lastContact: sentAt },
        });
      }
    }

    if (contactType === 'client' && contact.clientId && success) {
      await prisma.client.update({
        where: { id: contact.clientId },
        data: { lastContactAt: sentAt },
      });
    }

    if (!success) {
      return res.status(502).json({ error: errorMsg || 'Failed to send SMS' });
    }

    return res.status(201).json({
      ok: true,
      messageId,
      sentAt: sentAt.toISOString(),
    });
  } catch (error) {
    console.error('Error sending contact sms:', error);
    return res.status(500).json({ error: 'Failed to send contact SMS' });
  }
});
