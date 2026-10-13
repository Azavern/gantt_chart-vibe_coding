import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app, auth, createProject, createTask, registerUser, resetDatabase, type TestUser } from './helpers';

let pemilik: TestUser;
let penggunaLain: TestUser;

beforeAll(async () => {
  await resetDatabase();
  pemilik = await registerUser({ name: 'Pemilik' });
  penggunaLain = await registerUser({ name: 'Pengguna Lain' });
});

describe('batas akses antar pengguna', () => {
  it('menyembunyikan proyek pengguna lain dengan 404', async () => {
    const project = await createProject(pemilik.token, { name: 'Proyek Rahasia' });
    const task = await createTask(pemilik.token, project.id, {
      name: 'Tugas Rahasia',
      durationDays: 2,
      startDate: '2026-10-19',
    });

    const detail = await request(app).get(`/api/projects/${project.id}`).set(auth(penggunaLain.token));
    expect(detail.status).toBe(404);

    const analysis = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(auth(penggunaLain.token));
    expect(analysis.status).toBe(404);

    const ubahTugas = await request(app)
      .patch(`/api/tasks/${task.taskId}`)
      .set(auth(penggunaLain.token))
      .send({ name: 'Diubah orang lain' });
    expect(ubahTugas.status).toBe(404);

    const hapusTugas = await request(app)
      .delete(`/api/tasks/${task.taskId}`)
      .set(auth(penggunaLain.token));
    expect(hapusTugas.status).toBe(404);

    const tambahTugas = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(penggunaLain.token))
      .send({ name: 'Tugas Sisipan', durationDays: 1, startDate: '2026-10-19' });
    expect(tambahTugas.status).toBe(404);

    const daftarTim = await request(app)
      .get(`/api/projects/${project.id}/resources`)
      .set(auth(penggunaLain.token));
    expect(daftarTim.status).toBe(404);

    const hapusProyek = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set(auth(penggunaLain.token));
    expect(hapusProyek.status).toBe(404);
  });

  it('hanya menampilkan proyek milik pengguna yang masuk', async () => {
    const daftarLain = await request(app).get('/api/projects').set(auth(penggunaLain.token));
    expect(daftarLain.status).toBe(200);
    expect(daftarLain.body.projects).toHaveLength(0);

    const daftarPemilik = await request(app).get('/api/projects').set(auth(pemilik.token));
    expect(daftarPemilik.body.projects).toHaveLength(1);
    expect(daftarPemilik.body.projects[0].name).toBe('Proyek Rahasia');
  });

  it('tidak mengubah data pemilik saat permintaan pengguna lain ditolak', async () => {
    const daftar = await request(app).get('/api/projects').set(auth(pemilik.token));
    const projectId = daftar.body.projects[0].id as string;

    const snapshot = await request(app).get(`/api/projects/${projectId}`).set(auth(pemilik.token));
    expect(snapshot.body.tasks).toHaveLength(1);

    const taskId = snapshot.body.tasks[0].id as string;
    const respons = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth(penggunaLain.token))
      .send({ name: 'Diubah orang lain' });

    expect(respons.status).toBe(404);

    const setelah = await request(app).get(`/api/projects/${projectId}`).set(auth(pemilik.token));
    expect(setelah.body.tasks[0].name).toBe('Tugas Rahasia');
  });
});
