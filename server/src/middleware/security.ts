/**
 * Security Middleware — SOC 2 Runtime Hardening
 * ─────────────────────────────────────────────────────────────────────
 * Provides request-level security controls:
 *   • Request ID tagging (X-Request-Id) for traceability
 *   • Security response headers beyond Helmet defaults
 *   • Body size enforcement
 *   • Suspicious path detection
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { auditLog, extractIp } from '../services/securityAuditService';

/**
 * Attach a unique request ID to every request for end-to-end traceability.
 * If the client sends X-Request-Id we reuse it; otherwise generate one.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existing = req.headers['x-request-id'];
  const requestId = typeof existing === 'string' && existing.length > 0 && existing.length <= 64
    ? existing
    : crypto.randomUUID();

  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;
  next();
}

/**
 * Additional security headers complementing Helmet.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  // Prevent browsers from caching sensitive API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  // Permissions Policy — restrict browser features
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );

  // Prevent content type sniffing (Helmet sets this but ensure it's there)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer policy for privacy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

/**
 * Detect and block common attack patterns (path traversal, SQL injection probes,
 * suspicious user agents).  Scanner UAs and blatant attacks get 403; subtler
 * probes are logged without blocking — SOC 2 CC7.2 anomaly monitoring.
 */
export function suspiciousActivityDetector(req: Request, res: Response, next: NextFunction) {
  const path = req.path || '';
  const ua = req.get('user-agent') || '';

  // ── Block: Scanner / bot user agents (auto-reject) ──
  const scannerPatterns = /nikto|sqlmap|nmap|nessus|masscan|nuclei|dirbuster|gobuster|wfuzz|ffuf|hydra|burpsuite/i;
  if (scannerPatterns.test(ua)) {
    auditLog({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: extractIp(req),
      userAgent: ua,
      detail: `Blocked scanner user agent: ${ua.slice(0, 100)}`,
      meta: { type: 'scanner', blocked: true },
    }).catch(() => {});
    return res.status(403).end();
  }

  // ── Block: Path traversal attempts ──
  if (path.includes('..') || path.includes('%2e%2e') || path.includes('%252e')) {
    auditLog({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: extractIp(req),
      userAgent: ua,
      detail: `Blocked path traversal attempt: ${path.slice(0, 200)}`,
      meta: { type: 'path_traversal', blocked: true },
    }).catch(() => {});
    return res.status(403).end();
  }

  // ── Block: Well-known exploit paths ──
  const exploitPaths = /\.(env|git|aws|htpasswd|htaccess|DS_Store)$|\/wp-admin|\/wp-login|\/phpmyadmin|\/cgi-bin|\/\.well-known\/security\.txt/i;
  if (exploitPaths.test(path)) {
    auditLog({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: extractIp(req),
      userAgent: ua,
      detail: `Blocked exploit probe: ${path.slice(0, 200)}`,
      meta: { type: 'exploit_probe', blocked: true },
    }).catch(() => {});
    return res.status(404).end();
  }

  // ── Log-only: Common injection probes in URL ──
  const injectionPatterns = /['";]|UNION\s+SELECT|<script|eval\(|javascript:/i;
  const queryString = req.originalUrl?.split('?')[1] || '';
  if (injectionPatterns.test(queryString) || injectionPatterns.test(path)) {
    auditLog({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: extractIp(req),
      userAgent: ua,
      detail: `Injection probe detected in URL: ${req.originalUrl?.slice(0, 200)}`,
      meta: { type: 'injection_probe' },
    }).catch(() => {});
  }

  next();
}
