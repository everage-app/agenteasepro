import { describe, it, expect } from 'vitest';
import { hasPermission, Role, Permission } from './rbac';
import { AuthenticatedRequest } from './auth';

function mockReq(role: Role, permissions?: string[]): AuthenticatedRequest {
  return {
    agentId: 'test-agent',
    user: { id: 'test-agent', role, permissions },
  } as any;
}

describe('RBAC — hasPermission', () => {
  it('OWNER has all permissions', () => {
    const req = mockReq('OWNER');
    expect(hasPermission(req, 'deals.create')).toBe(true);
    expect(hasPermission(req, 'settings.billing')).toBe(true);
    expect(hasPermission(req, 'team.manage')).toBe(true);
    expect(hasPermission(req, 'admin.internal')).toBe(true);
  });

  it('VIEWER can only read', () => {
    const req = mockReq('VIEWER');
    expect(hasPermission(req, 'deals.read')).toBe(true);
    expect(hasPermission(req, 'deals.create')).toBe(false);
    expect(hasPermission(req, 'settings.billing')).toBe(false);
  });

  it('AGENT cannot manage billing', () => {
    const req = mockReq('AGENT');
    expect(hasPermission(req, 'settings.billing')).toBe(false);
    expect(hasPermission(req, 'deals.create')).toBe(true);
  });

  it('COORDINATOR has limited write access', () => {
    const req = mockReq('COORDINATOR');
    expect(hasPermission(req, 'deals.read')).toBe(true);
    expect(hasPermission(req, 'deals.update')).toBe(true);
    expect(hasPermission(req, 'deals.create')).toBe(false);
    expect(hasPermission(req, 'leads.delete')).toBe(false);
  });

  it('explicit permissions override role defaults', () => {
    const req = mockReq('VIEWER', ['deals.create', 'deals.delete' as Permission]);
    expect(hasPermission(req, 'deals.create')).toBe(true);
    expect(hasPermission(req, 'deals.read')).toBe(false); // Not in explicit list
  });

  it('defaults to AGENT for unknown roles', () => {
    const req = mockReq('UNKNOWN_ROLE' as Role);
    expect(hasPermission(req, 'deals.create')).toBe(true);  // AGENT can create deals
    expect(hasPermission(req, 'admin.internal')).toBe(false); // AGENT cannot admin
  });
});
