/**
 * Role-Based Access Control (RBAC) middleware.
 *
 * Extends the existing `dealPermissions` concept to ALL resource types.
 *
 * Roles:  OWNER > MANAGER > AGENT > COORDINATOR > VIEWER
 *
 * Usage:
 *   router.get('/deals', requireRole('VIEWER'), async (req, res) => { ... });
 *   router.post('/deals', requirePermission('deals.create'), async (req, res) => { ... });
 */
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

// --------------- types ---------------
export type Role = 'OWNER' | 'MANAGER' | 'AGENT' | 'COORDINATOR' | 'VIEWER';

export type Permission =
  // Deals
  | 'deals.read' | 'deals.create' | 'deals.update' | 'deals.archive' | 'deals.manageArchivePolicy' | 'deals.activity.read'
  // Clients
  | 'clients.read' | 'clients.create' | 'clients.update' | 'clients.delete'
  // Leads
  | 'leads.read' | 'leads.create' | 'leads.update' | 'leads.delete' | 'leads.import'
  // Marketing
  | 'marketing.read' | 'marketing.create' | 'marketing.send'
  // Contracts / E-Sign
  | 'contracts.read' | 'contracts.create' | 'contracts.sign' | 'contracts.manage'
  // Settings
  | 'settings.read' | 'settings.update' | 'settings.billing'
  // Team
  | 'team.read' | 'team.invite' | 'team.manage'
  // Reports
  | 'reports.read' | 'reports.export'
  // Admin / Internal
  | 'admin.internal';

// --------------- role → permission map ---------------
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [
    'deals.read', 'deals.create', 'deals.update', 'deals.archive', 'deals.manageArchivePolicy', 'deals.activity.read',
    'clients.read', 'clients.create', 'clients.update', 'clients.delete',
    'leads.read', 'leads.create', 'leads.update', 'leads.delete', 'leads.import',
    'marketing.read', 'marketing.create', 'marketing.send',
    'contracts.read', 'contracts.create', 'contracts.sign', 'contracts.manage',
    'settings.read', 'settings.update', 'settings.billing',
    'team.read', 'team.invite', 'team.manage',
    'reports.read', 'reports.export',
    'admin.internal',
  ],
  MANAGER: [
    'deals.read', 'deals.create', 'deals.update', 'deals.archive', 'deals.manageArchivePolicy', 'deals.activity.read',
    'clients.read', 'clients.create', 'clients.update', 'clients.delete',
    'leads.read', 'leads.create', 'leads.update', 'leads.delete', 'leads.import',
    'marketing.read', 'marketing.create', 'marketing.send',
    'contracts.read', 'contracts.create', 'contracts.sign', 'contracts.manage',
    'settings.read', 'settings.update',
    'team.read', 'team.invite',
    'reports.read', 'reports.export',
  ],
  AGENT: [
    'deals.read', 'deals.create', 'deals.update', 'deals.archive', 'deals.manageArchivePolicy', 'deals.activity.read',
    'clients.read', 'clients.create', 'clients.update',
    'leads.read', 'leads.create', 'leads.update',
    'marketing.read', 'marketing.create', 'marketing.send',
    'contracts.read', 'contracts.create', 'contracts.sign',
    'settings.read', 'settings.update',
    'team.read',
    'reports.read',
  ],
  COORDINATOR: [
    'deals.read', 'deals.update', 'deals.activity.read',
    'clients.read', 'clients.update',
    'leads.read', 'leads.update',
    'marketing.read',
    'contracts.read', 'contracts.create',
    'settings.read',
    'reports.read',
  ],
  VIEWER: [
    'deals.read', 'deals.activity.read',
    'clients.read',
    'leads.read',
    'marketing.read',
    'contracts.read',
    'settings.read',
    'reports.read',
  ],
};

const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 100,
  MANAGER: 80,
  AGENT: 60,
  COORDINATOR: 40,
  VIEWER: 20,
};

// --------------- helpers ---------------
function getEffectiveRole(req: AuthenticatedRequest): Role {
  const role = ((req.user?.role || 'AGENT') as string).toUpperCase() as Role;
  return ROLE_PERMISSIONS[role] ? role : 'AGENT';
}

export function hasPermission(req: AuthenticatedRequest, permission: Permission): boolean {
  // Explicit per-user permissions override role defaults
  const explicit = req.user?.permissions;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.includes(permission);
  }
  const role = getEffectiveRole(req);
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}

// --------------- Express middleware factories ---------------

/** Require a minimum role level (hierarchy-based). */
export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authedReq = req as AuthenticatedRequest;
    if (!authedReq.agentId) return res.status(401).json({ error: 'Unauthorized' });

    const current = getEffectiveRole(authedReq);
    if (ROLE_HIERARCHY[current] >= ROLE_HIERARCHY[minRole]) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden — insufficient role' });
  };
}

/** Require a specific permission. */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authedReq = req as AuthenticatedRequest;
    if (!authedReq.agentId) return res.status(401).json({ error: 'Unauthorized' });

    if (hasPermission(authedReq, permission)) {
      return next();
    }
    return res.status(403).json({ error: `Forbidden — missing permission: ${permission}` });
  };
}

/** Require ANY of the listed permissions (OR logic). */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authedReq = req as AuthenticatedRequest;
    if (!authedReq.agentId) return res.status(401).json({ error: 'Unauthorized' });

    if (permissions.some((p) => hasPermission(authedReq, p))) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden — insufficient permissions' });
  };
}
