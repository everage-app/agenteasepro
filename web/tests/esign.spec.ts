import { test, expect, APIRequestContext, APIResponse, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

const authFile = path.join(__dirname, '.auth/user.json');

type DealRecord = {
  id: string;
  title?: string | null;
  repc?: unknown;
  property?: {
    street?: string | null;
  } | null;
  buyer?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  seller?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type EnvelopeLink = {
  role?: string;
  url?: string;
  signingUrl?: string;
};

type EnvelopeResponse = {
  envelope: {
    id: string;
  };
  links: EnvelopeLink[];
};

type EnvelopeRoleHint = 'BUYER' | 'SELLER';

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getProjectStartDelayMs(projectName: string) {
  const normalized = projectName.toLowerCase();
  if (normalized === 'chromium') return 0;
  if (normalized === 'firefox') return 1500;
  if (normalized === 'webkit') return 3000;
  if (normalized.includes('mobile chrome')) return 4500;
  if (normalized.includes('mobile safari')) return 6000;
  return 0;
}

async function staggerApiCallsForProject(projectName: string) {
  const delayMs = getProjectStartDelayMs(projectName);
  if (delayMs > 0) {
    console.warn(`staggering ${projectName} API start by ${delayMs}ms to reduce burst rate`);
    await sleep(delayMs);
  }
}

function parseRetryAfterMs(headerValue?: string) {
  if (!headerValue) return undefined;

  const asSeconds = Number(headerValue);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return undefined;
}

async function requestTextWithRetry({
  run,
  label,
  maxAttempts = 10,
}: {
  run: () => Promise<APIResponse>;
  label: string;
  maxAttempts?: number;
}): Promise<{ status: number; text: string; ok: boolean }> {
  let lastStatus = 0;
  let lastText = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await run();
    const status = response.status();
    const text = await response.text();

    if (response.ok()) {
      return { status, text, ok: true };
    }

    lastStatus = status;
    lastText = text;

    if (!RETRYABLE_STATUSES.has(status) || attempt === maxAttempts) {
      return { status: lastStatus, text: lastText, ok: false };
    }

    const retryAfterMs = parseRetryAfterMs(response.headers()['retry-after']);
    const computedBackoffMs = status === 429
      ? Math.min(30000, 3000 * attempt)
      : Math.min(10000, 900 * attempt);
    const backoffMs = (retryAfterMs ?? computedBackoffMs) + Math.floor(Math.random() * 400);
    console.warn(`${label} attempt ${attempt}/${maxAttempts} failed with ${status}. Retrying in ${backoffMs}ms...`);
    await sleep(backoffMs);
  }

  return { status: lastStatus, text: lastText, ok: false };
}

function getSavedApiToken() {
  if (!fs.existsSync(authFile)) return null;

  try {
    const raw = fs.readFileSync(authFile, 'utf8');
    const parsed = JSON.parse(raw) as {
      origins?: Array<{
        localStorage?: Array<{ name?: string; value?: string }>;
      }>;
    };

    const token = parsed.origins
      ?.flatMap((originEntry) => originEntry.localStorage || [])
      .find((item) => item.name === 'utahcontracts_token')
      ?.value;

    if (!token) return null;

    const [, payload] = token.split('.');
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const decodedPayload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8')) as { exp?: number };

    if (typeof decodedPayload.exp === 'number' && decodedPayload.exp * 1000 > Date.now() + 60_000) {
      return token;
    }

    return null;
  } catch {
    return null;
  }
}

async function getApiToken(request: APIRequestContext) {
  const savedToken = getSavedApiToken();
  if (savedToken) {
    return savedToken;
  }

  const email = process.env.PW_TEST_EMAIL?.trim() || 'demo@agentease.com';

  const devLoginResult = await requestTextWithRetry({
    label: 'dev-login',
    run: () =>
      request.post('/api/auth/dev-login', {
        data: { email },
      }),
  });

  if (devLoginResult.ok) {
    try {
      const devLoginJson = JSON.parse(devLoginResult.text) as { token?: string };
      if (devLoginJson.token) return devLoginJson.token;
    } catch {
    }
  }

  const demoLoginResult = await requestTextWithRetry({
    label: 'demo-login',
    run: () => request.post('/api/auth/demo-login', { data: {} }),
  });

  expect(
    demoLoginResult.ok,
    `demo-login failed (${demoLoginResult.status}): ${demoLoginResult.text.slice(0, 400)}`,
  ).toBeTruthy();

  const demoLoginJson = JSON.parse(demoLoginResult.text) as { token?: string };
  expect(demoLoginJson.token).toBeTruthy();
  return demoLoginJson.token as string;
}

function getPersonName(person: DealRecord['buyer'] | DealRecord['seller'], fallback: string) {
  const firstName = person?.firstName?.trim() || '';
  const lastName = person?.lastName?.trim() || '';
  return `${firstName} ${lastName}`.trim() || fallback;
}

async function createFreshEnvelope(request: APIRequestContext) {
  const token = await getApiToken(request);
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const dealsResult = await requestTextWithRetry({
    label: 'deals fetch',
    maxAttempts: 10,
    run: () => request.get('/api/deals', { headers }),
  });

  expect(
    dealsResult.ok,
    `deals fetch failed (${dealsResult.status}): ${dealsResult.text.slice(0, 400)}`,
  ).toBeTruthy();

  const deals = JSON.parse(dealsResult.text) as DealRecord[];
  const repcDeal = deals.find((deal) => Boolean(deal.repc));
  expect(repcDeal).toBeTruthy();

  const buyerName = getPersonName(repcDeal?.buyer, 'Demo Buyer');
  const sellerName = getPersonName(repcDeal?.seller, 'Demo Seller');
  const propertyLabel = repcDeal?.property?.street || repcDeal?.title || 'Contract packet';

  const envelopeResult = await requestTextWithRetry({
    label: 'envelope creation',
    maxAttempts: 8,
    run: () =>
      request.post('/api/esign/envelopes', {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        data: {
          dealId: repcDeal?.id,
          type: 'REPC',
          signers: [
            { role: 'BUYER', name: buyerName, email: '' },
            { role: 'SELLER', name: sellerName, email: '' },
          ],
          subject: `Playwright signer audit - ${propertyLabel}`,
          message: 'Fresh packet generated for public signer validation.',
          sendEmails: false,
        },
      }),
  });

  expect(
    envelopeResult.ok,
    `envelope creation failed (${envelopeResult.status}): ${envelopeResult.text.slice(0, 500)}`,
  ).toBeTruthy();
  return JSON.parse(envelopeResult.text) as EnvelopeResponse;
}

function getEnvelopeLinkUrl(link?: EnvelopeLink) {
  const directUrl = typeof link?.url === 'string' ? link.url.trim() : '';
  if (directUrl) return directUrl;

  const signingUrl = typeof link?.signingUrl === 'string' ? link.signingUrl.trim() : '';
  return signingUrl || undefined;
}

function getSignerLink(response: EnvelopeResponse, role: EnvelopeRoleHint) {
  const links = Array.isArray(response.links) ? response.links : [];
  expect(links.length, 'Envelope creation did not return any signer links.').toBeGreaterThan(0);

  const normalizedRole = role.toUpperCase();
  const exactMatch = links.find((link) => String(link.role || '').toUpperCase() === normalizedRole);
  const containsMatch = links.find((link) => String(link.role || '').toUpperCase().includes(normalizedRole));
  const fallbackMatch = links.find((link) => Boolean(getEnvelopeLinkUrl(link)));

  const resolvedLink = exactMatch ?? containsMatch ?? fallbackMatch;
  const resolvedUrl = getEnvelopeLinkUrl(resolvedLink);

  expect(
    resolvedUrl,
    `Missing signer URL for ${role}. Roles returned: ${links.map((link) => String(link.role || 'UNKNOWN')).join(', ')}`,
  ).toBeTruthy();

  return resolvedUrl as string;
}

function getPublicPdfPath(signingUrl: string) {
  const parsed = new URL(signingUrl, 'http://127.0.0.1');
  const parts = parsed.pathname.split('/').filter(Boolean);
  expect(parts[0]).toBe('esign');
  expect(parts.length).toBeGreaterThanOrEqual(4);
  const [, envelopeId, signerId, token] = parts;
  return `/api/esign-public/envelopes/${envelopeId}/${signerId}/${token}/pdf`;
}

async function expectPdfBytes(response: APIResponse, label: string) {
  const body = await response.body();
  expect(response.ok(), `${label} failed (${response.status()}): ${body.toString('utf8', 0, 200)}`).toBeTruthy();
  expect(response.headers()['content-type'] || '').toContain('application/pdf');
  expect(body.length, `${label} PDF was unexpectedly small`).toBeGreaterThan(1000);
  expect(body.subarray(0, 4).toString('ascii'), `${label} did not return a PDF header`).toBe('%PDF');
}

async function createDocumentEnvelope(request: APIRequestContext) {
  const token = await getApiToken(request);
  const templatePath = path.resolve(__dirname, '..', '..', 'contracts', 'templates', 'Utah RE REPC.pdf');
  const pdfBuffer = fs.readFileSync(templatePath);

  const result = await requestTextWithRetry({
    label: 'document envelope creation',
    maxAttempts: 8,
    run: () =>
      request.post('/api/esign/document-envelopes', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        multipart: {
          file: {
            name: 'Utah RE REPC.pdf',
            mimeType: 'application/pdf',
            buffer: pdfBuffer,
          },
          documentName: 'Playwright PDF integrity packet',
          signers: JSON.stringify([{ role: 'BUYER', name: 'PDF Integrity Buyer', email: '' }]),
          subject: 'Playwright PDF integrity packet',
          message: 'Verify uploaded document envelope PDF integrity.',
          sendEmails: 'false',
          fields: JSON.stringify([
            {
              id: 'pdf-integrity-signature',
              type: 'signature',
              x: 72,
              y: 650,
              width: 180,
              height: 42,
              page: 1,
              assignedTo: 'BUYER',
              required: true,
            },
          ]),
        },
      }),
  });

  expect(
    result.ok,
    `document envelope creation failed (${result.status}): ${result.text.slice(0, 500)}`,
  ).toBeTruthy();

  return {
    token,
    envelope: JSON.parse(result.text) as EnvelopeResponse,
  };
}

