import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TaskDto } from '@gantt/shared';

import { app, addDependency, auth, createProject, createTask, findTask, registerUser, resetDatabase, type TestUser } from './helpers';

let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  user = await registerUser({ name: 'Pengelola Jadwal' });
});

describe('dependensi', () => {
  it('menerapkan FS lag 0 sesuai vektor uji blueprint', async () => {
    const project = await createProject(user.token);
    const a = await createTask(user.token, project.id, {
      name: 'A',
      durationDays: 3,
      startDate: '2026-10-23',
    });
    const b = await createTask(user.token, project.id, {
      name: 'B',
      durationDays: 2,
      startDate: '2026-10-23',
    });

    const result = await addDependency(user.token, b.taskId, {
      predecessorId: a.taskId,
      type: 'FS',
      lagDays: 0,
    });

    expect(result.status).toBe(201);
    const tugasA = findTask(result.body.tasks as TaskDto[], a.taskId);
    const tugasB = findTask(result.body.tasks as TaskDto[], b.taskId);

    expect(tugasA.scheduledEnd).toBe('2026-10-27');
    expect(tugasB.scheduledStart).toBe('2026-10-28');
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toMatchObject({ type: 'FS', lagDays: 0 });
  });

  it('menerapkan SS lag 2 sesuai vektor uji blueprint', async () => {
    const project = await createProject(user.token);
    const a = await createTask(user.token, project.id, {
      name: 'A',
      durationDays: 3,
      startDate: '2026-10-23',
    });
    const b = await createTask(user.token, project.id, {
      name: 'B',
      durationDays: 2,
      startDate: '2026-10-23',
    });

    const result = await addDependency(user.token, b.taskId, {
      predecessorId: a.taskId,
      type: 'SS',
      lagDays: 2,
    });

    expect(result.status).toBe(201);
    expect(findTask(result.body.tasks as TaskDto[], b.taskId).scheduledStart).toBe('2026-10-27');
  });

  it('menolak dependensi ke diri sendiri, duplikat, dan pada tugas induk', async () => {
    const project = await createProject(user.token);
    const a = await createTask(user.token, project.id, { name: 'A', durationDays: 2, startDate: '2026-10-19' });
    const b = await createTask(user.token, project.id, { name: 'B', durationDays: 2, startDate: '2026-10-19' });

    const diriSendiri = await addDependency(user.token, a.taskId, {
      predecessorId: a.taskId,
      type: 'FS',
    });
    expect(diriSendiri.status).toBe(422);
    expect(diriSendiri.body.error.code).toBe('SELF_DEPENDENCY');

    await addDependency(user.token, b.taskId, { predecessorId: a.taskId, type: 'FS' });
    const duplikat = await addDependency(user.token, b.taskId, { predecessorId: a.taskId, type: 'SS' });
    expect(duplikat.status).toBe(422);
    expect(duplikat.body.error.code).toBe('DUPLICATE_DEPENDENCY');

    const induk = await createTask(user.token, project.id, { name: 'Induk', durationDays: 1, startDate: '2026-10-19' });
    await createTask(user.token, project.id, {
      name: 'Anak',
      parentId: induk.taskId,
      durationDays: 2,
      startDate: '2026-10-19',
    });

    const pakaiInduk = await addDependency(user.token, b.taskId, {
      predecessorId: induk.taskId,
      type: 'FS',
    });
    expect(pakaiInduk.status).toBe(422);
    expect(pakaiInduk.body.error.code).toBe('LEAF_ONLY');
  });

  it('menolak dependensi yang membentuk siklus dengan kode CYCLE_DETECTED', async () => {
    const project = await createProject(user.token);
    const a = await createTask(user.token, project.id, { name: 'A', durationDays: 2, startDate: '2026-10-19' });
    const b = await createTask(user.token, project.id, { name: 'B', durationDays: 2, startDate: '2026-10-19' });
    const c = await createTask(user.token, project.id, { name: 'C', durationDays: 2, startDate: '2026-10-19' });

    await addDependency(user.token, b.taskId, { predecessorId: a.taskId, type: 'FS' });
    await addDependency(user.token, c.taskId, { predecessorId: b.taskId, type: 'FS' });

    const siklus = await addDependency(user.token, a.taskId, { predecessorId: c.taskId, type: 'FS' });

    expect(siklus.status).toBe(422);
    expect(siklus.body.error.code).toBe('CYCLE_DETECTED');
    expect(siklus.body.error.message).toMatch(/siklus/i);
  });

  it('mengubah dan menghapus dependensi lalu menghitung ulang jadwal', async () => {
    const project = await createProject(user.token);
    const a = await createTask(user.token, project.id, { name: 'A', durationDays: 5, startDate: '2026-10-19' });
    const b = await createTask(user.token, project.id, { name: 'B', durationDays: 1, startDate: '2026-10-19' });

    const created = await addDependency(user.token, b.taskId, {
      predecessorId: a.taskId,
      type: 'FS',
      lagDays: 0,
    });
    const dependencyId = created.dependencies[0].id;

    const patched = await request(app)
      .patch(`/api/dependencies/${dependencyId}`)
      .set(auth(user.token))
      .send({ lagDays: 3 });

    expect(patched.status).toBe(200);
    expect(findTask(patched.body.tasks as TaskDto[], b.taskId).scheduledStart).toBe('2026-10-29');

    const deleted = await request(app)
      .delete(`/api/dependencies/${dependencyId}`)
      .set(auth(user.token));

    expect(deleted.status).toBe(200);
    expect(findTask(deleted.body.tasks as TaskDto[], b.taskId).scheduledStart).toBe('2026-10-19');
    expect(deleted.body.dependencies).toHaveLength(0);
  });
});
