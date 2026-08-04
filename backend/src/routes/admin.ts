import { Router } from 'express';
import crypto from 'node:crypto';
import { parse } from 'csv-parse/sync';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { hashPassword, getDefaultPermissions } from '../auth.js';
import { query, transaction } from '../db.js';
import { AppError } from '../errors.js';
import { parsePassengerWorkbook, passengerSchema } from '../passengers.js';
import { asyncHandler, parsePagination } from '../http.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const permissionModules = ['departures','lots','moderation','gallery','activities','schools','passengers','users','imports'] as const;
const permissionActions = ['view','create','edit','delete'] as const;
const permissionItemSchema = z.object({ module: z.enum(permissionModules), view: z.boolean(), create: z.boolean(), edit: z.boolean(), delete: z.boolean() });
const userSchema = z.object({ name: z.string().min(2).max(160), email: z.string().email(), password: z.string().min(8).max(128), role: z.enum(['ADMIN', 'COORDINATOR']).default('COORDINATOR'), departureIds: z.array(z.string().uuid()).default([]), permissions: z.array(permissionItemSchema).optional(), active: z.boolean().optional() });
const schoolSchema = z.object({ name: z.string().min(2).max(160), code: z.string().min(2).max(32).transform(v => v.toUpperCase()), botCode: z.string().min(2).max(32).transform(v => v.toUpperCase()), startDate: z.string().date().optional().nullable(), endDate: z.string().date().optional().nullable(), active: z.boolean().optional() });
const catalogSchema = z.object({ name: z.string().min(2).max(100), botCode: z.string().min(1).max(32).transform(v => v.toUpperCase()), active: z.boolean().optional(), sortOrder: z.number().int().optional() });

