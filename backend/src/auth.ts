import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { query } from './db.js';
import { AppError } from './errors.js';

export type Role='ADMIN'|'COORDINATOR'|'PARENT';
export type PermissionAction = 'view'|'create'|'edit'|'delete';
export type PermissionModule = 'departures'|'lots'|'moderation'|'gallery'|'activities'|'schools'|'passengers'|'users'|'imports';
export interface CurrentUser { id:string; name:string; email:string; roleId:string; roleName:string; isAdmin:boolean; role:Role; }
declare global { namespace Express { interface Request { user?: CurrentUser; } } }
const cookieName='galeria_session'; const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export async function hashPassword(password:string){return bcrypt.hash(password,12);} export async function verifyPassword(password:string,passwordHash:string){return bcrypt.compare(password,passwordHash);}
export async function createSession(user:CurrentUser){const tokenId=crypto.randomUUID();const token=jwt.sign({sub:user.id,sid:tokenId},config.SESSION_SECRET,{expiresIn:(config.SESSION_DAYS+'d') as jwt.SignOptions['expiresIn']});await query("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,now()+($4||' days')::interval)",[tokenId,user.id,hash(token),String(config.SESSION_DAYS)]);return token;}
export function writeSession(res:Response,token:string){res.cookie(cookieName,token,{httpOnly:true,sameSite:'lax',secure:false,maxAge:config.SESSION_DAYS*86400000,path:'/'});} export function clearSession(res:Response){res.clearCookie(cookieName,{httpOnly:true,sameSite:'lax',secure:false,path:'/'});}
export async function authenticate(req:Request,_res:Response,next:NextFunction){try{const token=req.cookies?.[cookieName]||req.header('authorization')?.replace(/^Bearer\s+/i,'');if(!token)throw new AppError(401,'UNAUTHENTICATED','Iniciá sesión para continuar');const payload=jwt.verify(token,config.SESSION_SECRET) as jwt.JwtPayload;if(!payload.sub||!payload.sid)throw new AppError(401,'INVALID_SESSION','Sesión inválida');const result=await query<CurrentUser>(`SELECT u.id,u.name,u.email,u.role_id AS "roleId",r.name AS "roleName",r.is_system_admin AS "isAdmin",CASE WHEN r.is_system_admin THEN 'ADMIN' ELSE 'COORDINATOR' END::text AS role FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id WHERE s.id=$1 AND s.token_hash=$2 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active AND r.active`,[payload.sid,hash(token)]);if(!result.rowCount)throw new AppError(401,'SESSION_EXPIRED','La sesión venció o fue revocada');req.user=result.rows[0];next();}catch(error){next(error instanceof AppError?error:new AppError(401,'INVALID_SESSION','Sesión inválida'));}}
export function requireAdmin(req:Request,_res:Response,next:NextFunction){if(!req.user) return next(new AppError(401,'UNAUTHENTICATED','Iniciá sesión para continuar'));if(!req.user.isAdmin)return next(new AppError(403,'FORBIDDEN_ROLE','No tenés permisos para esta acción'));next();}
export function requireRoles(...roles:Role[]){return (req:Request,_res:Response,next:NextFunction)=>{if(!req.user)return next(new AppError(401,'UNAUTHENTICATED','Inici? sesi?n para continuar'));if(!roles.includes(req.user.role))return next(new AppError(403,'FORBIDDEN_ROLE','No ten?s permisos para esta acci?n'));next();};}
export async function hasPermission(user:CurrentUser,module:PermissionModule,action:PermissionAction){if(user.isAdmin)return true;const result=await query<{allowed:boolean}>(`SELECT can_${action} AS allowed FROM role_permissions WHERE role_id=$1 AND module=$2`,[user.roleId,module]);return Boolean(result.rows[0]?.allowed);}
export function requirePermission(module:PermissionModule,action:PermissionAction){return async(req:Request,_res:Response,next:NextFunction)=>{try{if(!req.user)throw new AppError(401,'UNAUTHENTICATED','Iniciá sesión para continuar');if(!(await hasPermission(req.user,module,action)))throw new AppError(403,'FORBIDDEN_PERMISSION','No tenés permisos para esta acción');next();}catch(error){next(error);}};}
export async function assertSchoolAccess(user:CurrentUser,schoolId:string,_allowed?:Role[]){if(user.isAdmin)return;const result=await query('SELECT 1 FROM user_schools WHERE user_id=$1 AND school_id=$2 AND active',[user.id,schoolId]);if(!result.rowCount)throw new AppError(403,'FORBIDDEN_SCHOOL','No tenés acceso a este colegio');}
export async function assertDepartureAccess(user:CurrentUser,departureId:string,_allowed?:Role[]){if(user.isAdmin)return;const result=await query('SELECT 1 FROM departure_coordinators WHERE departure_id=$1 AND user_id=$2',[departureId,user.id]);if(!result.rowCount)throw new AppError(403,'FORBIDDEN_DEPARTURE','No tenés acceso a esta salida');}



export const defaultPermissions = {} as Record<PermissionModule,Record<PermissionAction,boolean>>; export function getDefaultPermissions(_role:Role){return defaultPermissions;}