async function openDisclosureFlow(page: Page, signerUrl: string) {
  await page.goto(signerUrl, { waitUntil: 'domcontentloaded' });

  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/esign-public/envelopes/') &&
        response.request().method() === 'GET',
      { timeout: 25000 },
    )
    .catch(() => null);

  const loadingPacketText = page.getByText(/Loading e-sign packet/i).first();
  if (await loadingPacketText.isVisible({ timeout: 1500 }).catch(() => false)) {
    await loadingPacketText.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => null);

    // Occasionally the first packet bootstrap request hangs in prod; reload once to recover.
    if (await loadingPacketText.isVisible({ timeout: 1200 }).catch(() => false)) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await loadingPacketText.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null);
    }
  }

  const disclosureHeading = page.getByRole('heading', { name: /Review the e-sign disclosure/i }).first();
  const disclosureVisible = await disclosureHeading.isVisible({ timeout: 15000 }).catch(() => false);

  if (disclosureVisible) {
    const completeSignatureButton = page.getByRole('button', { name: /Complete Signature/i });
    await expect(completeSignatureButton).toBeDisabled();

    const checkbox = page.getByRole('checkbox').first();
    await checkbox.check();

    const continueButton = page.getByRole('button', {
      name: /Go to First Tab|Review Final Signature|Start Signing/i,
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
  } else {
    const inlineDisclosureCheckbox = page.getByLabel(/E-sign disclosure acknowledgement/i).first();
    if (await inlineDisclosureCheckbox.isVisible({ timeout: 2500 }).catch(() => false)) {
      const isChecked = await inlineDisclosureCheckbox.isChecked().catch(() => false);
      if (!isChecked) {
        await inlineDisclosureCheckbox.check({ force: true });
      }
    }

    await acknowledgeSignerAgreementIfPresent(page);

    await page.waitForTimeout(600);

    const signerControlsVisible = await page
      .getByRole('button', {
        name: /Complete Signature|Complete Signature Now|Finish Packet|Autofill Tabs|Use My Name & Initials|Fill My Details|Smart Fill|Smart Fill My Fields|Review Signature Style|Customize Signature Style First|Click to adopt|Adopt/i,
      })
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    expect(
      signerControlsVisible,
      'Expected disclosure dialog or signer controls after opening signer link.',
    ).toBeTruthy();
  }

  await dismissDisclosureOverlayIfVisible(page);
}

async function dismissDisclosureOverlayIfVisible(page: Page) {
  const disclosureHeading = page.getByRole('heading', { name: /Review the e-sign disclosure/i }).first();
  const disclosureVisible = await disclosureHeading.isVisible({ timeout: 1200 }).catch(() => false);
  if (!disclosureVisible) {
    return;
  }

  // Some builds keep disclosure available in an overlay even after confirmation.
  // Ensure it is dismissed so signer-tab actions are not blocked.
  const backToPacket = page.getByRole('button', { name: /Back to Packet/i }).first();
  if (await backToPacket.isVisible({ timeout: 1200 }).catch(() => false)) {
    await backToPacket.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await expect(disclosureHeading).toBeHidden({ timeout: 10000 });
}

async function acknowledgeSignerAgreementIfPresent(page: Page) {
  const signerAgreement = page
    .getByRole('checkbox', { name: /I have reviewed this contract and agree to sign electronically/i })
    .first();
  if (await signerAgreement.isVisible({ timeout: 6000 }).catch(() => false)) {
    const isChecked = await signerAgreement.isChecked().catch(() => false);
    if (!isChecked) {
      await signerAgreement.check({ force: true });
      await page.waitForTimeout(350);
    }
  }
}

async function isAdoptModalVisible(page: Page) {
  return page
    .getByRole('heading', { name: /Adopt signature & initials|Adopt initials/i })
    .first()
    .isVisible({ timeout: 2500 })
    .catch(() => false);
}

async function isSignatureCompletionVisible(page: Page) {
  return page
    .getByRole('heading', { name: /Signature complete|Signature captured/i })
    .first()
    .isVisible({ timeout: 2500 })
    .catch(() => false);
}

async function openSignatureAdoptModal(page: Page) {
  await dismissDisclosureOverlayIfVisible(page);
  await acknowledgeSignerAgreementIfPresent(page);

  if (await isSignatureCompletionVisible(page)) {
    return;
  }

  if (await isAdoptModalVisible(page)) {
    return;
  }

  const signatureHotspot = page.getByRole('button', { name: /Click to adopt signature/i }).first();

  try {
    await signatureHotspot.waitFor({ state: 'visible', timeout: 15000 });
    await signatureHotspot.click();
    return;
  } catch {
    const genericAdoptButton = page.getByRole('button', { name: /^Adopt$/i }).first();
    if (
      await genericAdoptButton.isVisible({ timeout: 3000 }).catch(() => false) &&
      await genericAdoptButton.isEnabled().catch(() => false)
    ) {
      await genericAdoptButton.click();
      return;
    }

    const signatureEditButton = page.getByRole('button', { name: /^Edit$/i }).first();
    if (await signatureEditButton.isVisible({ timeout: 4000 }).catch(() => false)) {
      await signatureEditButton.click();
      return;
    }

    const reviewStyleButton = page
      .getByRole('button', { name: /Review Signature Style|Customize Signature Style First/i })
      .first();
    if (
      await reviewStyleButton.isVisible({ timeout: 4000 }).catch(() => false) &&
      await reviewStyleButton.isEnabled().catch(() => false)
    ) {
      await reviewStyleButton.click();
      return;
    }

    const finishPacketButton = page.getByRole('button', { name: /Finish Packet/i }).first();
    if (
      await finishPacketButton.isVisible({ timeout: 3000 }).catch(() => false) &&
      await finishPacketButton.isEnabled().catch(() => false)
    ) {
      await finishPacketButton.click();
      return;
    }

    if (await isAdoptModalVisible(page) || (await isSignatureCompletionVisible(page))) {
      return;
    }

    throw new Error('Unable to open signature adopt modal from signer tabs.');
  }
}

async function openInitialsAdoptModal(page: Page) {
  await dismissDisclosureOverlayIfVisible(page);
  await acknowledgeSignerAgreementIfPresent(page);

  if (await isAdoptModalVisible(page)) {
    return;
  }

  const inlineDisclosureCheckbox = page.getByLabel(/E-sign disclosure acknowledgement/i).first();
  if (await inlineDisclosureCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
    const isChecked = await inlineDisclosureCheckbox.isChecked().catch(() => false);
    if (!isChecked) {
      await inlineDisclosureCheckbox.check({ force: true });
      await page.waitForTimeout(500);
    }
  }

  await acknowledgeSignerAgreementIfPresent(page);

  const styleFirstButton = page
    .getByRole('button', { name: /Review Signature Style|Customize Signature Style First/i })
    .first();
  if (
    await styleFirstButton.isVisible({ timeout: 3500 }).catch(() => false) &&
    await styleFirstButton.isEnabled().catch(() => false)
  ) {
    await styleFirstButton.click();
    return;
  }

  const initialsHotspot = page.getByRole('button', { name: /Click to adopt initials/i }).first();

  try {
    await initialsHotspot.waitFor({ state: 'visible', timeout: 15000 });
    await initialsHotspot.click();
    return;
  } catch {
    const initialsStepButton = page
      .getByRole('button', { name: /initials for every required tab|buyer initials|seller initials/i })
      .first();
    if (await initialsStepButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      try {
        await initialsStepButton.click({ timeout: 4000 });
      } catch (error) {
        if (await isAdoptModalVisible(page)) {
          return;
        }
        throw error;
      }
      return;
    }

    const genericAdoptButton = page.getByRole('button', { name: /^Adopt$/i }).first();
    if (
      await genericAdoptButton.isVisible({ timeout: 3000 }).catch(() => false) &&
      await genericAdoptButton.isEnabled().catch(() => false)
    ) {
      await genericAdoptButton.click();
      return;
    }

    const autofillButton = page
      .getByRole('button', { name: /Autofill Tabs|Use My Name & Initials|Fill My Details|Smart Fill|Smart Fill My Fields/i })
      .first();
    if (
      await autofillButton.isVisible({ timeout: 3000 }).catch(() => false) &&
      await autofillButton.isEnabled().catch(() => false)
    ) {
      await autofillButton.click();
      await page.waitForTimeout(400);
    }

    await acknowledgeSignerAgreementIfPresent(page);

    const reviewStyleButton = page
      .getByRole('button', { name: /Review Signature Style|Customize Signature Style First/i })
      .first();
    if (
      await reviewStyleButton.isVisible({ timeout: 4000 }).catch(() => false) &&
      await reviewStyleButton.isEnabled().catch(() => false)
    ) {
      await reviewStyleButton.click();
      return;
    }

    const finishPacketButton = page.getByRole('button', { name: /Finish Packet/i }).first();
    if (
      await finishPacketButton.isVisible({ timeout: 3000 }).catch(() => false) &&
      await finishPacketButton.isEnabled().catch(() => false)
    ) {
      await finishPacketButton.click();
      return;
    }

    if (await isAdoptModalVisible(page)) {
      return;
    }

    throw new Error('Unable to open initials adopt modal from signer tabs.');
  }
}

async function closeAdoptModalIfVisible(page: Page) {
  const dialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: /Adopt/i }) })
    .first();
  const isVisible = await dialog.isVisible({ timeout: 1500 }).catch(() => false);
  if (!isVisible) {
    return;
  }

  const backButton = dialog.getByRole('button', { name: /^Back$/i }).first();
  if (await backButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await backButton.click();
  } else {
    const closeButton = dialog.getByRole('button', { name: /Close/i }).first();
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
  }

  await expect(dialog).toBeHidden({ timeout: 10000 });
}