export const adminRouter = Router();

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const term = String(req.query.q ?? '');
  const includeInactive = String(req.query.includeInactive ?? '') === 'true';
  const result = await query(`
    SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
           COALESCE((SELECT array_agg(us.school_id ORDER BY us.school_id) FROM user_schools us WHERE us.user_id=u.id AND us.active=true), ARRAY[]::uuid[]) AS school_ids,
           COALESCE((SELECT array_agg(dc.departure_id ORDER BY d.event_date DESC, d.name) FROM departure_coordinators dc JOIN departures d ON d.id=dc.departure_id WHERE dc.user_id=u.id), ARRAY[]::uuid[]) AS departure_ids,
           COALESCE((SELECT array_agg((d.type::text || ' - ' || d.name) ORDER BY d.event_date DESC, d.name) FROM departure_coordinators dc JOIN departures d ON d.id=dc.departure_id WHERE dc.user_id=u.id), ARRAY[]::text[]) AS departure_names,
           (SELECT count(*)::int FROM user_permissions up WHERE up.user_id=u.id) AS custom_permission_count,
           (u.role = 'ADMIN') AS has_global_access,
           CASE
             WHEN u.role = 'ADMIN' THEN 'GLOBAL'
             WHEN EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id) THEN 'CUSTOM'
             ELSE 'DEFAULT'
           END AS permission_mode
    FROM users u
    WHERE ($4::boolean OR u.active = true)
      AND (u.name ILIKE $1 OR u.email ILIKE $1)
    ORDER BY u.name
    LIMIT $2 OFFSET $3
  `, [`%${term}%`, pageSize, (page - 1) * pageSize, includeInactive]);
  res.json({ items: result.rows, page, pageSize });
}));
adminRouter.get('/permissions/catalog', asyncHandler(async (_req,res) => { const result=await query('SELECT module,label FROM permission_modules ORDER BY module'); res.json({items:result.rows,actions:permissionActions}); }));
adminRouter.get('/users/:id/permissions', asyncHandler(async (req,res) => {
  const target=await query<{role:'ADMIN'|'COORDINATOR'|'PARENT'}>('SELECT role FROM users WHERE id=$1',[req.params.id]); if(!target.rowCount) throw new AppError(404,'USER_NOT_FOUND','Usuario no encontrado');
  const rows=await query('SELECT module,can_view,can_create,can_edit,can_delete FROM user_permissions WHERE user_id=$1',[req.params.id]);
  const defaults = getDefaultPermissions(target.rows[0].role);
  const custom=Object.fromEntries(rows.rows.map(row=>[row.module,{view:row.can_view,create:row.can_create,edit:row.can_edit,delete:row.can_delete}]));
  const permissions = Object.fromEntries(permissionModules.map(module => [module, custom[module] ?? defaults[module]]));
  res.json({role:target.rows[0].role,customized:Boolean(rows.rowCount),permissions});
}));
adminRouter.put('/users/:id/permissions', asyncHandler(async (req,res) => {
  const input=z.object({permissions:z.array(z.object({module:z.enum(permissionModules),view:z.boolean(),create:z.boolean(),edit:z.boolean(),delete:z.boolean()}))}).parse(req.body);
  const target=await query<{role:'ADMIN'|'COORDINATOR'|'PARENT'}>('SELECT role FROM users WHERE id=$1',[req.params.id]); if(!target.rowCount) throw new AppError(404,'USER_NOT_FOUND','Usuario no encontrado');
  if(target.rows[0].role!=='COORDINATOR') throw new AppError(400,'PERMISSIONS_ROLE','Solo los coordinadores pueden tener permisos personalizados');
  const unique=new Set(input.permissions.map(item=>item.module)); if(unique.size!==input.permissions.length) throw new AppError(400,'DUPLICATE_PERMISSION_MODULE','No repitas módulos');
  await transaction(async client=>{ await client.query('DELETE FROM user_permissions WHERE user_id=$1',[req.params.id]); for(const item of input.permissions) await client.query('INSERT INTO user_permissions(user_id,module,can_view,can_create,can_edit,can_delete) VALUES($1,$2,$3,$4,$5,$6)',[req.params.id,item.module,item.view,item.create,item.edit,item.delete]); });
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,input.permissions.length?'USER_PERMISSIONS_UPDATED':'USER_PERMISSIONS_RESET','user',req.params.id,JSON.stringify({modules:input.permissions.map(item=>item.module)})]);
  res.json({customized:input.permissions.length>0});
}));
adminRouter.post('/users', asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  const departureIds = [...new Set(input.departureIds)];
  if (input.role !== 'COORDINATOR' && departureIds.length) throw new AppError(400, 'INVALID_DEPARTURE_ASSIGNMENTS', 'Las salidas solo se asignan a coordinadores');
  const result = await transaction(async client => {
    if (departureIds.length) {
      const valid = await client.query('SELECT id FROM departures WHERE id = ANY($1::uuid[]) AND active', [departureIds]);
      if (valid.rowCount !== departureIds.length) throw new AppError(400, 'INVALID_DEPARTURE', 'Una o mas salidas no existen o estan archivadas');
    }
    const created = await client.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active', [input.name, input.email, await hashPassword(input.password), input.role]);
    for (const departureId of departureIds) await client.query('INSERT INTO departure_coordinators (departure_id, user_id) VALUES ($1, $2)', [departureId, created.rows[0].id]);
    if (input.permissions?.length) {
      if (input.role !== 'COORDINATOR') throw new AppError(400, 'PERMISSIONS_ROLE', 'Solo los coordinadores pueden tener permisos personalizados');
      const unique = new Set(input.permissions.map(item => item.module));
      if (unique.size !== input.permissions.length) throw new AppError(400, 'DUPLICATE_PERMISSION_MODULE', 'No repitas módulos');
      for (const item of input.permissions) await client.query('INSERT INTO user_permissions(user_id,module,can_view,can_create,can_edit,can_delete) VALUES($1,$2,$3,$4,$5,$6)', [created.rows[0].id, item.module, item.view, item.create, item.edit, item.delete]);
    }
    return created.rows[0];
  });
  res.status(201).json(result);
}));
adminRouter.patch('/users/:id', asyncHandler(async (req, res) => {
  const input = userSchema.partial().parse(req.body);
  const departureIds = input.departureIds === undefined ? undefined : [...new Set(input.departureIds)];
  const targetId = String(req.params.id);
  if (input.active === false && targetId === req.user!.id) throw new AppError(400, 'CANNOT_DEACTIVATE_SELF', 'No podés desactivar tu propia cuenta');
  const result = await transaction(async client => {
    const current = await client.query<{ role: 'ADMIN' | 'COORDINATOR' | 'PARENT'; active: boolean }>('SELECT role, active FROM users WHERE id=$1 FOR UPDATE', [targetId]);
    if (!current.rowCount) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    const nextRole = input.role ?? current.rows[0].role;
    if (nextRole !== 'COORDINATOR' && departureIds?.length) throw new AppError(400, 'INVALID_DEPARTURE_ASSIGNMENTS', 'Las salidas solo se asignan a coordinadores');
    if (departureIds && input.active !== false) {
      const valid = await client.query('SELECT id FROM departures WHERE id = ANY($1::uuid[]) AND active', [departureIds]);
      if (valid.rowCount !== departureIds.length) throw new AppError(400, 'INVALID_DEPARTURE', 'Una o mas salidas no existen o estan archivadas');
    }
    if (input.active === false && current.rows[0].role === 'ADMIN' && current.rows[0].active) {
      const admins = await client.query("SELECT count(*)::int AS total FROM users WHERE role='ADMIN' AND active");
      if (admins.rows[0].total <= 1) throw new AppError(400, 'LAST_ADMIN', 'No se puede desactivar el ?ltimo administrador activo');
    }
    const values = [input.name ?? null, input.email ?? null, input.role ?? null, input.password ? await hashPassword(input.password) : null, input.active ?? null, targetId];
    const updated = await client.query('UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), password_hash = COALESCE($4, password_hash), active = COALESCE($5, active) WHERE id = $6 RETURNING id, name, email, role, active', values);
    if (departureIds) {
      await client.query('DELETE FROM departure_coordinators WHERE user_id=$1', [targetId]);
      for (const departureId of departureIds) await client.query('INSERT INTO departure_coordinators (departure_id, user_id) VALUES ($1, $2)', [departureId, targetId]);
    } else if (nextRole !== 'COORDINATOR' || input.active === false) {
      await client.query('DELETE FROM departure_coordinators WHERE user_id=$1', [targetId]);
    }

    if (input.permissions !== undefined) {
      if (nextRole !== 'COORDINATOR') throw new AppError(400, 'PERMISSIONS_ROLE', 'Solo los coordinadores pueden tener permisos personalizados');
      const unique = new Set(input.permissions.map(item => item.module));
      if (unique.size !== input.permissions.length) throw new AppError(400, 'DUPLICATE_PERMISSION_MODULE', 'No repitas módulos');
      await client.query('DELETE FROM user_permissions WHERE user_id=$1', [targetId]);
      for (const item of input.permissions) await client.query('INSERT INTO user_permissions(user_id,module,can_view,can_create,can_edit,can_delete) VALUES($1,$2,$3,$4,$5,$6)', [targetId, item.module, item.view, item.create, item.edit, item.delete]);
    }
    if (input.active === false) {
      await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [targetId]);
    }
    return updated.rows[0];
  });
  if (input.active !== undefined) {
    await query('INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)', [req.user!.id, input.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', 'user', targetId, JSON.stringify({ active: input.active })]);
  }
  res.json(result);
}));adminRouter.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const input = z.object({ password: z.string().min(8).max(128) }).parse(req.body);
  const result = await query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [await hashPassword(input.password), String(req.params.id)]);
  if (!result.rowCount) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  res.status(204).end();
}));
adminRouter.put('/users/:id/schools', asyncHandler(async (req, res) => {
  const input = z.object({ schoolIds: z.array(z.string().uuid()), role: z.enum(['COORDINATOR', 'PARENT']) }).parse(req.body);
  await transaction(async client => {
    await client.query("UPDATE user_schools SET active=false WHERE user_id=$1 AND membership_role=$2", [req.params.id, input.role]);
    for (const schoolId of input.schoolIds) {
      await client.query('INSERT INTO user_schools (user_id, school_id, membership_role, active) VALUES ($1,$2,$3,true) ON CONFLICT (user_id,school_id,membership_role) DO UPDATE SET active=true', [req.params.id, schoolId, input.role]);
    }
  });
  res.status(204).end();
}));
adminRouter.delete('/users/:id', asyncHandler(async (req, res) => {
  const userId = String(req.params.id);
  if (userId === req.user!.id) throw new AppError(400, 'CANNOT_DELETE_SELF', 'No podés eliminar tu propia cuenta');
  await transaction(async client => {
    const target = await client.query<{ role: 'ADMIN' | 'COORDINATOR' | 'PARENT'; active: boolean }>('SELECT role, active FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!target.rowCount) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    if (target.rows[0].role === 'ADMIN' && target.rows[0].active) {
      const admins = await client.query("SELECT count(*)::int AS total FROM users WHERE role='ADMIN' AND active");
      if (admins.rows[0].total <= 1) throw new AppError(400, 'LAST_ADMIN', 'No se puede eliminar el ?ltimo administrador activo');
    }
    await client.query('INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)', [req.user!.id, 'USER_DELETED', 'user', userId, JSON.stringify({ permanent: true })]);
    await client.query('DELETE FROM users WHERE id=$1', [userId]);
  });
  res.status(204).end();
}));

