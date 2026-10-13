import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TaskDto } from '@gantt/shared';

import { app, auth, createProject, createTask, findTask, registerUser, resetDatabase, type TestUser } from './helpers';

let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  user = await registerUser({ name: 'Pengatur Kalender' });
});

describe('kalender proyek', () => {
  it('menggeser jadwal otomatis saat akhir pekan diubah', async () => {
    const project = await createProject(user.token, { weekendDays: [0, 6] });
    const task = await createTask(user.token, project.id, {
      name: 'Pekerjaan lima hari',
      durationDays: 5,
      startDate: '2026-10-19',
    });

    expect(findTask(task.tasks, task.taskId).scheduledEnd).toBe('2026-10-23');

    // Akhir pekan dipindah ke Jumat dan Sabtu, sehingga Minggu menjadi hari kerja.
    const response = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(auth(user.token))
      .send({ weekendDays: [5, 6] });

    expect(response.status).toBe(200);
    expect(response.body.project.weekendDays).toEqual([5, 6]);
    expect(findTask(response.body.tasks as TaskDto[], task.taskId).scheduledEnd).toBe('2026-10-25');
  });

  it('durasi tidak menghitung hari libur (vektor uji blueprint)', async () => {
    const project = await createProject(user.token, { weekendDays: [0, 6] });
    const task = await createTask(user.token, project.id, {
      name: 'Pekerjaan tiga hari',
      durationDays: 3,
      startDate: '2026-10-23',
    });

    expect(findTask(task.tasks, task.taskId).scheduledEnd).toBe('2026-10-27');

    const withHoliday = await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(auth(user.token))
      .send({ date: '2026-10-26', name: 'Cuti bersama' });

    expect(withHoliday.status).toBe(201);
    expect(withHoliday.body.holidays).toHaveLength(1);
    expect(findTask(withHoliday.body.tasks as TaskDto[], task.taskId).scheduledEnd).toBe('2026-10-28');

    const holidayId = withHoliday.body.holidays[0].id as string;

    const removed = await request(app)
      .delete(`/api/holidays/${holidayId}`)
      .set(auth(user.token));

    expect(removed.status).toBe(200);
    expect(removed.body.holidays).toHaveLength(0);
    expect(findTask(removed.body.tasks as TaskDto[], task.taskId).scheduledEnd).toBe('2026-10-27');
  });

  it('menolak hari libur ganda pada tanggal yang sama', async () => {
    const project = await createProject(user.token);
    await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(auth(user.token))
      .send({ date: '2026-12-25', name: 'Natal' });

    const duplicate = await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(auth(user.token))
      .send({ date: '2026-12-25', name: 'Natal lagi' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('menolak akhir pekan yang berisi ketujuh hari', async () => {
    const project = await createProject(user.token);

    const response = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(auth(user.token))
      .send({ weekendDays: [0, 1, 2, 3, 4, 5, 6] });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields.weekendDays[0]).toMatch(/ketujuh hari/i);
  });
});
