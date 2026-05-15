import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { telnyxService } from '../services/telnyxService';

// We retrieve the same telnyx client that the service initialized.
// For constructEvent we just use the raw telnyx library though.
const telnyx = require('telnyx');

export const telnyxWebhookHandler = async (req: Request, res: Response) => {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;

  if (!publicKey) {
    console.error('TELNYX_PUBLIC_KEY is not defined. Cannot verify webhook signature.');
    return res.status(500).send('Webhook configuration error');
  }

  // Ensure these are accessed exactly as Telnyx sends them, usually lowercased by Express
  const signature = req.headers['telnyx-signature-ed25519'] as string;
  const timestamp = req.headers['telnyx-timestamp'] as string;

  if (!signature || !timestamp) {
    return res.status(400).send('Missing signature or timestamp headers');
  }

  let event;

  try {
    // req.body should be the raw body Buffer if we use express.raw, but if it is an object
    // (from express.json), we'd need to stringify it. We prefer to receive the raw buffer string safely.
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    // Some versions of telnyx SDK use constructEvent in webhooks namespace
    const client = telnyx(process.env.TELNYX_API_KEY || '');
    event = client.webhooks.constructEvent(rawBody, signature, timestamp, publicKey);
  } catch (err: any) {
    console.error('Telnyx webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Process the event
  console.log(`Received Telnyx event: ${event.data.event_type}`);

  try {
    switch (event.data.event_type) {
      case 'message.received':
        await handleIncomingSms(event.data.payload);
        break;
      case 'message.sent':
      case 'message.finalized':
        await handleOutboundSmsStatus(event.data.payload);
        break;
      default:
        console.log(`Unhandled Telnyx event type: ${event.data.event_type}`);
    }

    res.status(200).send('Event processed');
  } catch (error) {
    console.error('Error processing Telnyx webhook:', error);
    // Still return 200 so Telnyx doesn't retry unnecessarily unless it's a critical transient error
    res.status(200).send('Error processing event');
  }
};

async function handleIncomingSms(payload: any) {
  const { to, from, text } = payload;
  const fromNumber = from?.phone_number;
  const toNumber = to?.[0]?.phone_number;

  if (!fromNumber) return;

  console.log(`Processing incoming SMS from ${fromNumber} to ${toNumber}...`);

  // We need to figure out which contact sent this by matching the fromNumber
  // We look into both leads and clients across all agents.
  // Ideally, toNumber belongs to an agent's configured SMS channel. Let's find agent via channel config.
  const channelConnections = await prisma.agentChannelConnection.findMany({
    where: { type: 'SMS' },
  });

  let targetAgentId: string | null = null;
  for (const conn of channelConnections) {
    const config = conn.config as any;
    if (config?.fromLabel && config.fromLabel === toNumber) {
      targetAgentId = conn.agentId;
      break;
    }
  }

  if (!targetAgentId) {
    console.log(`No agent configured with Telnyx number ${toNumber}. Dropping message.`);
    return;
  }

  // Check if it's a client
  let contact = await prisma.client.findFirst({
    where: { agentId: targetAgentId, phone: fromNumber }
  });

  if (contact) {
    // Log as internal event for client (since there is no direct ClientActivity table here)
    await prisma.internalEvent.create({
      data: {
        agentId: targetAgentId,
        kind: 'inbound_sms',
        path: '/api/integrations/telnyx/events',
        meta: {
          direction: 'inbound',
          contactId: contact.id,
          contactType: 'client',
          text: text,
        }
      }
    });

    await prisma.client.update({
      where: { id: contact.id },
      data: { lastContactAt: new Date() }
    });
    return;
  }

  // Check if it's a lead
  const lead = await prisma.lead.findFirst({
    where: { agentId: targetAgentId, phone: fromNumber }
  });

  if (lead) {
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'SMS',
        description: `Incoming SMS: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
        metadata: {
          direction: 'inbound',
          text,
          messageId: payload.id,
        }
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContact: new Date() }
    });
    return;
  }

  console.log(`Message received from unknown contact ${fromNumber} for agent ${targetAgentId}.`);
  // Optional: create a new lead automatically if configured that way, or just log internal event
  await prisma.internalEvent.create({
    data: {
      agentId: targetAgentId,
      kind: 'unmatched_inbound_sms',
      path: '/api/integrations/telnyx/events',
      meta: {
        from: fromNumber,
        to: toNumber,
        text,
      }
    }
  });
}

async function handleOutboundSmsStatus(payload: any) {
  // Can be used to track delivered/failed status of outbound SMS
  const { id, to, cost, direction } = payload;
  console.log(`Status update for outbound SMS ${id} to ${to?.[0]?.phone_number}, direction: ${direction}`);
}
