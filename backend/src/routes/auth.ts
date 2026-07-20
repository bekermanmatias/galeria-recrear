import { Router } from 'express';
import { z } from 'zod';
import { clearSession, createSession, hashPassword, verifyPassword, writeSession } from '../auth.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { asyncHandler } from '../http.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await query<{ id: string; name: string; email: string; role: 'ADMIN' | 'COORDINATOR' | 'PARENT'; password_hash: string }>('SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = lower($1) AND active', [input.email]);
  const user = result.rows[0];
  if (!user || !(await verifyPassword(input.password, user.password_hash))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
  const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  writeSession(res, await createSession(sessionUser));
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  res.json({ user: sessionUser });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.galeria_session;
  if (token) await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = encode(digest($1, \'sha256\'), \'hex\') AND revoked_at IS NULL', [token]);
  clearSession(res);
  res.status(204).end();
}));

authRouter.get('/me', (req, res) => res.json({ user: req.user }));

authRouter.post('/change-password', asyncHandler(async (req, res) => {
  const input = passwordSchema.parse(req.body);
  const result = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
  if (!result.rows[0] || !(await verifyPassword(input.currentPassword, result.rows[0].password_hash))) throw new AppError(400, 'INVALID_PASSWORD', 'La contraseña actual es incorrecta');
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(input.newPassword), req.user!.id]);
  res.status(204).end();
}));
