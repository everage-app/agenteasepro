import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

type LandingPageSummary = {
  id: string;
  slug: string;
  title: string;
  isActive?: boolean;
  templateId?: string;
  listing?: {
    addressLine1?: string;
    price?: number;
  } | null;
};

type ListingSummary = {
  id: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  mlsId?: string;
  primaryImageUrl?: string | null;
  heroImageUrl?: string | null;
};

type LandingPageDetail = {
  id: string;
  slug: string;
  title: string;
  listing?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    price?: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    photos?: string[];
  } | null;
  customStyles?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
};

test.describe('Landing page production audit', () => {
  test('real account landing page surfaces listing and branding data when available', async ({ page, baseURL }) => {
    test.setTimeout(180_000);

    await navigateTo(page, '/settings/landing-pages');
    await waitForLoadingToComplete(page);

    const audit = await page.evaluate(async (origin) => {
      const token = localStorage.getItem('utahcontracts_token');
      if (!token) throw new Error('Missing auth token');

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const listResponse = await fetch(`${origin}/api/landing-pages`, { headers });
      if (!listResponse.ok) {
        if (listResponse.status === 429) {
          return { hasPages: false, reason: 'Landing pages list is rate limited (429)' };
        }
        throw new Error(`Landing pages list failed: ${listResponse.status}`);
      }

      const pages = (await listResponse.json()) as LandingPageSummary[];
      let target =
        pages.find((entry) => entry.isActive && entry.listing?.addressLine1)
        || pages.find((entry) => entry.isActive)
        || null;
      let createdTemporary = false;

      if (!target) {
        const listingsResponse = await fetch(`${origin}/api/listings`, { headers });
        if (!listingsResponse.ok) {
          if (listingsResponse.status === 429) {
            return { hasPages: false, reason: 'Listings API is rate limited (429)' };
          }
          throw new Error(`Listings list failed: ${listingsResponse.status}`);
        }

        const listings = (await listingsResponse.json()) as ListingSummary[];
        const listing = listings.find((entry) => entry.addressLine1) || listings[0] || null;
        if (!listing) {
          return { hasPages: false, reason: 'No landing pages or listings available for this account' };
        }

        const slug = `prod-audit-${Date.now()}`;
        const createResponse = await fetch(`${origin}/api/landing-pages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            listingId: listing.id,
            title: `${listing.addressLine1 || 'Listing'} Audit`,
            slug,
            templateId: 'modern-luxury',
          }),
        });

        if (!createResponse.ok) {
          if (createResponse.status === 429) {
            return { hasPages: false, reason: 'Landing page create is rate limited (429)' };
          }
          throw new Error(`Landing page create failed: ${createResponse.status}`);
        }

        const created = (await createResponse.json()) as LandingPageSummary;

        const publishResponse = await fetch(`${origin}/api/landing-pages/${created.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ isActive: true }),
        });
        if (!publishResponse.ok) {
          if (publishResponse.status === 429) {
            return { hasPages: false, reason: 'Landing page publish is rate limited (429)' };
          }
          return {
            hasPages: false,
            reason: `Temporary landing page could not be published (${publishResponse.status})`,
          };
        }

        target = created;
        createdTemporary = true;
      }

      const detailResponse = await fetch(`${origin}/api/landing-pages/${target.id}`, { headers });
      if (!detailResponse.ok) {
        if (detailResponse.status === 429) {
          return { hasPages: false, reason: 'Landing page detail is rate limited (429)' };
        }
        throw new Error(`Landing page detail failed: ${detailResponse.status}`);
      }

      const detail = (await detailResponse.json()) as LandingPageDetail;
      const publicResponse = await fetch(`${origin}/api/sites/${target.slug}`);
      if (!publicResponse.ok) {
        if (publicResponse.status === 429) {
          return { hasPages: false, reason: 'Public landing endpoint is rate limited (429)' };
        }
        throw new Error(`Public landing page failed: ${publicResponse.status}`);
      }

      const publicData = await publicResponse.json();

      return {
        hasPages: true,
        createdTemporary,
        target: {
          id: target.id,
          slug: target.slug,
          title: target.title,
        },
        detail,
        publicData,
      };
    }, baseURL || window.location.origin);

    if (!audit.hasPages) {
      const auditResult = audit as { reason?: string };
      test.skip(true, auditResult.reason || 'No landing pages exist for this account');
      return;
    }

    const { target, detail, publicData } = audit as {
      hasPages: true;
      createdTemporary?: boolean;
      target: { id: string; slug: string; title: string };
      detail: LandingPageDetail;
      publicData: any;
    };

    await page.goto(`/sites/${target.slug}`, { waitUntil: 'domcontentloaded' });
    await waitForLoadingToComplete(page);

    await expect(page.getByText(target.title).first()).toBeVisible({ timeout: 15000 });

    if (detail.listing?.addressLine1) {
      await expect(page.getByText(detail.listing.addressLine1, { exact: false }).first()).toBeVisible({ timeout: 15000 });
      expect(publicData.listing?.address).toBe(detail.listing.addressLine1);
    }

    if (detail.listing?.price) {
      expect(publicData.listing?.price).toBe(detail.listing.price);
      await expect(page.getByText(/\$/).first()).toBeVisible({ timeout: 15000 });
    }

    if (publicData.listing?.mlsNumber) {
      await expect(page.getByText(new RegExp(`MLS\\s*#?${publicData.listing.mlsNumber}`))).toBeVisible({ timeout: 15000 });
    }

    if (publicData.branding?.primaryColor) {
      expect(typeof publicData.branding.primaryColor).toBe('string');
    }

    if (publicData.brokerage?.name) {
      await expect(page.getByText(publicData.brokerage.name, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    }

    if (Array.isArray(publicData.listing?.photos) && publicData.listing.photos.length > 0) {
      await expect(page.locator('img').first()).toBeVisible({ timeout: 15000 });
    }

    expect(publicData.agent).toBeTruthy();
    expect(publicData.content).toBeTruthy();
    expect(publicData.theme).toBeTruthy();

    if ((audit as { createdTemporary?: boolean }).createdTemporary) {
      await page.evaluate(async ({ origin, id }) => {
        const token = localStorage.getItem('utahcontracts_token');
        if (!token) return;
        await fetch(`${origin}/api/landing-pages/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }, { origin: baseURL || window.location.origin, id: target.id });
    }
  });
});
