import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app, addDependency, auth, createProject, createTask, registerUser, resetDatabase, type TestUser } from './helpers';

let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  user = await registerUser({ name: 'Analis Proyek' });
});

describe('analisis proyek', () => {
  it('menghitung critical path sesuai vektor uji blueprint', async () => {
    const project = await createProject(user.token, { startDate: '2026-10-19' });

    const a = await createTask(user.token, project.id, { name: 'A', durationDays: 3, startDate: '2026-10-19' });
    const b = await createTask(user.token, project.id, { name: 'B', durationDays: 2, startDate: '2026-10-19' });
    const c = await createTask(user.token, project.id, { name: 'C', durationDays: 5, startDate: '2026-10-19' });
    const d = await createTask(user.token, project.id, { name: 'D', durationDays: 1, startDate: '2026-10-19' });

    await addDependency(user.token, b.taskId, { predecessorId: a.taskId, type: 'FS' });
    await addDependency(user.token, c.taskId, { predecessorId: a.taskId, type: 'FS' });
    await addDependency(user.token, d.taskId, { predecessorId: b.taskId, type: 'FS' });
    await addDependency(user.token, d.taskId, { predecessorId: c.taskId, type: 'FS' });

    const response = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(auth(user.token));

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      startDate: '2026-10-19',
      endDate: '2026-10-29',
      totalWorkingDays: 9,
      criticalTaskCount: 3,
      leafTaskCount: 4,
    });

    const rowB = response.body.cpm.find((row: { name: string }) => row.name === 'B');
    expect(rowB).toMatchObject({ es: 3, ef: 4, ls: 6, lf: 7, totalFloat: 3, critical: false });

    expect(
      response.body.criticalPath.map(
        (taskId: string) => response.body.cpm.find((row: { taskId: string }) => row.taskId === taskId).name,
      ),
    ).toEqual(['A', 'C', 'D']);
  });

  it('mengirim data PERT dengan node kritis dan panah kritis', async () => {
    const project = await createProject(user.token, { startDate: '2026-10-19' });

    const a = await createTask(user.token, project.id, {
      name: 'Rancangan',
      durationDays: 3,
      startDate: '2026-10-19',
      optimisticDays: 2,
      pessimisticDays: 5,
    });
    const b = await createTask(user.token, project.id, { name: 'Implementasi', durationDays: 2, startDate: '2026-10-19' });
    const c = await createTask(user.token, project.id, { name: 'Cadangan', durationDays: 1, startDate: '2026-10-19' });

    await addDependency(user.token, b.taskId, { predecessorId: a.taskId, type: 'FS' });
    await addDependency(user.token, c.taskId, { predecessorId: a.taskId, type: 'FS', lagDays: 8 });

    const response = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(auth(user.token));

    const nodeA = response.body.pert.nodes.find((node: { name: string }) => node.name === 'Rancangan');
    expect(nodeA).toMatchObject({ es: 0, ef: 2, slack: 0, critical: true, column: 0 });
    expect(nodeA.te).toBeCloseTo(19 / 6, 5);
    expect(nodeA.variance).toBeCloseTo(0.25, 5);

    // Tugas 'Cadangan' kritis karena batas FS lag 8 menentukan akhir proyek.
    const nodeCadangan = response.body.pert.nodes.find((node: { name: string }) => node.name === 'Cadangan');
    expect(nodeCadangan).toMatchObject({ critical: true, column: 1 });

    const nodeImplementasi = response.body.pert.nodes.find((node: { name: string }) => node.name === 'Implementasi');
    expect(nodeImplementasi).toMatchObject({ critical: false, slack: 7 });

    const edgeKeCadangan = response.body.pert.edges.find(
      (edge: { successorId: string }) => edge.successorId === c.taskId,
    );
    expect(edgeKeCadangan.critical).toBe(true);

    const edgeKeImplementasi = response.body.pert.edges.find(
      (edge: { successorId: string }) => edge.successorId === b.taskId,
    );
    expect(edgeKeImplementasi.critical).toBe(false);

    // Hanya node A pada jalur kritis (A -> Cadangan) yang punya estimasi tiga titik.
    expect(response.body.pert.criticalPath).toEqual([a.taskId, c.taskId]);
    expect(response.body.pert.totalVariance).toBeCloseTo(0.25, 5);
    expect(response.body.pert.standardDeviation).toBeCloseTo(0.5, 5);
    expect(response.body.pert.expectedDuration).toBeCloseTo(19 / 6, 5);
  });

  it('menjumlahkan biaya proyek hanya dari tugas daun', async () => {
    const project = await createProject(user.token, { startDate: '2026-10-19' });
    const parent = await createTask(user.token, project.id, { name: 'Fase', durationDays: 1, startDate: '2026-10-19' });
    const child = await createTask(user.token, project.id, {
      name: 'Detail',
      parentId: parent.taskId,
      durationDays: 4,
      startDate: '2026-10-19',
    });

    const resource = await request(app)
      .post(`/api/projects/${project.id}/resources`)
      .set(auth(user.token))
      .send({ name: 'Andi', email: 'andi.analisis@example.com', role: 'PM', salary: 22_000_000 });

    await request(app)
      .post(`/api/tasks/${child.taskId}/assignments`)
      .set(auth(user.token))
      .send({ resourceId: resource.body.resource.id, allocationPercent: 100 });

    const response = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(auth(user.token));

    // 1.000.000 x 4 hari = 4.000.000, hanya dari tugas daun.
    expect(response.body.cost.total).toBe(4_000_000);
    expect(response.body.cost.byResource).toEqual([
      { resourceId: resource.body.resource.id, totalCost: 4_000_000 },
    ]);
  });

  it('mengembalikan analisis kosong untuk proyek tanpa tugas', async () => {
    const project = await createProject(user.token);

    const response = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(auth(user.token));

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ startDate: null, endDate: null, criticalTaskCount: 0 });
    expect(response.body.cpm).toEqual([]);
    expect(response.body.criticalPath).toEqual([]);
  });
});
