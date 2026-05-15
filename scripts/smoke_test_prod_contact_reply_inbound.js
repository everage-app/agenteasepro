#!/usr/bin/env node
const crypto = require('crypto');
const { execSync } = require('child_process');

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hmacBase64url(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function cfg(key) {
  try {
    return execSync(`heroku config:get ${key} -a agenteasepro`, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

async function main() {
  const baseUrl = arg('base-url', 'https://app.agenteasepro.com').replace(/\/$/, '');
  const api = `${baseUrl}/api`;
  const email = arg('email', process.env.PW_TEST_EMAIL || '');
  const password = arg('password', process.env.PW_TEST_PASSWORD || '');
  const leadSearch = arg('lead-search', '@');

  if (!email || !password) {
    throw new Error('Usage: node scripts/smoke_test_prod_contact_reply_inbound.js --email <email> --password <password> [--base-url ...] [--lead-search ...]');
  }

  const replyDomain = cfg('SENDGRID_INBOUND_REPLY_DOMAIN');
  const replySecret = cfg('SENDGRID_REPLY_TOKEN_SECRET');
  const inboundSecret = cfg('SENDGRID_INBOUND_PARSE_SECRET');

  if (!replyDomain || !replySecret || !inboundSecret) {
    throw new Error('Missing required production config values for inbound reply smoke test');
  }

  const loginResp = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginResp.json();
  if (!loginResp.ok || !loginJson?.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginJson)}`);
  }
  const token = loginJson.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const meResp = await fetch(`${api}/auth/me`, { headers: authHeaders });
  const meJson = await meResp.json();
  if (!meResp.ok || !meJson?.agent?.id) throw new Error('Failed to fetch /auth/me');
  const agentId = meJson.agent.id;

  const leadsResp = await fetch(`${api}/leads?search=${encodeURIComponent(leadSearch)}`, { headers: authHeaders });
  const leadsJson = await leadsResp.json();
  if (!leadsResp.ok || !Array.isArray(leadsJson)) throw new Error('Failed to load leads');
  const lead = leadsJson.find((l) => l?.email);
  if (!lead?.id || !lead?.email) throw new Error('No lead with email found for smoke test');

  const payloadObj = { a: agentId, t: 'lead', c: lead.id, iat: Date.now() };
  const payloadB64 = base64url(JSON.stringify(payloadObj));
  const sig = hmacBase64url(replySecret, payloadB64);
  const replyToken = `${payloadB64}.${sig}`;
  const toAddress = `reply+${replyToken}@${replyDomain}`;
  const inboundMessageId = `inbound-smoke-${Date.now()}@agenteasepro.com`;

  const form = new FormData();
  form.append('to', toAddress);
  form.append('from', lead.email);
  form.append('subject', 'Inbound reply smoke test');
  form.append('text', 'Hi agent, this is an inbound reply smoke test from production.');
  form.append('headers', `Message-ID: <${inboundMessageId}>\nFrom: ${lead.email}\nTo: ${toAddress}`);

  const inboundResp = await fetch(`${api}/integrations/sendgrid/inbound`, {
    method: 'POST',
    headers: { 'x-agentease-webhook-secret': inboundSecret },
    body: form,
  });
  const inboundJson = await inboundResp.json();
  if (!inboundResp.ok || !inboundJson?.ok) {
    throw new Error(`Inbound webhook failed: ${JSON.stringify(inboundJson)}`);
  }

  await new Promise((r) => setTimeout(r, 1500));

  const historyResp = await fetch(`${api}/contact-email/history?contactType=lead&contactId=${encodeURIComponent(lead.id)}`, {
    headers: authHeaders,
  });
  const historyJson = await historyResp.json();
  if (!historyResp.ok || !Array.isArray(historyJson?.items)) {
    throw new Error('Failed to fetch contact email history');
  }

  const replyItem = historyJson.items.find((item) => item?.kind === 'reply');

  console.log('INBOUND_SMOKE_OK=true');
  console.log(`LEAD=${lead.firstName || ''} ${lead.lastName || ''} <${lead.email}>`.trim());
  console.log(`REPLY_FOUND=${Boolean(replyItem)}`);
  if (replyItem) {
    console.log(`REPLY_AT=${replyItem.at}`);
    console.log(`REPLY_SUBJECT=${replyItem.subject || ''}`);
    console.log(`REPLY_SNIPPET=${replyItem.snippet || ''}`);
    console.log(`REPLY_FROM=${replyItem.fromEmail || ''}`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
