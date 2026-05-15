import { describe, it, expect } from 'vitest';
import { AppError, ok } from './apiResponse';

describe('AppError', () => {
  it('creates a badRequest error', () => {
    const err = AppError.badRequest('missing field');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('missing field');
  });

  it('creates a notFound error', () => {
    const err = AppError.notFound('Deal');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Deal not found');
  });

  it('creates a validation error with details', () => {
    const details = [{ field: 'email', message: 'invalid' }];
    const err = AppError.validation(details);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });

  it('is an instance of Error', () => {
    const err = AppError.internal();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('ok()', () => {
  it('sends JSON with ok:true', () => {
    let captured: any = null;
    let capturedStatus = 0;
    const mockRes = {
      status(code: number) { capturedStatus = code; return this; },
      json(body: unknown) { captured = body; return this; },
    } as any;

    ok(mockRes, { id: '1' });
    expect(capturedStatus).toBe(200);
    expect(captured).toEqual({ ok: true, data: { id: '1' } });
  });
});
