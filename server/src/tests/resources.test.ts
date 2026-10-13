import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TaskDto } from '@gantt/shared';

import { app, auth, createProject, createResource, createTask, registerUser, resetDatabase, type TestUser } from './helpers';

let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  user = await registerUser({ name: 'Manajer Tim' });
});

async function assign(
  token: string,
  taskId: string,
  body: { resourceId: string; allocationPercent?: number },
) {
  return request(app).post(`/api/tasks/${taskId}/assignments`).set(auth(token)).send(body);
}

describe('resource dan alokasi', () => {
  it('menambah, mengubah, dan menghapus anggota tim', async () => {
    const project = await createProject(user.token);

    const created = await createResource(user.token, project.id, {
      name: 'Andi Pratama',
      role: 'Project Manager',
      salary: 15_000_000,
    });

    expect(created).toMatchObject({ name: 'Andi Pratama', role: 'Project Manager', salary: 15_000_000 });

    const list = await request(app).get(`/api/projects/${project.id}/resources`).set(auth(user.token));
    expect(list.body.resources).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/resources/${created.id}`)
      .set(auth(user.token))
      .send({ salary: 16_500_000, role: 'Senior Project Manager' });

    expect(updated.status).toBe(200);
    expect(updated.body.resource).toMatchObject({ salary: 16_500_000, role: 'Senior Project Manager' });

    const deleted = await request(app).delete(`/api/resources/${created.id}`).set(auth(user.token));
    expect(deleted.status).toBe(200);
    expect(deleted.body.resources).toHaveLength(0);
  });

  it('mengalokasikan anggota ke tugas daun dan menghitung biaya', async () => {
    const project = await createProject(user.token);
    const task = await createTask(user.token, project.id, {
      name: 'Implementasi backend',
      durationDays: 5,
      startDate: '2026-10-19',
    });
    const resource = await createResource(user.token, project.id, { name: 'Budi Santoso', salary: 22_000_000 });

    const response = await assign(user.token, task.taskId, {
      resourceId: resource.id,
      allocationPercent: 50,
    });

    expect(response.status).toBe(201);
    expect(response.body.assignments).toHaveLength(1);
    expect(response.body.assignments[0]).toMatchObject({ allocationPercent: 50 });

    const analysis = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(auth(user.token));

    // Tarif harian 22.000.000 / 22 = 1.000.000; 1.000.000 x 5 hari x 50% = 2.500.000.
    expect(analysis.body.cost.total).toBe(2_500_000);
  });

  it('menolak alokasi duplikat, alokasi tidak valid, dan alokasi pada tugas induk', async () => {
    const project = await createProject(user.token);
    const parent = await createTask(user.token, project.id, { name: 'Induk', durationDays: 1, startDate: '2026-10-19' });
    const child = await createTask(user.token, project.id, {
      name: 'Anak',
      parentId: parent.taskId,
      durationDays: 3,
      startDate: '2026-10-19',
    });
    const resource = await createResource(user.token, project.id, { name: 'Citra Lestari' });

    const duplikatAwal = await assign(user.token, child.taskId, { resourceId: resource.id });
    expect(duplikatAwal.status).toBe(201);

    const duplikat = await assign(user.token, child.taskId, { resourceId: resource.id });
    expect(duplikat.status).toBe(409);

    const tidakValid = await assign(user.token, child.taskId, {
      resourceId: resource.id,
      allocationPercent: 0,
    });
    expect(tidakValid.status).toBe(422);
    expect(tidakValid.body.error.code).toBe('VALIDATION_ERROR');

    const padaInduk = await assign(user.token, parent.taskId, { resourceId: resource.id });
    expect(padaInduk.status).toBe(422);
    expect(padaInduk.body.error.code).toBe('LEAF_ONLY');
  });

  it('memperingatkan over-alokasi ketika tugas anggota tumpang tindih', async () => {
    const project = await createProject(user.token);
    const taskA = await createTask(user.token, project.id, { name: 'Tugas A', durationDays: 3, startDate: '2026-10-19' });
    const taskB = await createTask(user.token, project.id, { name: 'Tugas B', durationDays: 3, startDate: '2026-10-19' });
    const resource = await createResource(user.token, project.id, { name: 'Dewi Anggraini', salary: 9_000_000 });

    await assign(user.token, taskA.taskId, { resourceId: resource.id, allocationPercent: 60 });
    await assign(user.token, taskB.taskId, { resourceId: resource.id, allocationPercent: 60 });

    const analysis = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(auth(user.token));

    expect(analysis.body.overAllocations).toHaveLength(3);
    expect(analysis.body.overAllocations[0]).toMatchObject({
      resourceName: 'Dewi Anggraini',
      totalPercent: 120,
    });

    const row = analysis.body.resources.find(
      (item: { resourceId: string }) => item.resourceId === resource.id,
    );
    expect(row.overAllocated).toBe(true);

    // Mengurangi alokasi menghilangkan peringatan.
    const assignment = analysis.body.overAllocations[0];
    expect(assignment.taskIds).toHaveLength(2);
  });

  it('menghapus alokasi anggota dan tugasnya tetap utuh', async () => {
    const project = await createProject(user.token);
    const task = await createTask(user.token, project.id, { name: 'Tugas', durationDays: 2, startDate: '2026-10-19' });
    const resource = await createResource(user.token, project.id, { name: 'Anggota' });

    const created = await assign(user.token, task.taskId, { resourceId: resource.id });
    const assignmentId = created.body.assignments[0].id as string;

    const patched = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set(auth(user.token))
      .send({ allocationPercent: 25 });

    expect(patched.status).toBe(200);
    expect(patched.body.assignments[0].allocationPercent).toBe(25);

    const deleted = await request(app)
      .delete(`/api/assignments/${assignmentId}`)
      .set(auth(user.token));

    expect(deleted.status).toBe(200);
    expect(deleted.body.assignments).toHaveLength(0);

    const snapshot = await request(app).get(`/api/projects/${project.id}`).set(auth(user.token));
    expect((snapshot.body.tasks as TaskDto[]).some((item) => item.id === task.taskId)).toBe(true);
  });
});
