/**
 * Structured logger — Pino with pretty-print in development.
 *
 * Usage:
 *   import { logger } from './lib/logger';
 *   logger.info({ dealId }, 'Deal created');
 *   logger.error({ err }, 'Failed to process');
 *
 * In production, outputs JSON lines (machine-parseable) for log aggregators.
 * In development, uses pino-pretty for human-readable coloured output.
 */
import pino from 'pino';

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  // Redact sensitive fields in production
  redact: isDev ? [] : ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'refreshToken'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/** Create a child logger with a named context (e.g., service name). */
export function childLogger(name: string, bindings?: Record<string, unknown>) {
  return logger.child({ service: name, ...bindings });
}

export default logger;
