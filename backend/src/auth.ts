import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { query } from './db.js';
import { AppError } from './errors.js';

export type Role = 'ADMIN' | 'COORDINATOR' | 'PARENT';
export interface CurrentUser { id: string; name: string; email: string; role: Role; }
declare global { namespace Express { interface Request { user?: CurrentUser; } } }

const cookieName = 'galeria_session';
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, passwordHash: string) { return bcrypt.compare(password, passwordHash); }

export async function createSession(user: CurrentUser) {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign({ sub: user.id, sid: tokenId, role: user.role }, config.SESSION_SECRET, { expiresIn: `${config.SESSION_DAYS}d` });
  await query('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + ($4 || \' days\')::interval)', [tokenId, user.id, hash(token), String(config.SESSION_DAYS)]);
  return token;
}

export function writeSession(res: Response, token: string) {
  res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production', maxAge: config.SESSION_DAYS * 86400000, path: '/' });
}

export function clearSession(res: Response) { res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production', path: '/' }); }

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const token = req.cookies?.[cookieName] || bearer;
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar');
    const payload = jwt.verify(token, config.SESSION_SECRET) as jwt.JwtPayload;
    if (!payload.sub || !payload.sid) throw new AppError(401, 'INVALID_SESSION', 'Sesión inválida');
    const result = await query<CurrentUser>('SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.token_hash = $2 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active', [payload.sid, hash(token)]);
    if (!result.rowCount) throw new AppError(401, 'SESSION_EXPIRED', 'La sesión venció o fue revocada');
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'INVALID_SESSION', 'Sesión inválida'));
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar'));
    if (!roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN_ROLE', 'No tenés permisos para esta acción'));
    next();
  };
}

export async function assertSchoolAccess(user: CurrentUser, schoolId: string, allowed: Role[] = ['COORDINATOR', 'PARENT']) {
  if (user.role === 'ADMIN') return;
  if (!allowed.includes(user.role)) throw new AppError(403, 'FORBIDDEN_SCHOOL', 'No tenés acceso a este colegio');
  const membership = await query('SELECT 1 FROM user_schools WHERE user_id = $1 AND school_id = $2 AND membership_role = $3 AND active', [user.id, schoolId, user.role]);
  if (!membership.rowCount) throw new AppError(403, 'FORBIDDEN_SCHOOL', 'No tenés acceso a este colegio');
}
