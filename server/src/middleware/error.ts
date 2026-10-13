import { Prisma } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ScheduleError } from '@gantt/shared';

/**
 * Bentuk pesan error (blueprint bagian 7):
 * `{ "error": { code, message, details } }` dengan pesan bahasa Indonesia.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Pembungkus handler async agar error diteruskan ke middleware error Express 4. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint tidak ditemukan.',
      details: {},
    },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ScheduleError) {
    res.status(422).json({
      error: {
        code: error.code,
        message: 'Jadwal proyek tidak dapat dihitung karena dependensi membentuk siklus.',
        details: {},
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Data yang sama sudah ada.',
          details: {},
        },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan.', details: {} },
      });
      return;
    }
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Body permintaan bukan JSON yang valid.',
        details: {},
      },
    });
    return;
  }

  console.error('[error] Kesalahan tak terduga:', error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.',
      details: {},
    },
  });
}
