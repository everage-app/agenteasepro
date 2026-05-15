import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { BillingMode, SubscriptionStatus } from '@prisma/client';

export const router = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    })
  : null;

const DEFAULT_MONTHLY_PRICE_DOLLARS = 49.99;
const DEFAULT_MONTHLY_PRICE_CENTS = 4999;
const BILLING_TRIAL_DAYS = 7;

const PLAN_DETAILS = {
  name: 'AgentEasePro',
  price: DEFAULT_MONTHLY_PRICE_DOLLARS,
  interval: 'month',
  currency: 'usd',
  features: [
    'Unlimited deals and clients',
    'AI-powered task generation',
    'Priority Action Center',
    'E-signature & REPC automation',
    'Multi-channel marketing blasts',
    'Calendar & task sync',
    'MLS/IDX integration',
    'Lead capture landing pages',
    'Win the Day goal tracking',
    'Referral network CRM',
    'Email & SMS notifications',
    'Data export & backup',
  ],
};

function baseUrlForRequest(req: Request) {
  const envUrl = (process.env.PUBLIC_APP_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  const origin = (req.headers.origin || '').toString().trim();
  return origin ? origin.replace(/\/$/, '') : '';
}

function mapStripeStatusToSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'TRIAL';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    default:
      return 'PAST_DUE';
  }
}

function mapDbSubscriptionStatusToUi(status: SubscriptionStatus): 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' {
  switch (status) {
    case 'TRIAL':
      return 'trialing';
    case 'ACTIVE':
      return 'active';
    case 'PAST_DUE':
      return 'past_due';
    case 'CANCELED':
      return 'canceled';
    default:
      return 'incomplete';
  }
}

async function getAgentBillingContext(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      billingMode: true,
      billingCustomPriceCents: true,
      billingAccessOverride: true,
    },
  });
  return agent;
}

async function ensureStripeCustomer(agent: {
  id: string;
  email: string;
  name: string | null;
  stripeCustomerId: string | null;
}) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  let customerId = agent.stripeCustomerId;

  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if ((existing as Stripe.DeletedCustomer).deleted) {
        customerId = null;
      }
    } catch (error: any) {
      const code = error?.code;
      if (code === 'resource_missing') {
        customerId = null;
      } else {
        throw error;
      }
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agent.email,
      name: agent.name,
      metadata: { agentId: agent.id },
    });
    customerId = customer.id;
    await prisma.agent.update({ where: { id: agent.id }, data: { stripeCustomerId: customerId } });
  }

  return customerId;
}

function planForBillingMode(mode: BillingMode, billingCustomPriceCents: number | null) {
  if (mode === 'FREE') {
    return {
      ...PLAN_DETAILS,
      name: 'AgentEasePro (Free)',
      price: 0,
    };
  }
  if (mode === 'CUSTOM' && typeof billingCustomPriceCents === 'number' && billingCustomPriceCents > 0) {
    return {
      ...PLAN_DETAILS,
      name: 'AgentEasePro (Custom)',
      price: Number((billingCustomPriceCents / 100).toFixed(2)),
    };
  }
  return PLAN_DETAILS;
}

function isUiAccessBlocked(status: string, billingMode: BillingMode, billingAccessOverride: boolean) {
  if (billingAccessOverride) return false;
  if (billingMode === 'FREE') return false;
  return status !== 'active' && status !== 'trialing';
}

