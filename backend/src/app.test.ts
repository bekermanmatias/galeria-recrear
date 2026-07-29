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

  it('rejects an invalid public link without exposing a session-protected route', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const token = 'a'.repeat(43);
    const response = await request(createApp()).get('/api/v1/public/' + token);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PUBLIC_LINK_NOT_FOUND');
    expect(response.headers['x-robots-tag']).toContain('noindex');
    expect(response.headers['cache-control']).toContain('no-store');
  });
  it('lists only the published albums resolved by an active public link', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ school_id: '7a5edc1e-19fd-4276-8a44-0aebbb6f5c5d', school_name: 'Colegio Norte' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'cf59b2d3-e5a7-4c14-b5e7-abc0bbf00a1b', school_name: 'Colegio Norte', status: 'PUBLISHED' }], rowCount: 1 } as never);
    const response = await request(createApp()).get('/api/v1/public/' + 'b'.repeat(43));
    expect(response.status).toBe(200);
    expect(response.body.school.name).toBe('Colegio Norte');
    expect(response.body.items).toHaveLength(1);
    expect(vi.mocked(query).mock.calls[1][1]).toEqual(['7a5edc1e-19fd-4276-8a44-0aebbb6f5c5d']);
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