adminRouter.get('/schools', asyncHandler(async (req, res) => {
  const includeInactive = String(req.query.includeInactive ?? '') === 'true';
  const result = await query(`
    SELECT s.*, p.active AS public_link_active, p.generated_at AS public_link_generated_at, p.revoked_at AS public_link_revoked_at, p.token_value AS public_link_token,
           COALESCE(array_agg(u.id) FILTER (WHERE u.id IS NOT NULL), ARRAY[]::uuid[]) as coordinator_ids,
           COALESCE(array_agg(u.name) FILTER (WHERE u.id IS NOT NULL), ARRAY[]::text[]) as coordinators
    FROM schools s
    LEFT JOIN public_school_links p ON p.school_id = s.id
    LEFT JOIN user_schools us ON s.id = us.school_id AND us.membership_role = 'COORDINATOR' AND us.active = true
    LEFT JOIN users u ON us.user_id = u.id AND u.active = true
    WHERE s.deleted_at IS NULL AND ($1::boolean OR s.active = true)
    GROUP BY s.id, p.active, p.generated_at, p.revoked_at, p.token_value
    ORDER BY s.name
  `, [includeInactive]);
  res.json({ items: result.rows });
}));
const publicLinkActiveSchema = z.object({ active: z.boolean() });
const publicToken = () => crypto.randomBytes(32).toString('base64url');
const publicTokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
async function schoolExists(id: string) {
  const school = await query('SELECT id FROM schools WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!school.rowCount) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'Colegio no encontrado');
}
adminRouter.get('/schools/:id/public-link', asyncHandler(async (req, res) => {
  const schoolId = z.string().uuid().parse(req.params.id);
  await schoolExists(schoolId);
  const result = await query('SELECT active, generated_at, revoked_at, token_value FROM public_school_links WHERE school_id=$1', [schoolId]);
  res.json({ exists: Boolean(result.rowCount), ...(result.rows[0] ?? {}) });
}));
adminRouter.post('/schools/:id/public-link', asyncHandler(async (req, res) => {
  const schoolId = z.string().uuid().parse(req.params.id);
  await schoolExists(schoolId);
  const token = publicToken();
  const result = await query(`
    INSERT INTO public_school_links (school_id, token_hash, token_value, active, generated_at, generated_by, revoked_at, revoked_by)
    VALUES ($1,$2,$3,true,now(),$4,NULL,NULL)
    ON CONFLICT (school_id) DO UPDATE SET token_hash=EXCLUDED.token_hash, token_value=EXCLUDED.token_value, active=true, generated_at=now(), generated_by=EXCLUDED.generated_by, revoked_at=NULL, revoked_by=NULL
    RETURNING active, generated_at
  `, [schoolId, publicTokenHash(token), token, req.user!.id]);
  await query('INSERT INTO audit_log (actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,$4,$5)', [req.user!.id, 'PUBLIC_LINK_GENERATED', 'school', schoolId, JSON.stringify({ regenerated: true })]);
  res.status(201).json({ token, active: result.rows[0].active, generated_at: result.rows[0].generated_at });
}));
adminRouter.patch('/schools/:id/public-link', asyncHandler(async (req, res) => {
  const input = publicLinkActiveSchema.parse(req.body);
  const schoolId = z.string().uuid().parse(req.params.id);
  await schoolExists(schoolId);
  const result = await query(`UPDATE public_school_links SET active=$1, revoked_at=CASE WHEN $1 THEN NULL ELSE now() END, revoked_by=CASE WHEN $1 THEN NULL ELSE $2 END WHERE school_id=$3 RETURNING active, generated_at, revoked_at`, [input.active, req.user!.id, schoolId]);
  if (!result.rowCount) throw new AppError(404, 'PUBLIC_LINK_NOT_FOUND', 'Primero genera el enlace publico');
  await query('INSERT INTO audit_log (actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,$4,$5)', [req.user!.id, input.active ? 'PUBLIC_LINK_REACTIVATED' : 'PUBLIC_LINK_REVOKED', 'school', schoolId, JSON.stringify({ active: input.active })]);
  res.json(result.rows[0]);
}));
adminRouter.post('/schools', asyncHandler(async (req, res) => {
  const input = schoolSchema.parse(req.body);
  const result = await query('INSERT INTO schools (name, code, bot_code, start_date, end_date, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [input.name, input.code, input.botCode, input.startDate ?? null, input.endDate ?? null, input.active ?? true]);
  res.status(201).json(result.rows[0]);
}));
adminRouter.patch('/schools/:id', asyncHandler(async (req, res) => {
  const input = schoolSchema.partial().parse(req.body);
  const result = await query('UPDATE schools SET name=COALESCE($1,name), code=COALESCE($2,code), bot_code=COALESCE($3,bot_code), start_date=COALESCE($4,start_date), end_date=COALESCE($5,end_date), active=COALESCE($6,active) WHERE id=$7 AND deleted_at IS NULL RETURNING *', [input.name ?? null,input.code ?? null,input.botCode ?? null,input.startDate ?? null,input.endDate ?? null,input.active ?? null,String(req.params.id)]);
  if (!result.rowCount) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'Colegio no encontrado'); if (input.active !== undefined) { await query('INSERT INTO audit_log (actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,$4,$5)', [req.user!.id, input.active ? 'SCHOOL_REACTIVATED' : 'SCHOOL_DEACTIVATED', 'school', String(req.params.id), JSON.stringify({ active: input.active })]); } res.json(result.rows[0]);
}));
adminRouter.delete('/schools/:id', asyncHandler(async (req, res) => { await query('UPDATE schools SET deleted_at = now(), active = false WHERE id = $1', [String(req.params.id)]); res.status(204).end(); }));

adminRouter.put('/schools/:id/coordinators', asyncHandler(async (req, res) => {
  const input = z.object({ coordinatorIds: z.array(z.string().uuid()) }).parse(req.body);
  await transaction(async client => {
    await client.query("UPDATE user_schools SET active=false WHERE school_id=$1 AND membership_role='COORDINATOR'", [String(req.params.id)]);
    for (const userId of input.coordinatorIds) {
      await client.query("INSERT INTO user_schools (user_id, school_id, membership_role, active) VALUES ($1,$2,'COORDINATOR',true) ON CONFLICT (user_id,school_id,membership_role) DO UPDATE SET active=true", [userId, String(req.params.id)]);
    }
  });
  res.status(204).end();
}));

for (const [route, table, hasSort] of [['activities', 'activities', false], ['shifts', 'shifts', true]] as const) {
  adminRouter.get(`/${route}`, asyncHandler(async (req, res) => { const includeInactive = String(req.query.includeInactive ?? '') === 'true'; const result = await query(`SELECT * FROM ${table} WHERE ($1::boolean OR active = true) ORDER BY ${hasSort ? 'sort_order, ' : ''}name`, [includeInactive]); res.json({ items: result.rows }); }));
  adminRouter.post(`/${route}`, asyncHandler(async (req, res) => { const input = catalogSchema.parse(req.body); const result = await query(`INSERT INTO ${table} (name, bot_code, active${hasSort ? ', sort_order' : ''}) VALUES ($1,$2,$3${hasSort ? ',$4' : ''}) RETURNING *`, hasSort ? [input.name,input.botCode,input.active ?? true,input.sortOrder ?? 0] : [input.name,input.botCode,input.active ?? true]); res.status(201).json(result.rows[0]); }));
  adminRouter.patch(`/${route}/:id`, asyncHandler(async (req, res) => { const input = catalogSchema.partial().parse(req.body); const result = await query(`UPDATE ${table} SET name=COALESCE($1,name), bot_code=COALESCE($2,bot_code), active=COALESCE($3,active)${hasSort ? ', sort_order=COALESCE($4,sort_order)' : ''} WHERE id=$${hasSort ? 5 : 4} RETURNING *`, hasSort ? [input.name ?? null,input.botCode ?? null,input.active ?? null,input.sortOrder ?? null,req.params.id] : [input.name ?? null,input.botCode ?? null,input.active ?? null,String(req.params.id)]); if (!result.rowCount) throw new AppError(404, 'CATALOG_NOT_FOUND', 'Registro no encontrado'); if (input.active !== undefined) await query('INSERT INTO audit_log (actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,$4,$5)', [req.user!.id, route === 'activities' ? (input.active ? 'ACTIVITY_REACTIVATED' : 'ACTIVITY_DEACTIVATED') : (input.active ? 'SHIFT_REACTIVATED' : 'SHIFT_DEACTIVATED'), route === 'activities' ? 'activity' : 'shift', String(req.params.id), JSON.stringify({ active: input.active })]); res.json(result.rows[0]); }));
  adminRouter.delete(`/${route}/:id`, asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (route !== 'activities') {
      await query(`UPDATE ${table} SET active=false WHERE id=$1`, [id]);
      res.status(204).end();
      return;
    }
    await transaction(async client => {
      const existing = await client.query(`SELECT id FROM activities WHERE id=$1 FOR UPDATE`, [id]);
      if (!existing.rowCount) throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Actividad no encontrada');
      await client.query('UPDATE lots SET activity_id=NULL, updated_at=now() WHERE activity_id=$1', [id]);
      await client.query('DELETE FROM school_activities WHERE activity_id=$1', [id]);
      await client.query('DELETE FROM activities WHERE id=$1', [id]);
      await client.query('INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)', [req.user!.id, 'ACTIVITY_DELETED', 'activity', id, JSON.stringify({ permanent: true })]);
    });
    res.status(204).end();
  }));
}

