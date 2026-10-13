import { z } from 'zod';

import { validateWeekendDays } from './calendar';
import { isValidISODate } from './dates';

/**
 * Skema zod bersama (blueprint bagian 7 dan 8): dipakai server untuk memvalidasi
 * input dan client untuk validasi form, sehingga aturannya tidak pernah berbeda.
 *
 * Catatan: skema sengaja tidak memakai `.default()` agar tipe input dan output sama
 * (`z.infer`), sehingga form react-hook-form dan route server memakai tipe identik.
 * Nilai opsional diisi di route server dengan nilai bawaan yang terdokumentasi.
 */

export const isoDateSchema = z
  .string()
  .refine((value) => isValidISODate(value), 'Tanggal harus format YYYY-MM-DD dan valid.');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus format hex, misalnya #0D9488.');

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'], {
  errorMap: () => ({ message: 'Prioritas harus LOW, MEDIUM, atau HIGH.' }),
});

export const dependencyTypeSchema = z.enum(['FS', 'SS'], {
  errorMap: () => ({ message: 'Tipe dependensi harus FS atau SS.' }),
});

export const weekendDaysSchema = z
  .array(z.number().int('Hari harus bilangan bulat.').min(0).max(6, 'Hari harus 0 sampai 6.'))
  .superRefine((days, ctx) => {
    const error = validateWeekendDays(days);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Nama wajib diisi.')
  .max(200, 'Nama maksimal 200 karakter.');

const descriptionSchema = z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter.');

const durationSchema = z
  .number()
  .int('Durasi harus bilangan bulat.')
  .min(1, 'Durasi minimal 1 hari kerja.')
  .max(3650, 'Durasi maksimal 3650 hari kerja.');

/* --- Auth ---------------------------------------------------------------- */

export const registerSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().email('Email tidak valid.').max(200),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter.')
    .max(200, 'Password maksimal 200 karakter.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

/* --- Project ------------------------------------------------------------- */

export const projectCreateSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional().nullable(),
  startDate: isoDateSchema,
  weekendDays: weekendDaysSchema.optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

/* --- Task ---------------------------------------------------------------- */

export const taskCreateSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional().nullable(),
  parentId: z.string().min(1).optional().nullable(),
  durationDays: durationSchema,
  startDate: isoDateSchema,
  priority: prioritySchema.optional(),
  color: hexColorSchema.optional(),
  progress: z.number().int('Progres harus bilangan bulat.').min(0).max(100, 'Progres maksimal 100.').optional(),
  optimisticDays: durationSchema.optional().nullable(),
  pessimisticDays: durationSchema.optional().nullable(),
  position: z.number().int().min(0).optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

export const taskMoveSchema = z.object({
  parentId: z.string().min(1).nullable(),
  position: z.number().int().min(0, 'Posisi minimal 0.'),
});

/* --- Dependency ---------------------------------------------------------- */

export const dependencyCreateSchema = z.object({
  predecessorId: z.string().min(1, 'Predecessor wajib dipilih.'),
  type: dependencyTypeSchema,
  lagDays: z
    .number()
    .int('Jeda harus bilangan bulat.')
    .min(-365, 'Jeda minimal -365 hari.')
    .max(365, 'Jeda maksimal 365 hari.')
    .optional(),
});

export const dependencyUpdateSchema = z
  .object({
    type: dependencyTypeSchema,
    lagDays: z.number().int('Jeda harus bilangan bulat.').min(-365).max(365),
  })
  .partial();

/* --- Resource ------------------------------------------------------------ */

export const resourceCreateSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().email('Email tidak valid.').max(200),
  role: z.string().trim().min(1, 'Peran wajib diisi.').max(100, 'Peran maksimal 100 karakter.'),
  salary: z
    .number()
    .int('Gaji harus bilangan bulat.')
    .min(0, 'Gaji tidak boleh negatif.')
    .max(1_000_000_000, 'Gaji maksimal Rp 1.000.000.000.'),
});

export const resourceUpdateSchema = resourceCreateSchema.partial();

/* --- Assignment ---------------------------------------------------------- */

export const allocationPercentSchema = z
  .number()
  .int('Alokasi harus bilangan bulat.')
  .min(1, 'Alokasi minimal 1%.')
  .max(100, 'Alokasi maksimal 100%.');

export const assignmentCreateSchema = z.object({
  resourceId: z.string().min(1, 'Anggota tim wajib dipilih.'),
  allocationPercent: allocationPercentSchema.optional(),
});

export const assignmentUpdateSchema = z.object({
  allocationPercent: allocationPercentSchema,
});

/* --- Calendar ------------------------------------------------------------ */

export const calendarUpdateSchema = z.object({
  weekendDays: weekendDaysSchema,
});

export const holidayCreateSchema = z.object({
  date: isoDateSchema,
  name: nameSchema.max(200, 'Nama hari libur maksimal 200 karakter.'),
});

/* --- Tipe turunan -------------------------------------------------------- */

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskMoveInput = z.infer<typeof taskMoveSchema>;
export type DependencyCreateInput = z.infer<typeof dependencyCreateSchema>;
export type DependencyUpdateInput = z.infer<typeof dependencyUpdateSchema>;
export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
export type CalendarUpdateInput = z.infer<typeof calendarUpdateSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
