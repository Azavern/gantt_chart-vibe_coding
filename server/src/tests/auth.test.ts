import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app, auth, resetDatabase } from './helpers';

beforeAll(resetDatabase);

const email = 'auth.utama@example.com';
const password = 'Password123';

describe('auth', () => {
  it('mendaftarkan pengguna baru dan mengembalikan token tanpa passwordHash', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Siti Aminah', email, password });

    expect(response.status).toBe(201);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user).toMatchObject({ name: 'Siti Aminah', email });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('menolak pendaftaran dengan email yang sama', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Siti Aminah', email, password });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
    expect(response.body.error.message).toMatch(/sudah terdaftar/i);
  });

  it('menolak password kurang dari 8 karakter dengan pesan per field', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Pengguna Baru', email: 'auth.pendek@example.com', password: 'pendek' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields.password[0]).toMatch(/minimal 8 karakter/i);
  });

  it('menolak login dengan password salah', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'PasswordSalah' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('login berhasil mengembalikan token yang bisa dipakai ke /auth/me', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set(auth(login.body.token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it('menolak akses tanpa token dan dengan token palsu', async () => {
    const tanpaToken = await request(app).get('/api/projects');
    expect(tanpaToken.status).toBe(401);
    expect(tanpaToken.body.error.code).toBe('UNAUTHENTICATED');

    const tokenPalsu = await request(app).get('/api/projects').set(auth('token.palsu.tidak-valid'));
    expect(tokenPalsu.status).toBe(401);
  });

  it('mengembalikan 404 untuk endpoint yang tidak ada', async () => {
    const response = await request(app).get('/api/tidak-ada');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