adminRouter.put('/schools/:schoolId/members/:userId', asyncHandler(async (req, res) => {
  const input = z.object({ membershipRole: z.enum(['COORDINATOR', 'PARENT']) }).parse(req.body);
  await transaction(async client => {
    if (input.membershipRole === 'PARENT') await client.query("UPDATE user_schools SET active=false WHERE user_id=$1 AND membership_role='PARENT'", [req.params.userId]);
    await client.query('INSERT INTO user_schools (user_id, school_id, membership_role) VALUES ($1,$2,$3) ON CONFLICT (user_id,school_id,membership_role) DO UPDATE SET active=true', [req.params.userId, req.params.schoolId, input.membershipRole]);
  });
  res.status(204).end();
}));
adminRouter.delete('/schools/:schoolId/members/:userId', asyncHandler(async (req, res) => { await query('UPDATE user_schools SET active=false WHERE user_id=$1 AND school_id=$2', [req.params.userId, req.params.schoolId]); res.status(204).end(); }));

adminRouter.put('/schools/:schoolId/catalogs/:kind/:catalogId', asyncHandler(async (req, res) => {
  const kind = req.params.kind === 'activities' ? 'activities' : req.params.kind === 'shifts' ? 'shifts' : null;
  if (!kind) throw new AppError(400, 'INVALID_CATALOG', 'Catalogo invalido');
  const table = kind === 'activities' ? 'school_activities' : 'school_shifts'; const column = kind === 'activities' ? 'activity_id' : 'shift_id';
  await query(`INSERT INTO ${table} (school_id, ${column}, enabled) VALUES ($1,$2,true) ON CONFLICT (school_id,${column}) DO UPDATE SET enabled=true`, [req.params.schoolId,req.params.catalogId]);
  res.status(204).end();
}));

