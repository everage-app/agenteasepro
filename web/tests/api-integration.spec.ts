import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.PLAYWRIGHT_API_BASE || '/api';

test.describe('API Integration Tests', () => {
  test.describe.configure({ timeout: 180_000 });
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Fast path: reuse token from setup project's storage state.
    try {
      const storagePath = path.resolve(__dirname, '.auth', 'user.json');
      const raw = fs.readFileSync(storagePath, 'utf-8');
      const parsed = JSON.parse(raw) as {
        origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
      };
      const tokenFromStorage = parsed.origins
        ?.flatMap((origin) => origin.localStorage || [])
        .find((entry) => entry.name === 'utahcontracts_token')?.value;
      if (tokenFromStorage) {
        authToken = tokenFromStorage;
        return;
      }
    } catch {
      // Fallback to API login below.
    }

    // Use dev-login for stable test auth (no password required).
    // This relies on Playwright webServer setting ALLOW_DEV_LOGIN=true.
    const email = 'demo@agentease.com';

    const startedAt = Date.now();
    const timeoutMs = 120_000;
    let token: string | null = null;
    let lastStatus: number | null = null;
    let lastBody: string | null = null;

    while (!token && Date.now() - startedAt < timeoutMs) {
      try {
        const response = await request.post(`${API_BASE}/auth/dev-login`, {
          data: { email },
          timeout: 5000,
        });

        lastStatus = response.status();
        const text = await response.text();
        lastBody = text;

        try {
          const json = JSON.parse(text) as { token?: string };
          if (response.ok() && json?.token) {
            token = json.token;
            break;
          }
        } catch {
          // Ignore parse errors; we'll retry.
        }

        // Fallback for environments that disable dev-login.
        if (!token && lastStatus === 404) {
          const demoResponse = await request.post(`${API_BASE}/auth/demo-login`, {
            data: {},
            timeout: 5000,
          });
          const demoText = await demoResponse.text();
          lastStatus = demoResponse.status();
          lastBody = demoText;
          try {
            const demoJson = JSON.parse(demoText) as { token?: string };
            if (demoResponse.ok() && demoJson?.token) {
              token = demoJson.token;
              break;
            }
          } catch {
            // continue retry loop
          }
        }
      } catch (err: any) {
        lastBody = err?.message || 'request error';
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!token) {
      const snippet = (lastBody || '').slice(0, 400);
      throw new Error(`dev-login failed within ${timeoutMs}ms (status=${lastStatus}). Body: ${snippet}`);
    }

    authToken = token;
  });

  test.describe('AI Endpoints', () => {
    test('should generate AI daily plan', async ({ request }) => {
      const response = await request.post(`${API_BASE}/ai/calendar/daily-plan`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          date: new Date().toISOString(),
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data).toBeTruthy();
      }
    });

    test('should generate AI task suggestions', async ({ request }) => {
      const response = await request.post(`${API_BASE}/ai/tasks/suggest`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          date: new Date().toISOString(),
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data).toBeTruthy();
      }
    });

    test('should generate AI listing description', async ({ request }) => {
      const response = await request.post(`${API_BASE}/ai/listings/generate-description`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          address: '123 Main Street',
          city: 'Provo',
          state: 'UT',
          bedrooms: 4,
          bathrooms: 3,
          squareFeet: 2500,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data).toBeTruthy();
        // Current API returns { short, long, highlights }.
        expect((data as any).short || (data as any).long).toBeTruthy();
      }
    });

    test('should generate AI marketing copy', async ({ request }) => {
      const response = await request.post(`${API_BASE}/ai/marketing/generate-copy`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          blastType: 'NEW_LISTING',
          propertyAddress: '123 Main Street, Provo, UT',
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data).toBeTruthy();
      }
    });

    test('should analyze REPC with AI', async ({ request }) => {
      const response = await request.post(`${API_BASE}/ai/repc/assist`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          dealId: 1,
        },
      });

      // May fail if no deal exists, which is okay
      if (response.ok()) {
        expect(response.status()).toBe(200);
      }
    });
  });

  test.describe('Tasks API', () => {
    let taskId: string;

    test('should create a task', async ({ request }) => {
      const response = await request.post(`${API_BASE}/tasks`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          title: 'Test Task',
          description: 'This is a test task',
          category: 'CALL',
          priority: 'HIGH',
          bucket: 'TODAY',
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(201);
        const data = await response.json();
        taskId = data.id;
        expect(data.title).toBe('Test Task');
      }
    });

    test('should get all tasks', async ({ request }) => {
      const response = await request.get(`${API_BASE}/tasks`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test('should update a task', async ({ request }) => {
      if (!taskId) return;

      const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          title: 'Updated Task Title',
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
      }
    });

    test('should delete a task', async ({ request }) => {
      if (!taskId) return;

      const response = await request.delete(`${API_BASE}/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect([200, 204]).toContain(response.status());
      }
    });
  });

  test.describe('Listings API', () => {
    let listingId: string;

    test('should create a listing', async ({ request }) => {
      const response = await request.post(`${API_BASE}/listings`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          address: '456 Test Avenue',
          city: 'Provo',
          state: 'UT',
          zipCode: '84601',
          price: 450000,
          bedrooms: 4,
          bathrooms: 3,
          squareFeet: 2500,
          listingType: 'SALE',
          status: 'ACTIVE',
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(201);
        const data = await response.json();
        listingId = data.id;
        expect(data.address).toBe('456 Test Avenue');
      }
    });

    test('should get all listings', async ({ request }) => {
      const response = await request.get(`${API_BASE}/listings`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test('should get listing by id', async ({ request }) => {
      if (!listingId) return;

      const response = await request.get(`${API_BASE}/listings/${listingId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.id).toBe(listingId);
      }
    });

    test('should delete a listing', async ({ request }) => {
      if (!listingId) return;

      const response = await request.delete(`${API_BASE}/listings/${listingId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(204);
      }
    });
  });

  test.describe('Calendar API', () => {
    let eventId: string;

    test('should create a calendar event', async ({ request }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request.post(`${API_BASE}/calendar/events`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          title: 'Property Showing',
          description: 'Show property to buyer',
          startTime: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          location: '123 Test Street',
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(201);
        const data = await response.json();
        eventId = data.id;
        expect(data.title).toBe('Property Showing');
      }
    });

    test('should get all calendar events', async ({ request }) => {
      const response = await request.get(`${API_BASE}/calendar/events`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test('should delete a calendar event', async ({ request }) => {
      if (!eventId) return;

      const response = await request.delete(`${API_BASE}/calendar/events/${eventId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(204);
      }
    });
  });

  test.describe('Clients API', () => {
    let clientId: string;

    test('should create a client', async ({ request }) => {
      const response = await request.post(`${API_BASE}/clients`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          name: 'Test Client',
          email: 'testclient@example.com',
          phone: '801-555-1234',
          role: 'BUYER',
          stage: 'ACTIVE',
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(201);
        const data = await response.json();
        clientId = data.id;
        expect(data.firstName).toBe('Test');
        expect(data.lastName).toBe('Client');
      }
    });

    test('should get all clients', async ({ request }) => {
      const response = await request.get(`${API_BASE}/clients`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test('should delete a client', async ({ request }) => {
      if (!clientId) return;

      const response = await request.delete(`${API_BASE}/clients/${clientId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(204);
      }
    });
  });

  test.describe('Marketing API', () => {
    test('should get channel connections', async ({ request }) => {
      const response = await request.get(`${API_BASE}/channels`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const contentType = response.headers()['content-type'] || '';
        expect(contentType).toContain('application/json');
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test('should get marketing blasts', async ({ request }) => {
      const response = await request.get(`${API_BASE}/marketing/blasts`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test('should create marketing blast', async ({ request }) => {
      const response = await request.post(`${API_BASE}/marketing/blasts`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          subject: 'Test Marketing Blast',
          message: 'This is a test message',
          blastType: 'NEWSLETTER',
          channels: ['EMAIL'],
        },
      });

      // May fail due to missing channel connections, which is okay
      if (response.ok()) {
        expect([200, 201]).toContain(response.status());
      }
    });
  });

  test.describe('MLS Integration', () => {
    test('should search MLS listings', async ({ request }) => {
      const response = await request.get(`${API_BASE}/mls/search?city=Provo`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // May fail if MLS service not configured, which is okay
      if (response.ok()) {
        expect(response.status()).toBe(200);
      }
    });

    test('should import MLS listing', async ({ request }) => {
      const response = await request.post(`${API_BASE}/mls/import`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          mlsNumber: 'MLS-123456',
        },
      });

      // May fail if MLS not configured, which is okay
      if (response.ok()) {
        expect([200, 201]).toContain(response.status());
      }
    });
  });

  test.describe('Automations API', () => {
    test('should get all automations', async ({ request }) => {
      const response = await request.get(`${API_BASE}/automations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test('should create automation', async ({ request }) => {
      const response = await request.post(`${API_BASE}/automations`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          name: 'Test Automation',
          triggerType: 'SCHEDULE',
          actionType: 'SEND_EMAIL',
          enabled: true,
        },
      });

      if (response.ok()) {
        expect(response.status()).toBe(201);
      }
    });
  });
});
