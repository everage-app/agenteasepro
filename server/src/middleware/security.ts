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
 * Detect and log common attack patterns (path traversal, SQL injection probes,
 * suspicious user agents) without blocking — SOC 2 CC7.2 anomaly monitoring.
 */
export function suspiciousActivityDetector(req: Request, _res: Response, next: NextFunction) {
  const path = req.path || '';
  const ua = req.get('user-agent') || '';

  // Path traversal attempts
  if (path.includes('..') || path.includes('%2e%2e') || path.includes('%252e')) {
    auditLog({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: extractIp(req),
      userAgent: ua,
      detail: `Path traversal attempt: ${path.slice(0, 200)}`,
      meta: { type: 'path_traversal' },
    }).catch(() => {});
    // Don't block — let existing handlers respond with 404
  }

  // Common injection probes in URL
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

  // Scanner/bot user agents
  const scannerPatterns = /nikto|sqlmap|nmap|nessus|masscan|nuclei|dirbuster/i;
  if (scannerPatterns.test(ua)) {
    auditLog({
      action: 'SUSPICIOUS_ACTIVITY',
      ip: extractIp(req),
      userAgent: ua,
      detail: `Scanner user agent detected: ${ua.slice(0, 100)}`,
      meta: { type: 'scanner' },
    }).catch(() => {});
  }

  next();
}
