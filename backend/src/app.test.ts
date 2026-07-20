import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/galeria_recrear';
  process.env.SESSION_SECRET = 'test-session-secret-at-least-16';
});
vi.mock('./db.js', () => ({ query: vi.fn(), transaction: vi.fn(), closeDatabase: vi.fn() }));

const { query } = await import('./db.js');
const { createApp } = await import('./app.js');
const bcrypt = await import('bcryptjs');
const request = (await import('supertest')).default;

describe('Galería Recrear API', () => {
  beforeEach(() => vi.mocked(query).mockReset());

  it('rejects protected routes without a session', async () => {
    const response = await request(createApp()).get('/api/v1/lots');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('logs in an active user and creates a session', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ id: '6b7c70b2-3b86-4d4b-a1c5-2c0a1eb4ee42', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', password_hash: passwordHash }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const response = await request(createApp()).post('/api/v1/auth/login').send({ email: 'admin@example.com', password: 'correct-password' });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.headers['set-cookie'][0]).toContain('galeria_session=');
  });
});
