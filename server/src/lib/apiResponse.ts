/**
 * Standardized API response envelope & error handling.
 *
 * Success: { ok: true, data: T }
 * Error:   { ok: false, error: { code: string, message: string, details?: any } }
 *
 * Use `AppError` to throw typed errors from routes.
 * The `errorHandler` middleware catches them globally.
 */
import { Request, Response, NextFunction } from 'express';

// --------------- typed error class ---------------
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  // ---------- convenience factories ----------
  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'Forbidden') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(resource = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${resource} not found`);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
  static validation(details: unknown) {
    return new AppError(422, 'VALIDATION_ERROR', 'Validation failed', details);
  }
  static internal(message = 'Internal server error') {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }
  static tooManyRequests(message = 'Too many requests') {
    return new AppError(429, 'RATE_LIMITED', message);
  }
}

// --------------- success helper ---------------
export function ok<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ ok: true, data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, 201);
}

// --------------- global error handler middleware ---------------
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Prisma known request error
  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Record not found' },
    });
  }

  // Multer file size error
  if (err.message?.includes('File too large') || (err as any).code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      ok: false,
      error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum allowed size' },
    });
  }

  // Generic unhandled
  console.error('Unhandled error:', err);
  return res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
}
