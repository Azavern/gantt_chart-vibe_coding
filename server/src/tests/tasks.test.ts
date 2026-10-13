import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TaskDto } from '@gantt/shared';

import { app, auth, createProject, createTask, findTask, registerUser, resetDatabase, type TestUser } from './helpers';

let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  user = await registerUser({ name: 'Pemilik Proyek' });
});

describe('tugas', () => {
  it('membuat, mengubah, dan menghapus tugas', async () => {
    const project = await createProject(user.token, { startDate: '2026-10-19' });

    const created = await createTask(user.token, project.id, {
      name: 'Analisis kebutuhan',
      durationDays: 3,
      startDate: '2026-10-19',
      priority: 'HIGH',
      color: '#1D4ED8',
      progress: 20,
    });

    expect(created.status).toBe(201);
    expect(created.tasks).toHaveLength(1);
    expect(created.tasks[0]).toMatchObject({
      name: 'Analisis kebutuhan',
      durationDays: 3,
      priority: 'HIGH',
      color: '#1D4ED8',
      progress: 20,
      scheduledStart: '2026-10-19',
      scheduledEnd: '2026-10-21',
    });

    const updated = await request(app)
      .patch(`/api/tasks/${created.taskId}`)
      .set(auth(user.token))
      .send({ durationDays: 5, priority: 'LOW', progress: 100 });

    expect(updated.status).toBe(200);
    const afterUpdate = findTask(updated.body.tasks as TaskDto[], created.taskId);
    expect(afterUpdate.durationDays).toBe(5);
    expect(afterUpdate.scheduledEnd).toBe('2026-10-23');
    expect(afterUpdate.priority).toBe('LOW');
    expect(afterUpdate.progress).toBe(100);

    const deleted = await request(app)
      .delete(`/api/tasks/${created.taskId}`)
      .set(auth(user.token));

    expect(deleted.status).toBe(200);
    expect(deleted.body.tasks).toHaveLength(0);
  });

  it('menghitung rentang dan progres tugas induk dari anak-anaknya', async () => {
    const project = await createProject(user.token, { startDate: '2026-10-19' });

    const parent = await createTask(user.token, project.id, {
      name: 'Fase Desain',
      durationDays: 1,
      startDate: '2026-10-19',
    });

    const childA = await createTask(user.token, project.id, {
      name: 'Wireframe',
      parentId: parent.taskId,
      durationDays: 4,
      startDate: '2026-10-19',
      progress: 100,
    });

    const childB = await createTask(user.token, project.id, {
      name: 'Prototipe',
      parentId: parent.taskId,
      durationDays: 6,
      startDate: '2026-10-26',
      progress: 0,
    });

    const tasks = childB.tasks;
    const parentTask = findTask(tasks, parent.taskId);

    expect(parentTask.scheduledStart).toBe('2026-10-19');
    expect(parentTask.scheduledEnd).toBe(findTask(tasks, childB.taskId).scheduledEnd);
    // Rentang induk 19 Oktober - 2 November = 11 hari kerja.
    expect(parentTask.durationDays).toBe(11);
    // Progres berbobot durasi anak: (100 x 4 + 0 x 6) / 10 = 40
    expect(parentTask.progress).toBe(40);

    expect(findTask(tasks, childA.taskId).scheduledEnd).toBe('2026-10-22');
  });

  it('menolak perubahan durasi pada tugas induk', async () => {
    const project = await createProject(user.token);
    const parent = await createTask(user.token, project.id, {
      name: 'Fase Pengujian',
      durationDays: 2,
      startDate: '2026-10-19',
    });
    await createTask(user.token, project.id, {
      name: 'Skenario uji',
      parentId: parent.taskId,
      durationDays: 3,
      startDate: '2026-10-19',
    });

    const response = await request(app)
      .patch(`/api/tasks/${parent.taskId}`)
      .set(auth(user.token))
      .send({ durationDays: 9 });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SUMMARY_TASK_READONLY');
  });

  it('menolak kedalaman lebih dari 3 level', async () => {
    const project = await createProject(user.token);
    const level1 = await createTask(user.token, project.id, { name: 'L1', durationDays: 1, startDate: '2026-10-19' });
    const level2 = await createTask(user.token, project.id, {
      name: 'L2',
      parentId: level1.taskId,
      durationDays: 1,
      startDate: '2026-10-19',
    });
    const level3 = await createTask(user.token, project.id, {
      name: 'L3',
      parentId: level2.taskId,
      durationDays: 1,
      startDate: '2026-10-19',
    });

    expect(level3.status).toBe(201);

    const level4 = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(user.token))
      .send({ name: 'L4', parentId: level3.taskId, durationDays: 1, startDate: '2026-10-19' });

    expect(level4.status).toBe(422);
    expect(level4.body.error.code).toBe('MAX_DEPTH_EXCEEDED');
  });

  it('memindahkan tugas ke induk lain beserta urutannya', async () => {
    const project = await createProject(user.token);
    const faseA = await createTask(user.token, project.id, { name: 'Fase A', durationDays: 1, startDate: '2026-10-19' });
    const faseB = await createTask(user.token, project.id, { name: 'Fase B', durationDays: 1, startDate: '2026-10-19' });
    const tugas = await createTask(user.token, project.id, { name: 'Tugas Lepas', durationDays: 2, startDate: '2026-10-19' });

    const moved = await request(app)
      .post(`/api/tasks/${tugas.taskId}/move`)
      .set(auth(user.token))
      .send({ parentId: faseB.taskId, position: 0 });

    expect(moved.status).toBe(200);
    expect(findTask(moved.body.tasks as TaskDto[], tugas.taskId).parentId).toBe(faseB.taskId);

    // Induk yang hanya punya satu anak tetap menghitung jadwalnya dari anak.
    expect(findTask(moved.body.tasks as TaskDto[], faseB.taskId).durationDays).toBe(2);
    expect(findTask(moved.body.tasks as TaskDto[], faseA.taskId).parentId).toBeNull();
  });

  it('menolak pemindahan tugas ke bawah turunannya sendiri', async () => {
    const project = await createProject(user.token);
    const induk = await createTask(user.token, project.id, { name: 'Induk', durationDays: 1, startDate: '2026-10-19' });
    const anak = await createTask(user.token, project.id, {
      name: 'Anak',
      parentId: induk.taskId,
      durationDays: 1,
      startDate: '2026-10-19',
    });

    const response = await request(app)
      .post(`/api/tasks/${induk.taskId}/move`)
      .set(auth(user.token))
      .send({ parentId: anak.taskId, position: 0 });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_PARENT');
  });

  it('menolak penambahan anak pada tugas yang sudah punya dependensi', async () => {
    const project = await createProject(user.token);
    const a = await createTask(user.token, project.id, { name: 'A', durationDays: 2, startDate: '2026-10-19' });
    const b = await createTask(user.token, project.id, { name: 'B', durationDays: 2, startDate: '2026-10-19' });

    await request(app)
      .post(`/api/tasks/${b.taskId}/dependencies`)
      .set(auth(user.token))
      .send({ predecessorId: a.taskId, type: 'FS', lagDays: 0 });

    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(user.token))
      .send({ name: 'Anak B', parentId: b.taskId, durationDays: 1, startDate: '2026-10-19' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TASK_HAS_RELATIONS');
  });

  it('memvalidasi input tugas dengan skema bersama', async () => {
    const project = await createProject(user.token);

    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(user.token))
      .send({ name: '', durationDays: 0, startDate: '23-10-2026', color: 'biru' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields.durationDays[0]).toMatch(/minimal 1 hari/i);
    expect(response.body.error.details.fields.startDate[0]).toMatch(/YYYY-MM-DD/);
  });
});
