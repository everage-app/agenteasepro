/**
 * SOC 2 Security Audit Service
 * ─────────────────────────────────────────────────────────────────────
 * Provides immutable, structured audit logging for all authentication
 * and authorization events.  Logs are written to both console (structured
 * JSON) and the DB (InternalEvent) so they survive dyno restarts and are
 * queryable from the internal admin dashboard.
 *
 * Event categories follow SOC 2 Trust Services Criteria:
 *   CC6.1  – Logical access security
 *   CC6.2  – Prior to issuing credentials
 *   CC6.3  – Authentication & authorization
 *   CC7.2  – Monitoring for anomalies
 */

import { prisma } from '../lib/prisma';

// ── Types ────────────────────────────────────────────────────────────

export type AuditAction =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_SIGNUP'
  | 'AUTH_LOGOUT'
  | 'AUTH_TOKEN_REFRESH'
  | 'AUTH_TOKEN_REVOKED'
  | 'AUTH_PASSWORD_RESET_REQUEST'
  | 'AUTH_PASSWORD_RESET_COMPLETE'
  | 'AUTH_PASSWORD_CHANGED'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_ACCOUNT_UNLOCKED'
  | 'AUTH_OAUTH_LOGIN'
  | 'AUTH_DEMO_LOGIN'
  | 'AUTH_DEV_LOGIN'
  | 'ACCESS_DENIED'
  | 'ACCESS_INTERNAL_GRANTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_HIT'
  | 'AUTH_EMAIL_VERIFIED'
  | 'AUTH_EMAIL_VERIFY_FAILED'
  | 'AUTH_EMAIL_VERIFY_RESEND';

export type AuditSeverity = 'info' | 'warn' | 'critical';

export interface AuditEntry {
  action: AuditAction;
  severity: AuditSeverity;
  agentId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string;
  meta?: Record<string, unknown>;
}

// ── Severity mapping ────────────────────────────────────────────────

const SEVERITY_MAP: Record<AuditAction, AuditSeverity> = {
  AUTH_LOGIN_SUCCESS: 'info',
  AUTH_LOGIN_FAILED: 'warn',
  AUTH_SIGNUP: 'info',
  AUTH_LOGOUT: 'info',
  AUTH_TOKEN_REFRESH: 'info',
  AUTH_TOKEN_REVOKED: 'warn',
  AUTH_PASSWORD_RESET_REQUEST: 'info',
  AUTH_PASSWORD_RESET_COMPLETE: 'info',
  AUTH_PASSWORD_CHANGED: 'info',
  AUTH_ACCOUNT_LOCKED: 'critical',
  AUTH_ACCOUNT_UNLOCKED: 'info',
  AUTH_OAUTH_LOGIN: 'info',
  AUTH_DEMO_LOGIN: 'info',
  AUTH_DEV_LOGIN: 'warn',
  ACCESS_DENIED: 'warn',
  ACCESS_INTERNAL_GRANTED: 'info',
  SUSPICIOUS_ACTIVITY: 'critical',
  RATE_LIMIT_HIT: 'warn',
  AUTH_EMAIL_VERIFIED: 'info',
  AUTH_EMAIL_VERIFY_FAILED: 'warn',
  AUTH_EMAIL_VERIFY_RESEND: 'info',
};

// ── Core logging function ───────────────────────────────────────────

export async function auditLog(entry: Omit<AuditEntry, 'severity'>): Promise<void> {
  const severity = SEVERITY_MAP[entry.action] || 'info';
  const timestamp = new Date().toISOString();

  // 1. Console — Structured JSON (always, for container log ingestion)
  const logLine = {
    _type: 'SECURITY_AUDIT',
    timestamp,
    severity,
    action: entry.action,
    agentId: entry.agentId || null,
    email: entry.email ? maskEmail(entry.email) : null,
    ip: entry.ip || null,
    detail: entry.detail || null,
  };

  if (severity === 'critical') {
    console.error(JSON.stringify(logLine));
  } else if (severity === 'warn') {
    console.warn(JSON.stringify(logLine));
  } else {
    console.log(JSON.stringify(logLine));
  }

  // 2. Persist to DB (best-effort — never let audit logging crash requests)
  try {
    await prisma.internalEvent.create({
      data: {
        agentId: entry.agentId || null,
        kind: `identity:${entry.action}`,
        path: entry.detail || entry.action,
        meta: {
          source: 'identity',
          severity,
          ip: entry.ip || null,
          userAgent: entry.userAgent || null,
          email: entry.email ? maskEmail(entry.email) : null,
          ...(entry.meta || {}),
        },
      },
    });
  } catch {
    // Swallow — audit persistence is best-effort
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Mask email for log storage (SOC 2): b**@example.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 5))}@${domain}`;
}

/** Extract client IP from request, handling proxies */
export function extractIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length) return forwarded[0].split(',')[0].trim();
  return req.ip || 'unknown';
}
