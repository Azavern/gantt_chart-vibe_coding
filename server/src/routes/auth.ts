import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@gantt/shared';

import { prisma } from '../db';
import { currentUserId, requireAuth, signToken } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { authLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { toUserDto } from '../services/snapshot';

const BCRYPT_ROUNDS = 10;

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body as RegisterInput;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar. Silakan masuk.');
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });

    res.status(201).json({ token: signToken(user.id), user: toUserDto(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
    }

    res.json({ token: signToken(user.id), user: toUserDto(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi tidak valid. Silakan masuk kembali.');
    }

    res.json({ user: toUserDto(user) });
  }),
);
