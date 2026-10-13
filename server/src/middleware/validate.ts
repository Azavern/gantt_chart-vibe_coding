import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

import { ApiError } from './error';

/**
 * Memvalidasi body permintaan dengan skema zod dari paket `shared`.
 * Data yang lolos validasi menggantikan nilai aslinya, sehingga route hanya
 * bekerja dengan data yang sudah bersih dan bertipe.
 */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.errors) {
        const key = issue.path.join('.') || '_';
        fields[key] = [...(fields[key] ?? []), issue.message];
      }

      next(new ApiError(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', { fields }));
      return;
    }

    req.body = result.data as z.infer<T>;
    next();
  };
}
