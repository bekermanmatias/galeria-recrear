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
  res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: config.SESSION_DAYS * 86400000, path: '/' });
}

export function clearSession(res: Response) { res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' }); }

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const token = req.cookies?.[cookieName] || bearer;
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Inici? sesión para continuar');
    const payload = jwt.verify(token, config.SESSION_SECRET) as jwt.JwtPayload;
    if (!payload.sub || !payload.sid) throw new AppError(401, 'INVALID_SESSION', 'Sesión inválida');
    const result = await query<CurrentUser>('SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.token_hash = $2 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active', [payload.sid, hash(token)]);
    if (!result.rowCount) throw new AppError(401, 'SESSION_EXPIRED', 'La sesión venci? o fue revocada');
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'INVALID_SESSION', 'Sesión inválida'));
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Inici? sesión para continuar'));
    if (!roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN_ROLE', 'No tenés permisos para esta acción'));
    next();
  };
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
export type PermissionModule = 'departures' | 'lots' | 'moderation' | 'gallery' | 'activities' | 'schools' | 'passengers' | 'users' | 'imports';
const defaultPermissions: Record<PermissionModule, Record<PermissionAction, boolean>> = {
  departures:{view:true,create:false,edit:false,delete:false}, lots:{view:true,create:true,edit:true,delete:false}, moderation:{view:false,create:false,edit:false,delete:false}, gallery:{view:true,create:false,edit:false,delete:false}, activities:{view:false,create:false,edit:false,delete:false}, schools:{view:false,create:false,edit:false,delete:false}, passengers:{view:false,create:false,edit:false,delete:false}, users:{view:false,create:false,edit:false,delete:false}, imports:{view:false,create:false,edit:false,delete:false}
};
export function getDefaultPermissions(role: Role) { if (role === 'ADMIN') return Object.fromEntries(Object.keys(defaultPermissions).map(module => [module,{view:true,create:true,edit:true,delete:true}])) as Record<PermissionModule,Record<PermissionAction,boolean>>; return Object.fromEntries(Object.keys(defaultPermissions).map(module => [module,{...defaultPermissions[module as PermissionModule]}])) as Record<PermissionModule,Record<PermissionAction,boolean>>; }
export async function hasPermission(user: CurrentUser, module: PermissionModule, action: PermissionAction) { if (user.role === 'ADMIN') return true; if (user.role === 'PARENT') return action === 'view' && (module === 'lots' || module === 'gallery'); const result = await query<{can_view:boolean;can_create:boolean;can_edit:boolean;can_delete:boolean}>('SELECT can_view,can_create,can_edit,can_delete FROM user_permissions WHERE user_id=$1 AND module=$2',[user.id,module]); const row=result.rows[0]; return row ? Boolean(row[`can_${action}` as keyof typeof row]) : getDefaultPermissions(user.role)[module][action]; }
export function requirePermission(module: PermissionModule, action: PermissionAction) { return async (req: Request, _res: Response, next: NextFunction) => { try { if (!req.user) throw new AppError(401,'UNAUTHENTICATED','Iniciá sesión para continuar'); if (!(await hasPermission(req.user,module,action))) throw new AppError(403,'FORBIDDEN_PERMISSION','No tenés permisos para esta acción'); next(); } catch (error) { next(error); } }; }
export { defaultPermissions };
export async function assertSchoolAccess(user: CurrentUser, schoolId: string, allowed: Role[] = ['COORDINATOR', 'PARENT']) {
  if (user.role === 'ADMIN') return;
  if (!allowed.includes(user.role)) throw new AppError(403, 'FORBIDDEN_SCHOOL', 'No tenés acceso a este colegio');
  const membership = await query('SELECT 1 FROM user_schools WHERE user_id = $1 AND school_id = $2 AND membership_role = $3 AND active', [user.id, schoolId, user.role]);
  if (!membership.rowCount) throw new AppError(403, 'FORBIDDEN_SCHOOL', 'No tenés acceso a este colegio');
}

export async function assertDepartureAccess(user: CurrentUser, departureId: string, allowed: Role[] = ['COORDINATOR', 'PARENT']) {
  if (user.role === 'ADMIN') return;
  if (!allowed.includes(user.role)) throw new AppError(403, 'FORBIDDEN_DEPARTURE', 'No tenés acceso a esta salida');
  const membership = user.role === 'COORDINATOR'
    ? await query('SELECT 1 FROM departure_coordinators WHERE departure_id=$1 AND user_id=$2', [departureId, user.id])
    : await query(`SELECT 1 FROM departure_schools ds JOIN user_schools us ON us.school_id=ds.school_id WHERE ds.departure_id=$1 AND us.user_id=$2 AND us.membership_role='PARENT' AND us.active`, [departureId, user.id]);
  if (!membership.rowCount) throw new AppError(403, 'FORBIDDEN_DEPARTURE', 'No tenés acceso a esta salida');
}
