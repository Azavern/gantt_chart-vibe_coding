import type { Express } from 'express';
import request from 'supertest';
import type { DependencyDto, ProjectDto, ResourceDto, TaskDto } from '@gantt/shared';

import { createApp } from '../app';
import { prisma } from '../db';

/** Bentuk respons API yang dipakai pengujian (blueprint bagian 7). */
export interface ApiBody {
  error: { code: string; message: string; details: { fields?: Record<string, string[]> } };
  [key: string]: unknown;
}

export const app: Express = createApp();

/** Mengosongkan seluruh tabel; urutan menghormati foreign key. */
export async function resetDatabase(): Promise<void> {
  await prisma.assignment.deleteMany();
  await prisma.dependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

let userCounter = 0;

export async function registerUser(overrides: Partial<{ name: string; email: string; password: string }> = {}): Promise<TestUser> {
  userCounter += 1;
  const email = overrides.email ?? `pengguna${userCounter}.${Date.now()}@example.com`;
  const password = overrides.password ?? 'Password123';

  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: overrides.name ?? `Pengguna ${userCounter}`, email, password });

  if (response.status !== 201) {
    throw new Error(`Gagal mendaftarkan pengguna uji: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return { id: response.body.user.id, name: response.body.user.name, email, token: response.body.token };
}

export function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function createProject(
  token: string,
  overrides: Partial<{ name: string; startDate: string; weekendDays: number[] }> = {},
): Promise<ProjectDto> {
  const response = await request(app)
    .post('/api/projects')
    .set(auth(token))
    .send({
      name: overrides.name ?? 'Proyek Uji',
      startDate: overrides.startDate ?? '2026-10-19',
      weekendDays: overrides.weekendDays ?? [0, 6],
    });

  if (response.status !== 201) {
    throw new Error(`Gagal membuat proyek uji: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return response.body.project as ProjectDto;
}

export async function createTask(
  token: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ taskId: string; tasks: TaskDto[]; status: number; body: ApiBody }> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set(auth(token))
    .send(body);

  return {
    taskId: response.body.taskId as string,
    tasks: (response.body.tasks ?? []) as TaskDto[],
    status: response.status,
    body: response.body as ApiBody,
  };
}

export async function createResource(
  token: string,
  projectId: string,
  overrides: Partial<{ name: string; email: string; role: string; salary: number }> = {},
): Promise<ResourceDto> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/resources`)
    .set(auth(token))
    .send({
      name: overrides.name ?? 'Anggota Uji',
      email: overrides.email ?? `anggota.${Date.now()}.${Math.random()}@example.com`,
      role: overrides.role ?? 'Developer',
      salary: overrides.salary ?? 22_000_000,
    });

  if (response.status !== 201) {
    throw new Error(`Gagal membuat anggota uji: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return response.body.resource as ResourceDto;
}

export async function addDependency(
  token: string,
  successorId: string,
  body: { predecessorId: string; type?: 'FS' | 'SS'; lagDays?: number },
): Promise<{ status: number; body: ApiBody; dependencies: DependencyDto[] }> {
  const response = await request(app)
    .post(`/api/tasks/${successorId}/dependencies`)
    .set(auth(token))
    .send(body);

  return {
    status: response.status,
    body: response.body as ApiBody,
    dependencies: (response.body.dependencies ?? []) as DependencyDto[],
  };
}

export function findTask(tasks: TaskDto[], taskId: string): TaskDto {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`Tugas ${taskId} tidak ada pada respons`);
  return task;
}