// Get current subscription status
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;
    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Free accounts are handled in-app (no Stripe checkout required).
    if (agent.billingMode === 'FREE') {
      return res.json({
        status: 'active',
        plan: planForBillingMode(agent.billingMode, agent.billingCustomPriceCents ?? null),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        accessBlocked: false,
      });
    }

    // If Stripe is configured and we have a subscription ID, return real data.
    if (stripe && agent.stripeSubscriptionId) {
      try {
        const subResp = await stripe.subscriptions.retrieve(agent.stripeSubscriptionId, {
          expand: ['items.data.price'],
        });
        const sub = subResp as unknown as Stripe.Subscription;

        const firstItem = sub.items.data[0];
        const price = firstItem?.price;
        const unitAmount = typeof price?.unit_amount === 'number' ? price.unit_amount : null;
        const interval = price?.recurring?.interval || 'month';
        const itemPeriodStart = typeof (firstItem as any)?.current_period_start === 'number' ? (firstItem as any).current_period_start : null;
        const itemPeriodEnd = typeof (firstItem as any)?.current_period_end === 'number' ? (firstItem as any).current_period_end : null;

        const mappedStatus = mapStripeStatusToSubscriptionStatus(sub.status);
        // Best-effort keep DB in sync if it drifts.
        if (mappedStatus !== agent.subscriptionStatus) {
          await prisma.agent.update({ where: { id: agentId }, data: { subscriptionStatus: mappedStatus } });
        }

        return res.json({
          status: sub.status,
          plan: {
            ...PLAN_DETAILS,
            price: unitAmount != null ? Number((unitAmount / 100).toFixed(2)) : PLAN_DETAILS.price,
            interval,
          },
          currentPeriodStart: new Date(((itemPeriodStart ?? Math.floor(Date.now() / 1000)) as number) * 1000).toISOString(),
          currentPeriodEnd: new Date(((itemPeriodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) as number) * 1000).toISOString(),
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          accessBlocked: isUiAccessBlocked(sub.status, agent.billingMode, agent.billingAccessOverride),
        });
      } catch (err) {
        console.warn('Stripe subscription lookup failed; falling back to DB status', err);
      }
    }

    const trialStart = agent.createdAt;
    const trialEndDate = new Date(trialStart.getTime() + BILLING_TRIAL_DAYS * 24 * 60 * 60 * 1000);
    let effectiveDbStatus = agent.subscriptionStatus;

    if (agent.subscriptionStatus === 'TRIAL' && trialEndDate.getTime() <= Date.now()) {
      effectiveDbStatus = 'PAST_DUE';
      try {
        await prisma.agent.update({ where: { id: agentId }, data: { subscriptionStatus: 'PAST_DUE' } });
      } catch (err) {
        console.warn('Failed to persist trial expiry status transition:', err);
      }
    }

    const fallbackUiStatus = mapDbSubscriptionStatusToUi(effectiveDbStatus);

    // Fallback: DB-driven subscription state (used when Stripe isn't configured or not linked yet).
    return res.json({
      status: fallbackUiStatus,
      plan: planForBillingMode(agent.billingMode, agent.billingCustomPriceCents ?? null),
      currentPeriodStart: trialStart.toISOString(),
      currentPeriodEnd: trialEndDate.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: effectiveDbStatus === 'TRIAL' ? trialEndDate.toISOString() : null,
      accessBlocked: isUiAccessBlocked(fallbackUiStatus, agent.billingMode, agent.billingAccessOverride),
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get billing/payment info
router.get('/payment-method', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;
    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.billingMode === 'FREE') {
      return res.json(null);
    }

    if (!stripe || !agent.stripeCustomerId) {
      return res.json(null);
    }

    // Prefer the customer's default payment method if present.
    const customer = await stripe.customers.retrieve(agent.stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if ((customer as any).deleted) return res.json(null);

    const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    const pm =
      defaultPm && typeof defaultPm !== 'string'
        ? (defaultPm as Stripe.PaymentMethod)
        : (await stripe.paymentMethods.list({ customer: agent.stripeCustomerId, type: 'card', limit: 1 })).data[0];

    if (!pm || pm.type !== 'card' || !pm.card) return res.json(null);

    return res.json({
      type: pm.type,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      },
    });
  } catch (error) {
    console.error('Error fetching payment method:', error);
    res.status(500).json({ error: 'Failed to fetch payment method' });
  }
});