adminRouter.post('/imports/:kind/preview', upload.single('file'), asyncHandler(async (req, res) => {
  const kind = z.enum(['schools', 'users', 'memberships']).parse(req.params.kind);
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Selecciona un CSV');
  const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const required: Record<typeof kind, string[]> = { schools: ['name','code','bot_code'], users: ['name','email','password','role'], memberships: ['email','school_code','membership_role'] };
  const errors = rows.flatMap((row, index) => required[kind].filter(key => !row[key]).map(key => ({ row: index + 2, field: key, message: 'Obligatorio' })));
  res.json({ kind, rows, valid: errors.length === 0, errors });
}));
adminRouter.post('/imports/:kind/commit', upload.single('file'), asyncHandler(async (req, res) => {
  const kind = z.enum(['schools', 'users', 'memberships']).parse(req.params.kind);
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Selecciona un CSV');
  const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  await transaction(async client => {
    for (const row of rows) {
      if (kind === 'schools') { schoolSchema.parse({ name: row.name, code: row.code, botCode: row.bot_code }); await client.query('INSERT INTO schools (name,code,bot_code) VALUES ($1,$2,$3)', [row.name,row.code.toUpperCase(),row.bot_code.toUpperCase()]); }
      if (kind === 'users') { const item = userSchema.parse({ name: row.name, email: row.email, password: row.password, role: row.role }); await client.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', [item.name,item.email,await hashPassword(item.password),item.role]); }
      if (kind === 'memberships') { const role = z.enum(['COORDINATOR','PARENT']).parse(row.membership_role); const result = await client.query('SELECT u.id user_id, s.id school_id FROM users u, schools s WHERE lower(u.email)=lower($1) AND s.code=$2', [row.email,row.school_code.toUpperCase()]); if (!result.rowCount) throw new AppError(400,'INVALID_MEMBERSHIP','Usuario o colegio inexistente'); await client.query('INSERT INTO user_schools (user_id,school_id,membership_role) VALUES ($1,$2,$3)', [result.rows[0].user_id,result.rows[0].school_id,role]); }
    }
  });
  res.status(201).json({ imported: rows.length });
}));

const passengerFields = `p.id,p.external_number,p.full_name,p.document_type,p.document_number,p.birth_date::text,p.document_expires_at::text,p.country,p.passenger_status,p.bonus,p.phone,p.mobile,p.email,p.active,p.created_at,p.updated_at,p.deactivated_at`;
async function passengerSchoolExists(schoolId: string) {
  await schoolExists(schoolId);
  return schoolId;
}
async function upsertSchoolPassenger(client: any, schoolId: string, row: ReturnType<typeof passengerSchema.parse>, actorId: string) {
  const found = await client.query('SELECT id FROM passengers WHERE document_type=$1 AND document_number=$2 FOR UPDATE', [row.documentType, row.documentNumber]);
  let passengerId: string;
  if (found.rowCount) {
    passengerId = found.rows[0].id;
    await client.query(`UPDATE passengers SET external_number=$1,full_name=$2,document_type=$3,document_number=$4,birth_date=$5,document_expires_at=$6,country=$7,passenger_status=$8,bonus=$9,phone=$10,mobile=$11,email=$12,active=COALESCE($13,active),deactivated_at=CASE WHEN COALESCE($13,active) THEN NULL ELSE deactivated_at END WHERE id=$14`, [row.externalNumber,row.fullName,row.documentType,row.documentNumber,row.birthDate,row.documentExpiresAt,row.country,row.passengerStatus,row.bonus,row.phone,row.mobile,row.email,row.active ?? true,passengerId]);
  } else {
    const created = await client.query(`INSERT INTO passengers(external_number,full_name,document_type,document_number,birth_date,document_expires_at,country,passenger_status,bonus,phone,mobile,email,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [row.externalNumber,row.fullName,row.documentType,row.documentNumber,row.birthDate,row.documentExpiresAt,row.country,row.passengerStatus,row.bonus,row.phone,row.mobile,row.email,row.active ?? true]);
    passengerId = created.rows[0].id;
  }
  await client.query(`UPDATE passenger_school_assignments SET unassigned_at=NULL,assigned_by=$3 WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NOT NULL`, [passengerId, schoolId, actorId]);
  await client.query(`INSERT INTO passenger_school_assignments(passenger_id,school_id,assigned_by) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM passenger_school_assignments WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NULL)`, [passengerId, schoolId, actorId]);
  return passengerId;
}
adminRouter.get('/schools/:schoolId/passengers', asyncHandler(async (req, res) => {
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId));
  const { page, pageSize } = parsePagination(req.query); const term = String(req.query.q ?? '').trim();
  const result = await query(`SELECT ${passengerFields} FROM passengers p JOIN passenger_school_assignments a ON a.passenger_id=p.id AND a.school_id=$1 AND a.unassigned_at IS NULL WHERE (p.full_name ILIKE $2 OR p.document_number ILIKE $2 OR COALESCE(p.external_number,'') ILIKE $2) ORDER BY p.active DESC,p.full_name LIMIT $3 OFFSET $4`, [schoolId, `%${term}%`, pageSize, (page - 1) * pageSize]);
  res.set('Cache-Control','private, no-store').json({ items: result.rows, page, pageSize });
}));
adminRouter.post('/schools/:schoolId/passengers', asyncHandler(async (req, res) => {
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId)); const input = passengerSchema.parse(req.body);
  const passenger = await transaction(async client => { const id = await upsertSchoolPassenger(client, schoolId, input, req.user!.id); await client.query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGER_SCHOOL_ASSIGNED','passenger',$2,$3)`, [req.user!.id,id,JSON.stringify({schoolId})]); return client.query(`SELECT ${passengerFields} FROM passengers p WHERE p.id=$1`, [id]); });
  res.status(201).set('Cache-Control','private, no-store').json(passenger.rows[0]);
}));
adminRouter.patch('/schools/:schoolId/passengers/:passengerId', asyncHandler(async (req, res) => {
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId)); const passengerId = z.string().uuid().parse(req.params.passengerId); const input = passengerSchema.partial().parse(req.body);
  const result = await transaction(async client => { const membership = await client.query('SELECT 1 FROM passenger_school_assignments WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NULL', [passengerId,schoolId]); if (!membership.rowCount) throw new AppError(404,'PASSENGER_SCHOOL_NOT_FOUND','Pasajero no asociado a este colegio'); const updated = await client.query(`UPDATE passengers SET external_number=COALESCE($1,external_number),full_name=COALESCE($2,full_name),document_type=COALESCE($3,document_type),document_number=COALESCE($4,document_number),birth_date=COALESCE($5,birth_date),document_expires_at=COALESCE($6,document_expires_at),country=COALESCE($7,country),passenger_status=COALESCE($8,passenger_status),bonus=COALESCE($9,bonus),phone=COALESCE($10,phone),mobile=COALESCE($11,mobile),email=COALESCE($12,email),active=COALESCE($13,active),deactivated_at=CASE WHEN COALESCE($13,active) THEN NULL ELSE deactivated_at END WHERE id=$14 RETURNING id,external_number,full_name,document_type,document_number,birth_date::text,document_expires_at::text,country,passenger_status,bonus,phone,mobile,email,active,created_at,updated_at,deactivated_at`, [input.externalNumber??null,input.fullName??null,input.documentType?.toUpperCase()??null,input.documentNumber??null,input.birthDate??null,input.documentExpiresAt??null,input.country??null,input.passengerStatus??null,input.bonus??null,input.phone??null,input.mobile??null,input.email?.toLowerCase()??null,input.active??null,passengerId]); if (!updated.rowCount) throw new AppError(404,'PASSENGER_NOT_FOUND','Pasajero no encontrado'); return updated; });
  const action = input.active === undefined ? 'PASSENGER_UPDATED' : (input.active ? 'PASSENGER_REACTIVATED' : 'PASSENGER_DEACTIVATED'); await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'passenger',$3,$4)`, [req.user!.id,action,passengerId,JSON.stringify({schoolId})]); res.set('Cache-Control','private, no-store').json(result.rows[0]);
}));
adminRouter.delete('/schools/:schoolId/passengers/:passengerId', asyncHandler(async (req, res) => {
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId)); const passengerId = z.string().uuid().parse(req.params.passengerId); const result = await query(`UPDATE passenger_school_assignments SET unassigned_at=now(),assigned_by=$3 WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NULL RETURNING id`, [passengerId,schoolId,req.user!.id]); if (!result.rowCount) throw new AppError(404,'PASSENGER_SCHOOL_NOT_FOUND','Pasajero no asociado a este colegio'); await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGER_SCHOOL_UNASSIGNED','passenger',$2,$3)`, [req.user!.id,passengerId,JSON.stringify({schoolId})]); res.set('Cache-Control','private, no-store').status(204).end();
}));
adminRouter.post('/schools/:schoolId/passengers/import/preview', upload.single('file'), asyncHandler(async (req, res) => {
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId)); const file = excelFile(req); const parsed = parsePassengerWorkbook(file.buffer); const keys = parsed.rows.map(row => `${row.documentType}\u001F${row.documentNumber}`); const existing = keys.length ? await query<{document_type:string;document_number:string}>(`SELECT document_type,document_number FROM passengers WHERE document_type || chr(31) || document_number = ANY($1::text[])`, [keys]) : { rows: [] }; const existingKeys = new Set(existing.rows.map(row => `${row.document_type}\u001F${row.document_number}`)); const updates = parsed.rows.filter(row => existingKeys.has(`${row.documentType}\u001F${row.documentNumber}`)).length; res.set('Cache-Control','private, no-store').json({ schoolId, valid: parsed.errors.length===0, totalRows: parsed.totalRows, validRows: parsed.rows.length, errors: parsed.errors, summary: { create: parsed.rows.length-updates, update: updates, associate: parsed.rows.length, rejected: parsed.errors.length }, sample: parsed.rows.slice(0,25) });
}));
adminRouter.post('/schools/:schoolId/passengers/import/commit', upload.single('file'), asyncHandler(async (req, res) => {
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId)); const file = excelFile(req); const parsed = parsePassengerWorkbook(file.buffer); if (parsed.errors.length) throw new AppError(400,'INVALID_PASSENGER_IMPORT','El archivo tiene errores. Validalo antes de confirmar.'); const summary = await transaction(async client => { const importResult = await client.query<{id:string}>(`INSERT INTO passenger_imports(file_name,total_rows,imported_by,school_id) VALUES($1,$2,$3,$4) RETURNING id`, [file.originalname,parsed.totalRows,req.user!.id,schoolId]); let created=0,updated=0; for (const row of parsed.rows) { const found=await client.query('SELECT id FROM passengers WHERE document_type=$1 AND document_number=$2 FOR UPDATE',[row.documentType,row.documentNumber]); await upsertSchoolPassenger(client,schoolId,row,req.user!.id); if(found.rowCount) updated++; else created++; } await client.query(`UPDATE passenger_imports SET created_rows=$1,updated_rows=$2,rejected_rows=0 WHERE id=$3`,[created,updated,importResult.rows[0].id]); return {importId:importResult.rows[0].id,created,updated,associated:parsed.rows.length,rejected:0,total:parsed.rows.length}; }); await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGERS_IMPORTED','passenger_import',$2,$3)`,[req.user!.id,summary.importId,JSON.stringify({schoolId,created:summary.created,updated:summary.updated,associated:summary.associated,total:summary.total})]); res.status(201).json(summary);
}));
adminRouter.get('/passengers', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const term = String(req.query.q ?? '').trim();
  const schoolId = req.query.schoolId ? z.string().uuid().parse(req.query.schoolId) : null;
  const departureId = req.query.departureId ? z.string().uuid().parse(req.query.departureId) : null;
  const active = req.query.active === undefined || req.query.active === '' ? null : z.enum(['true','false']).transform(value=>value==='true').parse(req.query.active);
  const updatedFrom = req.query.updatedFrom ? z.string().date().parse(req.query.updatedFrom) : null;
  const updatedTo = req.query.updatedTo ? z.string().date().parse(req.query.updatedTo) : null;
  const values: unknown[] = [`%${term}%`, schoolId, departureId, active, updatedFrom, updatedTo, pageSize, (page - 1) * pageSize];
  const result = await query(`
    SELECT p.id,p.external_number,p.full_name,p.document_type,p.document_number,p.birth_date::text,p.document_expires_at::text,p.country,p.passenger_status,p.bonus,p.phone,p.mobile,p.email,p.active,p.created_at,p.updated_at,p.deactivated_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'code',s.code) ORDER BY s.name) FROM passenger_school_assignments psa JOIN schools s ON s.id=psa.school_id WHERE psa.passenger_id=p.id AND psa.unassigned_at IS NULL), '[]'::jsonb) AS schools,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'code',d.public_code,'type',d.type) ORDER BY d.start_date DESC,d.name) FROM passenger_departure_assignments pda JOIN departures d ON d.id=pda.departure_id WHERE pda.passenger_id=p.id AND pda.unassigned_at IS NULL), '[]'::jsonb) AS departures
    FROM passengers p
    WHERE (p.full_name ILIKE $1 OR p.document_number ILIKE $1 OR COALESCE(p.external_number,'') ILIKE $1 OR COALESCE(p.email,'') ILIKE $1 OR COALESCE(p.mobile,'') ILIKE $1 OR COALESCE(p.phone,'') ILIKE $1 OR EXISTS(SELECT 1 FROM passenger_school_assignments psa JOIN schools s ON s.id=psa.school_id WHERE psa.passenger_id=p.id AND psa.unassigned_at IS NULL AND (s.name ILIKE $1 OR s.code ILIKE $1)) OR EXISTS(SELECT 1 FROM passenger_departure_assignments pda JOIN departures d ON d.id=pda.departure_id WHERE pda.passenger_id=p.id AND pda.unassigned_at IS NULL AND (d.name ILIKE $1 OR COALESCE(d.public_code,'') ILIKE $1)))
      AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM passenger_school_assignments WHERE passenger_id=p.id AND school_id=$2 AND unassigned_at IS NULL))
      AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM passenger_departure_assignments WHERE passenger_id=p.id AND departure_id=$3 AND unassigned_at IS NULL))
      AND ($4::boolean IS NULL OR p.active=$4)
      AND ($5::date IS NULL OR p.updated_at >= $5::date)
      AND ($6::date IS NULL OR p.updated_at < ($6::date + interval '1 day'))
    ORDER BY p.active DESC,p.full_name LIMIT $7 OFFSET $8`, values);
  const [schools,departures] = await Promise.all([
    query(`SELECT id,name,code FROM schools WHERE active AND deleted_at IS NULL ORDER BY name`),
    query(`SELECT id,name,public_code AS code,type FROM departures WHERE active ORDER BY start_date DESC,name`)
  ]);
  res.set('Cache-Control', 'private, no-store').json({ items: result.rows, page, pageSize, filters: { schools: schools.rows, departures: departures.rows } });
}));adminRouter.get('/passengers/imports', asyncHandler(async (_req, res) => {
  const result = await query(`SELECT i.id,i.file_name,i.total_rows,i.created_rows,i.updated_rows,i.rejected_rows,i.school_id,i.created_at,u.name AS imported_by_name,s.code AS school_code,s.name AS school_name FROM passenger_imports i JOIN users u ON u.id=i.imported_by LEFT JOIN schools s ON s.id=i.school_id ORDER BY i.created_at DESC LIMIT 30`);
  res.set('Cache-Control', 'private, no-store').json({ items: result.rows });
}));
adminRouter.post('/passengers/:passengerId/schools/:schoolId', asyncHandler(async (req, res) => {
  const passengerId = z.string().uuid().parse(req.params.passengerId);
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId));
  await transaction(async client => {
    const passenger = await client.query('SELECT id FROM passengers WHERE id=$1 FOR UPDATE', [passengerId]);
    if (!passenger.rowCount) throw new AppError(404, 'PASSENGER_NOT_FOUND', 'Pasajero no encontrado');
    await client.query('UPDATE passenger_school_assignments SET unassigned_at=NULL,assigned_by=$3 WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NOT NULL', [passengerId, schoolId, req.user!.id]);
    await client.query('INSERT INTO passenger_school_assignments(passenger_id,school_id,assigned_by) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM passenger_school_assignments WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NULL)', [passengerId, schoolId, req.user!.id]);
  });
  await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGER_SCHOOL_ASSIGNED','passenger',$2,$3)`, [req.user!.id, passengerId, JSON.stringify({ schoolId, source: 'global_passenger' })]);
  res.set('Cache-Control','private, no-store').status(204).end();
}));
adminRouter.delete('/passengers/:passengerId/schools/:schoolId', asyncHandler(async (req, res) => {
  const passengerId = z.string().uuid().parse(req.params.passengerId);
  const schoolId = await passengerSchoolExists(z.string().uuid().parse(req.params.schoolId));
  const result = await query('UPDATE passenger_school_assignments SET unassigned_at=now(),assigned_by=$3 WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NULL RETURNING id', [passengerId, schoolId, req.user!.id]);
  if (!result.rowCount) throw new AppError(404, 'PASSENGER_SCHOOL_NOT_FOUND', 'Pasajero no asociado a este colegio');
  await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGER_SCHOOL_UNASSIGNED','passenger',$2,$3)`, [req.user!.id, passengerId, JSON.stringify({ schoolId, source: 'global_passenger' })]);
  res.set('Cache-Control','private, no-store').status(204).end();
}));adminRouter.patch('/passengers/:id', asyncHandler(async (req, res) => {
  const input = passengerSchema.partial().parse(req.body);
  const result = await query(`
    UPDATE passengers SET external_number=COALESCE($1,external_number),full_name=COALESCE($2,full_name),document_type=COALESCE($3,document_type),document_number=COALESCE($4,document_number),birth_date=COALESCE($5,birth_date),document_expires_at=COALESCE($6,document_expires_at),country=COALESCE($7,country),passenger_status=COALESCE($8,passenger_status),bonus=COALESCE($9,bonus),phone=COALESCE($10,phone),mobile=COALESCE($11,mobile),email=COALESCE($12,email),active=COALESCE($13,active),deactivated_at=CASE WHEN COALESCE($13,active) THEN NULL ELSE now() END,deactivated_by=CASE WHEN COALESCE($13,active) THEN NULL ELSE $14 END
    WHERE id=$15
    RETURNING id,external_number,full_name,document_type,document_number,birth_date::text,document_expires_at::text,country,passenger_status,bonus,phone,mobile,email,active,updated_at,deactivated_at
  `, [input.externalNumber ?? null,input.fullName ?? null,input.documentType?.toUpperCase() ?? null,input.documentNumber ?? null,input.birthDate ?? null,input.documentExpiresAt ?? null,input.country ?? null,input.passengerStatus ?? null,input.bonus ?? null,input.phone ?? null,input.mobile ?? null,input.email?.toLowerCase() ?? null,input.active ?? null,req.user!.id,String(req.params.id)]);
  if (!result.rowCount) throw new AppError(404, 'PASSENGER_NOT_FOUND', 'Pasajero no encontrado');
  const action = input.active === undefined ? 'PASSENGER_UPDATED' : (input.active ? 'PASSENGER_REACTIVATED' : 'PASSENGER_DEACTIVATED'); await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'passenger',$3,'{}')`, [req.user!.id,action,String(req.params.id)]);
  res.set('Cache-Control', 'private, no-store').json(result.rows[0]);
}));
adminRouter.delete('/passengers/:id', asyncHandler(async (req, res) => {
  const passengerId = z.string().uuid().parse(req.params.id);
  await transaction(async client => {
    const found = await client.query('SELECT id FROM passengers WHERE id=$1 FOR UPDATE', [passengerId]);
    if (!found.rowCount) throw new AppError(404, 'PASSENGER_NOT_FOUND', 'Pasajero no encontrado');
    // Eliminacion permanente del padron global. Las asociaciones dependientes
    // se eliminan para evitar referencias huerfanas; el historial de importaciones queda intacto.
    await client.query('DELETE FROM passenger_school_assignments WHERE passenger_id=$1', [passengerId]);
    await client.query('DELETE FROM passenger_departure_assignments WHERE passenger_id=$1', [passengerId]);
    await client.query('DELETE FROM passengers WHERE id=$1', [passengerId]);
    await client.query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGER_DELETED','passenger',$2,$3)`, [req.user!.id, passengerId, JSON.stringify({ permanent: true })]);
  });
  res.set('Cache-Control','private, no-store').status(204).end();
}));function excelFile(req: Express.Request) {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Seleccioná un archivo Excel');
  if (!/\.(xlsx|xls)$/i.test(req.file.originalname)) throw new AppError(400, 'INVALID_EXCEL', 'Se aceptan archivos .xlsx o .xls');
  return req.file;
}
adminRouter.post('/passengers/import/preview', upload.single('file'), asyncHandler(async (req, res) => {
  const file = excelFile(req); const parsed = parsePassengerWorkbook(file.buffer);
  const keys = parsed.rows.map(row => `${row.documentType}\u001F${row.documentNumber}`);
  const existing = keys.length ? await query<{document_type:string;document_number:string}>(`SELECT document_type,document_number FROM passengers WHERE document_type || chr(31) || document_number = ANY($1::text[])`, [keys]) : { rows: [] };
  const existingKeys = new Set(existing.rows.map(row => `${row.document_type}\u001F${row.document_number}`));
  const updates = parsed.rows.filter(row => existingKeys.has(`${row.documentType}\u001F${row.documentNumber}`)).length;
  res.set('Cache-Control', 'private, no-store').json({ valid: parsed.errors.length===0, totalRows: parsed.totalRows, validRows: parsed.rows.length, errors: parsed.errors, summary: { create: parsed.rows.length-updates, update: updates, rejected: parsed.errors.length }, sample: parsed.rows.slice(0, 25) });
}));
adminRouter.post('/passengers/import/commit', upload.single('file'), asyncHandler(async (req, res) => {
  const file = excelFile(req); const parsed = parsePassengerWorkbook(file.buffer);
  if (parsed.errors.length) throw new AppError(400, 'INVALID_PASSENGER_IMPORT', 'El archivo tiene errores. Validalo antes de confirmar.');
  const summary = await transaction(async client => {
    const importResult = await client.query<{id:string}>(`INSERT INTO passenger_imports(file_name,total_rows,imported_by) VALUES($1,$2,$3) RETURNING id`, [file.originalname,parsed.totalRows,req.user!.id]);
    let created=0, updated=0;
    for (const row of parsed.rows) {
      const found = await client.query<{id:string}>(`SELECT id FROM passengers WHERE document_type=$1 AND document_number=$2 FOR UPDATE`, [row.documentType,row.documentNumber]);
      const values = [row.externalNumber,row.fullName,row.documentType,row.documentNumber,row.birthDate,row.documentExpiresAt,row.country,row.passengerStatus,row.bonus,row.phone,row.mobile,row.email,importResult.rows[0].id];
      if (found.rowCount) { await client.query(`UPDATE passengers SET external_number=$1,full_name=$2,document_type=$3,document_number=$4,birth_date=$5,document_expires_at=$6,country=$7,passenger_status=$8,bonus=$9,phone=$10,mobile=$11,email=$12,source_import_id=$13,active=true,deactivated_at=NULL,deactivated_by=NULL WHERE id=$14`, [...values,found.rows[0].id]); updated++; }
      else { await client.query(`INSERT INTO passengers(external_number,full_name,document_type,document_number,birth_date,document_expires_at,country,passenger_status,bonus,phone,mobile,email,source_import_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, values); created++; }
    }
    await client.query(`UPDATE passenger_imports SET created_rows=$1,updated_rows=$2,rejected_rows=0 WHERE id=$3`, [created,updated,importResult.rows[0].id]);
    return { importId: importResult.rows[0].id, created, updated, rejected: 0, total: parsed.rows.length };
  });
  await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGERS_IMPORTED','passenger_import',$2,$3)`, [req.user!.id,summary.importId,JSON.stringify({ created:summary.created,updated:summary.updated,total:summary.total })]);
  res.status(201).json(summary);
}));
const departureSchemaBase = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(['MICRO', 'AEREO']),
  destination: z.string().min(2).max(160),
  startDate: z.string().date(),
  endDate: z.string().date(),
  eventDate: z.string().date().optional(),
  active: z.boolean().optional(),
  publicAccessActive: z.boolean().optional(),
  publicCode: z.string().trim().min(3).max(48).regex(/^[A-Za-z0-9_-]+$/).optional(),
});
const departureSchema = departureSchemaBase.refine(value => value.endDate >= value.startDate, { path: ['endDate'], message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio' });
const departurePatchSchema = departureSchemaBase.partial().refine(value => !value.startDate || !value.endDate || value.endDate >= value.startDate, { path: ['endDate'], message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio' });
const idsSchema = z.object({ ids: z.array(z.string().uuid()) });

async function departureExists(id: string) {
  const result = await query('SELECT id FROM departures WHERE id=$1', [id]);
  if (!result.rowCount) throw new AppError(404, 'DEPARTURE_NOT_FOUND', 'Salida no encontrada');
}

adminRouter.get('/departures', asyncHandler(async (req, res) => {
  const includeInactive = String(req.query.includeInactive ?? '') === 'true';
  const result = await query(`
    SELECT d.id,d.type,d.name,d.destination,d.event_date::text,d.start_date::text,d.end_date::text,d.active,d.archived_at,d.created_at,d.public_code,d.public_access_active,
      COUNT(DISTINCT l.id)::int AS lot_count,
      COALESCE(array_agg(DISTINCT s.id) FILTER (WHERE s.id IS NOT NULL),ARRAY[]::uuid[]) school_ids,
      COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL),ARRAY[]::text[]) school_names,
      COALESCE(array_agg(DISTINCT s.code) FILTER (WHERE s.id IS NOT NULL),ARRAY[]::text[]) school_codes,
      COALESCE(array_agg(DISTINCT u.id) FILTER (WHERE u.id IS NOT NULL),ARRAY[]::uuid[]) coordinator_ids,
      COALESCE(array_agg(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL),ARRAY[]::text[]) coordinator_names
    FROM departures d
    LEFT JOIN departure_schools ds ON ds.departure_id=d.id
    LEFT JOIN schools s ON s.id=ds.school_id
    LEFT JOIN departure_coordinators dc ON dc.departure_id=d.id
    LEFT JOIN users u ON u.id=dc.user_id AND u.active
    LEFT JOIN lots l ON l.departure_id=d.id
    WHERE ($1::boolean OR d.active = true)
    GROUP BY d.id
    ORDER BY d.start_date DESC,d.name
  `, [includeInactive]);
  res.json({ items: result.rows });
}));
adminRouter.post('/departures', asyncHandler(async (req,res) => {
  const input=departureSchema.parse(req.body);
  const generatedCode=[input.type,crypto.randomBytes(4).toString('hex').toUpperCase()].join('-');
  const result=await query('INSERT INTO departures(type,name,destination,event_date,start_date,end_date,active,created_by,public_code,public_access_active) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9) RETURNING id,type,name,destination,event_date::text,start_date::text,end_date::text,active,archived_at,created_at,public_code,public_access_active', [input.type,input.name,input.destination,input.startDate,input.endDate,input.active??true,req.user!.id,input.publicCode??generatedCode,input.publicAccessActive??true]);  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'DEPARTURE_CREATED','departure',result.rows[0].id,JSON.stringify({type:input.type,name:input.name,startDate:input.startDate,endDate:input.endDate})]);
  res.status(201).json(result.rows[0]);
}));
adminRouter.patch('/departures/:id', asyncHandler(async(req,res) => {
  const input=departurePatchSchema.parse(req.body); await departureExists(String(req.params.id));
  const current=await query<{start_date:string;end_date:string}>('SELECT start_date::text,end_date::text FROM departures WHERE id=$1',[String(req.params.id)]);
  const startDate=input.startDate ?? current.rows[0].start_date;
  const endDate=input.endDate ?? current.rows[0].end_date;
  if(endDate < startDate) throw new AppError(400,'INVALID_DATE_RANGE','La fecha de fin debe ser igual o posterior a la fecha de inicio');
  const result=await query(`UPDATE departures SET type=COALESCE($1,type),name=COALESCE($2,name),destination=COALESCE($3,destination),event_date=$4,start_date=$4,end_date=$5,active=COALESCE($6,active),public_access_active=COALESCE($7,public_access_active),public_code=COALESCE($8,public_code),archived_at=CASE WHEN COALESCE($6,active) THEN NULL WHEN active THEN now() ELSE archived_at END WHERE id=$9 RETURNING id,type,name,destination,event_date::text,start_date::text,end_date::text,active,archived_at,public_code,public_access_active`,[input.type??null,input.name??null,input.destination??null,startDate,endDate,input.active??null,input.publicAccessActive??null,input.publicCode??null,String(req.params.id)]);  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,input.active===false?'DEPARTURE_ARCHIVED':input.active===true?'DEPARTURE_REACTIVATED':'DEPARTURE_UPDATED','departure',String(req.params.id),JSON.stringify({...input,startDate,endDate})]);
  res.json(result.rows[0]);
}));
adminRouter.put('/departures/:id/schools', asyncHandler(async(req,res) => {
  const input=idsSchema.parse(req.body); await departureExists(String(req.params.id)); const activeDeparture=await query('SELECT 1 FROM departures WHERE id=$1 AND active',[String(req.params.id)]); if(!activeDeparture.rowCount) throw new AppError(409,'DEPARTURE_ARCHIVED','La salida est? archivada o no existe');
  await transaction(async client=>{await client.query('DELETE FROM departure_schools WHERE departure_id=$1',[String(req.params.id)]);for(const schoolId of input.ids){const school=await client.query('SELECT 1 FROM schools WHERE id=$1 AND active AND deleted_at IS NULL',[schoolId]);if(!school.rowCount)throw new AppError(400,'INVALID_SCHOOL','Colegio invalido');await client.query('INSERT INTO departure_schools(departure_id,school_id) VALUES($1,$2)',[req.params.id,schoolId]);}});
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'DEPARTURE_SCHOOLS_UPDATED','departure',String(req.params.id),JSON.stringify({schoolIds:input.ids})]);res.status(204).end();
}));
adminRouter.put('/departures/:id/coordinators', asyncHandler(async(req,res) => {
  const input=idsSchema.parse(req.body); await departureExists(String(req.params.id)); const activeDeparture=await query('SELECT 1 FROM departures WHERE id=$1 AND active',[String(req.params.id)]); if(!activeDeparture.rowCount) throw new AppError(409,'DEPARTURE_ARCHIVED','La salida est? archivada o no existe');
  await transaction(async client=>{await client.query('DELETE FROM departure_coordinators WHERE departure_id=$1',[String(req.params.id)]);for(const userId of input.ids){const coordinator=await client.query("SELECT 1 FROM users WHERE id=$1 AND role='COORDINATOR' AND active",[userId]);if(!coordinator.rowCount)throw new AppError(400,'INVALID_COORDINATOR','Coordinador invalido');await client.query('INSERT INTO departure_coordinators(departure_id,user_id) VALUES($1,$2)',[req.params.id,userId]);}});
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'DEPARTURE_COORDINATORS_UPDATED','departure',String(req.params.id),JSON.stringify({coordinatorIds:input.ids})]);res.status(204).end();
}));
adminRouter.delete('/departures/:id', asyncHandler(async(req,res) => {
  await departureExists(String(req.params.id));
  await transaction(async client => {
    await client.query('UPDATE lots SET deleted_at=now(), current_published_version_id=NULL WHERE departure_id=$1', [String(req.params.id)]);
    await client.query('DELETE FROM departure_schools WHERE departure_id=$1', [String(req.params.id)]);
    await client.query('DELETE FROM departure_coordinators WHERE departure_id=$1', [String(req.params.id)]);
    await client.query('DELETE FROM passenger_departure_assignments WHERE departure_id=$1', [String(req.params.id)]);
    await client.query('UPDATE departures SET active=false, archived_at=now() WHERE id=$1', [String(req.params.id)]);
  });
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4)', [req.user!.id, 'DEPARTURE_DELETED', 'departure', String(req.params.id)]);
  res.status(204).end();
}));