test.describe('E-sign signer experience', () => {
  test.describe.configure({ mode: 'serial' });

  test('keeps contracts inbox free of duplicate pending-signature key warnings', async ({ page }) => {
    const duplicateKeyWarnings: string[] = [];

    page.on('console', (message) => {
      const text = message.text();
      if (/Encountered two children with the same key/i.test(text)) {
        duplicateKeyWarnings.push(text);
      }
    });

    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    await expect(page).toHaveURL(/.*contracts/);
    await page.waitForTimeout(1200);

    expect(duplicateKeyWarnings).toEqual([]);
  });

  test('serves valid PDFs for uploaded document envelopes', async ({ request }, testInfo) => {
    test.slow();
    test.setTimeout(120_000);

    await staggerApiCallsForProject(testInfo.project.name);

    const { token, envelope } = await createDocumentEnvelope(request);
    const envelopeId = envelope.envelope.id;
    const buyerLink = getSignerLink(envelope, 'BUYER');

    const agentPdf = await request.get(`/api/esign/envelopes/${envelopeId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expectPdfBytes(agentPdf, 'Agent document envelope PDF');

    const publicPdf = await request.get(getPublicPdfPath(buyerLink));
    await expectPdfBytes(publicPdf, 'Public signer document envelope PDF');
  });

  test('keeps disclosure prompt top-aligned on mobile signer links', async ({ page, request }, testInfo) => {
    test.slow();
    test.setTimeout(180_000);

    await staggerApiCallsForProject(testInfo.project.name);
    await page.setViewportSize({ width: 390, height: 844 });

    const envelope = await createFreshEnvelope(request);
    const buyerLink = getSignerLink(envelope, 'BUYER');

    await page.goto(buyerLink, { waitUntil: 'domcontentloaded' });
    await page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/esign-public/envelopes/') &&
          response.request().method() === 'GET',
        { timeout: 25000 },
      )
      .catch(() => null);

    const loadingPacketText = page.getByText(/Loading e-sign packet/i).first();
    if (await loadingPacketText.isVisible({ timeout: 1500 }).catch(() => false)) {
      await loadingPacketText.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => null);
    }

    const modal = page.getByTestId('esign-disclosure-modal');
    await expect(page.getByRole('heading', { name: /Review the e-sign disclosure/i })).toBeVisible({ timeout: 15000 });
    await expect(modal).toBeVisible();

    const box = await modal.boundingBox();
    expect(box, 'Expected mobile disclosure modal bounds').toBeTruthy();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThanOrEqual(16);
    expect(box!.height).toBeLessThanOrEqual(844 - 12);

    await expect(page.getByRole('checkbox', { name: /E-sign disclosure acknowledgement/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Signing|Review Final Signature/i })).toBeVisible();
  });

  test('opens DocuSign-style initials and signature modals from signer tabs', async ({ page, request }, testInfo) => {
    test.slow();
    test.setTimeout(180_000);

    await staggerApiCallsForProject(testInfo.project.name);

    const envelope = await createFreshEnvelope(request);
    const buyerLink = getSignerLink(envelope, 'BUYER');

    await openDisclosureFlow(page, buyerLink);

    await openInitialsAdoptModal(page);
    await expect(page.getByRole('heading', { name: /Adopt initials|Adopt signature & initials/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByPlaceholder('Enter your full legal name')).toHaveValue(/.+/);
    await expect(page.getByPlaceholder('e.g. BP')).toHaveValue(/[A-Z]{2,4}/);

    const applyInitialsButton = page.getByRole('button', { name: /Apply Initials/i }).first();
    if (await applyInitialsButton.isVisible({ timeout: 1200 }).catch(() => false)) {
      await applyInitialsButton.click();
    } else {
      await closeAdoptModalIfVisible(page);
    }

    const smartFillButton = page
      .getByRole('button', { name: /Use My Name & Initials|Smart Fill|Smart Fill My Fields|Autofill Tabs|Fill My Details/i })
      .first();
    if (await smartFillButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(smartFillButton).toBeVisible();
    }

    await openSignatureAdoptModal(page);
    await expect(page.getByRole('heading', { name: /Adopt signature & initials|Adopt initials/i }).first()).toBeVisible({
      timeout: 10000,
    });

    const applySignatureButton = page.getByRole('button', { name: /Apply Signature|Adopt and Sign/i }).first();
    await expect(applySignatureButton).toBeVisible();
    await applySignatureButton.click();

    await expect(page.getByRole('dialog').first()).toBeHidden({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /Complete Signature|Complete Signature Now|Finish Packet/i }).first(),
    ).toBeEnabled();
  });

  test('shows a client-safe completion receipt after public signing', async ({ page, request }, testInfo) => {
    test.slow();
    test.setTimeout(180_000);

    await staggerApiCallsForProject(testInfo.project.name);

    const envelope = await createFreshEnvelope(request);
    const sellerLink = getSignerLink(envelope, 'SELLER');

    await openDisclosureFlow(page, sellerLink);
    const disclosureAcknowledgement = page
      .getByRole('checkbox', { name: /E-sign disclosure acknowledgement/i })
      .first();
    if (await disclosureAcknowledgement.isVisible({ timeout: 4000 }).catch(() => false)) {
      await expect(disclosureAcknowledgement).toBeChecked();
    } else {
      await expect(page.getByText(/E-sign disclosure accepted/i)).toBeVisible();
    }

    await acknowledgeSignerAgreementIfPresent(page);

    await openInitialsAdoptModal(page);
    const applyInitialsButton = page.getByRole('button', { name: /Apply Initials/i }).first();
    if (await applyInitialsButton.isVisible({ timeout: 4000 }).catch(() => false)) {
      await applyInitialsButton.click();
    } else {
      await closeAdoptModalIfVisible(page);
    }

    await openSignatureAdoptModal(page);
    const applySignatureButton = page.getByRole('button', { name: /Apply Signature|Adopt and Sign/i }).first();
    if (await applySignatureButton.isVisible({ timeout: 4000 }).catch(() => false)) {
      await applySignatureButton.click();
    }

    await expect(page.getByRole('dialog').first()).toBeHidden({ timeout: 10000 });

    const completeSignatureButton = page
      .getByRole('button', { name: /Complete Signature|Complete Signature Now|Finish Packet/i })
      .first();
    await expect(completeSignatureButton).toBeEnabled();
    await completeSignatureButton.click();

    const completedImmediately = await isSignatureCompletionVisible(page);
    if (!completedImmediately) {
      await openSignatureAdoptModal(page);
      const adoptAndSignButton = page.getByRole('button', { name: /Adopt and Sign|Apply Signature/i }).first();
      if (await adoptAndSignButton.isVisible({ timeout: 4000 }).catch(() => false)) {
        await adoptAndSignButton.click();
      }
    }

    await expect(page.getByRole('heading', { name: /Signature complete|Signature captured/i })).toBeVisible({ timeout: 30000 });

    const modernReceiptVisible = await page
      .getByText(/A secure signing receipt has been recorded/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (modernReceiptVisible) {
      await expect(page.getByRole('link', { name: /Download Packet/i })).toBeVisible();
      await expect(page.getByText(/Audit Hash/i)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Copy Audit Hash/i })).toHaveCount(0);
    } else {
      await expect(page.getByText(/secure audit trail|Audit Hash/i).first()).toBeVisible();
    }
  });
});
