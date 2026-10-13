import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { getConfig } from '../config';
import { prisma } from '../db';
import { ApiError } from './error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

const TOKEN_TTL = '7d';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getConfig().jwtSecret, { expiresIn: TOKEN_TTL });
}

/**
 * Memastikan permintaan membawa token yang sah dan akunnya masih ada.
 * Identitas selalu diambil dari token, tidak pernah dari body atau header lain.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
    }

    const token = header.slice('Bearer '.length).trim();
    let payload: jwt.JwtPayload;

    try {
      payload = jwt.verify(token, getConfig().jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi tidak valid atau sudah kedaluwarsa.');
    }

    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    if (!userId) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi tidak valid atau sudah kedaluwarsa.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Akun tidak ditemukan. Silakan masuk kembali.');
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    next(error);
  }
}

/** Id pengguna yang sudah diverifikasi; dipanggil hanya setelah `requireAuth`. */
export function currentUserId(req: Request): string {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
  }
  return req.user.id;
}