// Get invoices
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;
    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.billingMode === 'FREE') {
      return res.json([]);
    }

    if (!stripe || !agent.stripeCustomerId) {
      return res.json([]);
    }

    const invoices = await stripe.invoices.list({ customer: agent.stripeCustomerId, limit: 12 });
    const paidInvoices = invoices.data.filter(
      (inv) => inv.status === 'paid' && typeof inv.amount_paid === 'number' && inv.amount_paid > 0
    );

    return res.json(
      paidInvoices.map((inv) => ({
        id: inv.id,
        date: new Date(inv.created * 1000).toISOString(),
        amount: inv.amount_paid,
        status: inv.status || 'unknown',
        pdfUrl: inv.invoice_pdf || inv.hosted_invoice_url || null,
      }))
    );
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Create checkout session for new subscription
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;
    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.billingMode === 'FREE') {
      return res.status(400).json({ error: 'Billing disabled', message: 'This account is on a free plan and does not require checkout.' });
    }

    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payment processing is not yet available. Please contact support.',
      });
    }

    const baseUrl = baseUrlForRequest(req);
    if (!baseUrl) {
      return res.status(400).json({ error: 'Missing base URL', message: 'Unable to determine app URL for Stripe redirect.' });
    }

    const customerId = await ensureStripeCustomer(agent);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (agent.billingMode === 'CUSTOM') {
      const cents = agent.billingCustomPriceCents;
      if (typeof cents !== 'number' || cents < 100) {
        return res.status(400).json({ error: 'Invalid custom price', message: 'Owner-configured custom price is missing or too low.' });
      }
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cents,
          recurring: { interval: 'month' },
          product_data: { name: 'AgentEasePro (Custom)' },
        },
      });
    } else {
      if (!STRIPE_PRICE_ID) {
        return res.status(503).json({
          error: 'Stripe price not configured',
          message: 'Set STRIPE_PRICE_ID to your $49.99/month Price ID in Stripe.',
        });
      }
      line_items.push({ price: STRIPE_PRICE_ID, quantity: 1 });
    }

    const shouldApplyTrial = !agent.stripeSubscriptionId && agent.subscriptionStatus === 'TRIAL';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items,
      success_url: `${baseUrl}/settings/billing?success=1`,
      cancel_url: `${baseUrl}/settings/billing?canceled=1`,
      allow_promotion_codes: true,
      payment_method_collection: 'always',
      billing_address_collection: 'auto',
      metadata: { agentId },
      subscription_data: {
        metadata: { agentId },
        ...(shouldApplyTrial ? { trial_period_days: BILLING_TRIAL_DAYS } : {}),
      },
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create portal session for managing subscription
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;
    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.billingMode === 'FREE') {
      return res.status(400).json({ error: 'Billing disabled', message: 'This account is on a free plan and has no Stripe billing portal.' });
    }

    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Billing portal is not yet available. Please contact support.',
      });
    }

    const customerId = await ensureStripeCustomer(agent);

    const baseUrl = baseUrlForRequest(req);
    if (!baseUrl) {
      return res.status(400).json({ error: 'Missing base URL', message: 'Unable to determine app URL for Stripe redirect.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings/billing`,
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Create setup session for adding payment method only (no subscription)
router.post('/create-setup-session', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;
    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.billingMode === 'FREE') {
      return res.status(400).json({ error: 'Billing disabled', message: 'This account is on a free plan and does not require payment setup.' });
    }

    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payment setup is not yet available. Please contact support.',
      });
    }

    const baseUrl = baseUrlForRequest(req);
    if (!baseUrl) {
      return res.status(400).json({ error: 'Missing base URL', message: 'Unable to determine app URL for Stripe redirect.' });
    }

    const customerId = await ensureStripeCustomer(agent);

    // Create a checkout session in setup mode to collect payment method
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: `${baseUrl}/settings/billing?setup_success=1`,
      cancel_url: `${baseUrl}/settings/billing?setup_canceled=1`,
      metadata: { agentId },
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating setup session:', error);
    res.status(500).json({ error: 'Failed to create setup session' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;
    const { immediately } = z.object({ immediately: z.boolean().optional() }).parse(req.body || {});

    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.billingMode === 'FREE') {
      return res.status(400).json({ error: 'Billing disabled', message: 'This account is on a free plan.' });
    }

    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Subscription management is not yet available.',
      });
    }

    if (!agent.stripeSubscriptionId) {
      return res.status(400).json({ error: 'Missing subscription', message: 'No Stripe subscription found for this account yet.' });
    }

    if (immediately) {
      await stripe.subscriptions.cancel(agent.stripeSubscriptionId);
    } else {
      await stripe.subscriptions.update(agent.stripeSubscriptionId, { cancel_at_period_end: true });
    }

    return res.json({ success: true, message: immediately ? 'Subscription canceled' : 'Subscription will be canceled at period end' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
router.post('/reactivate-subscription', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId as string;

    const agent = await getAgentBillingContext(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (agent.billingMode === 'FREE') {
      return res.status(400).json({ error: 'Billing disabled', message: 'This account is on a free plan.' });
    }

    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Subscription management is not yet available.',
      });
    }

    if (!agent.stripeSubscriptionId) {
      return res.status(400).json({ error: 'Missing subscription', message: 'No Stripe subscription found for this account yet.' });
    }

    await stripe.subscriptions.update(agent.stripeSubscriptionId, { cancel_at_period_end: false });
    return res.json({ success: true, message: 'Subscription reactivated' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Stripe webhook handler (no auth required)
export const webhookHandler = async (req: Request, res: Response) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || Array.isArray(sig)) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as any, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed', err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'Invalid signature'}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'setup' && session.setup_intent && session.customer) {
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
          const setupIntentId = typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent.id;

          try {
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
            if (setupIntent.payment_method) {
              const paymentMethodId =
                typeof setupIntent.payment_method === 'string'
                  ? setupIntent.payment_method
                  : setupIntent.payment_method.id;

              await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });
            }
          } catch (err) {
            console.warn('Failed to set default payment method from setup session:', err);
          }
          break;
        }

        const agentId = session.metadata?.agentId;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        let mappedStatus: SubscriptionStatus = 'ACTIVE';
        if (subscriptionId) {
          try {
            const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
            mappedStatus = mapStripeStatusToSubscriptionStatus(sub.status);
          } catch (err) {
            console.warn('Failed to retrieve subscription after checkout completion:', err);
          }
        }

        if (agentId && customerId) {
          await prisma.agent.update({
            where: { id: agentId },
            data: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId || undefined,
              subscriptionStatus: mappedStatus,
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const agentId = sub.metadata?.agentId;
        const dbStatus = mapStripeStatusToSubscriptionStatus(sub.status);

        if (agentId) {
          await prisma.agent.update({
            where: { id: agentId },
            data: {
              stripeCustomerId: customerId || undefined,
              stripeSubscriptionId: sub.id,
              subscriptionStatus: dbStatus,
            },
          });
        } else if (customerId) {
          await prisma.agent.updateMany({
            where: { stripeCustomerId: customerId },
            data: { stripeSubscriptionId: sub.id, subscriptionStatus: dbStatus },
          });
        }
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const invoiceAny = invoice as any;
        const subscriptionRef = invoiceAny?.subscription;
        const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
        let nextStatus: SubscriptionStatus = event.type === 'invoice.payment_succeeded' ? 'ACTIVE' : 'PAST_DUE';

        if (subscriptionId) {
          try {
            const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
            nextStatus = mapStripeStatusToSubscriptionStatus(sub.status);
          } catch (err) {
            console.warn('Failed to resolve subscription status from invoice webhook:', err);
          }
        }

        if (customerId) {
          await prisma.agent.updateMany({
            where: { stripeCustomerId: customerId },
            data: { subscriptionStatus: nextStatus },
          });
        }
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
};

export default router;
