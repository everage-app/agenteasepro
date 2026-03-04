import { AuthenticatedRequest } from '../middleware/auth';

export type DealPermission =
  | 'deals.read'
  | 'deals.update'
  | 'deals.archive'
  | 'deals.manageArchivePolicy'
  | 'deals.activity.read';

const rolePermissions: Record<string, DealPermission[]> = {
  OWNER: ['deals.read', 'deals.update', 'deals.archive', 'deals.manageArchivePolicy', 'deals.activity.read'],
  MANAGER: ['deals.read', 'deals.update', 'deals.archive', 'deals.manageArchivePolicy', 'deals.activity.read'],
  AGENT: ['deals.read', 'deals.update', 'deals.archive', 'deals.manageArchivePolicy', 'deals.activity.read'],
  COORDINATOR: ['deals.read', 'deals.update', 'deals.activity.read'],
  VIEWER: ['deals.read', 'deals.activity.read'],
};

export function hasDealPermission(req: AuthenticatedRequest, permission: DealPermission): boolean {
  const explicitPermissions = req.user?.permissions;
  if (Array.isArray(explicitPermissions) && explicitPermissions.length > 0) {
    return explicitPermissions.includes(permission);
  }

  const normalizedRole = (req.user?.role || 'AGENT').toUpperCase();
  const role = rolePermissions[normalizedRole] ? normalizedRole : 'AGENT';
  return rolePermissions[role].includes(permission);
}
