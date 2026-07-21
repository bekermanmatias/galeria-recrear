import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import multer from 'multer';
import { z } from 'zod';
import { hashPassword } from '../auth.js';
import { query, transaction } from '../db.js';
import { AppError } from '../errors.js';
import { asyncHandler, parsePagination } from '../http.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const userSchema = z.object({ name: z.string().min(2).max(160), email: z.string().email(), password: z.string().min(8).max(128), role: z.enum(['ADMIN', 'COORDINATOR', 'PARENT']) });
const schoolSchema = z.object({ name: z.string().min(2).max(160), code: z.string().min(2).max(32).transform(v => v.toUpperCase()), botCode: z.string().min(2).max(32).transform(v => v.toUpperCase()), startDate: z.string().date().optional().nullable(), endDate: z.string().date().optional().nullable(), active: z.boolean().optional() });
const catalogSchema = z.object({ name: z.string().min(2).max(100), botCode: z.string().min(1).max(32).transform(v => v.toUpperCase()), active: z.boolean().optional(), sortOrder: z.number().int().optional() });

export const adminRouter = Router();

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const term = String(req.query.q ?? '');
  const result = await query(`
    SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
           COALESCE(array_agg(us.school_id) FILTER (WHERE us.school_id IS NOT NULL AND us.active = true), ARRAY[]::uuid[]) as school_ids
    FROM users u
    LEFT JOIN user_schools us ON u.id = us.user_id
    WHERE u.name ILIKE $1 OR u.email ILIKE $1
    GROUP BY u.id
    ORDER BY u.name
    LIMIT $2 OFFSET $3
  `, [`%${term}%`, pageSize, (page - 1) * pageSize]);
  res.json({ items: result.rows, page, pageSize });
}));
adminRouter.post('/users', asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  const result = await query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active', [input.name, input.email, await hashPassword(input.password), input.role]);
  res.status(201).json(result.rows[0]);
}));
adminRouter.patch('/users/:id', asyncHandler(async (req, res) => {
  const input = userSchema.partial().parse(req.body);
  const values = [input.name ?? null, input.email ?? null, input.role ?? null, input.password ? await hashPassword(input.password) : null, req.params.id];
  const result = await query('UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), password_hash = COALESCE($4, password_hash) WHERE id = $5 RETURNING id, name, email, role, active', values);
  if (!result.rowCount) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  res.json(result.rows[0]);
}));
adminRouter.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const input = z.object({ password: z.string().min(8).max(128) }).parse(req.body);
  const result = await query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [await hashPassword(input.password), req.params.id]);
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
adminRouter.delete('/users/:id', asyncHandler(async (req, res) => { await query('UPDATE users SET active = false WHERE id = $1', [req.params.id]); res.status(204).end(); }));

adminRouter.get('/schools', asyncHandler(async (_req, res) => { const result = await query('SELECT * FROM schools WHERE deleted_at IS NULL ORDER BY name'); res.json({ items: result.rows }); }));
adminRouter.post('/schools', asyncHandler(async (req, res) => {
  const input = schoolSchema.parse(req.body);
  const result = await query('INSERT INTO schools (name, code, bot_code, start_date, end_date, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [input.name, input.code, input.botCode, input.startDate ?? null, input.endDate ?? null, input.active ?? true]);
  res.status(201).json(result.rows[0]);
}));
adminRouter.patch('/schools/:id', asyncHandler(async (req, res) => {
  const input = schoolSchema.partial().parse(req.body);
  const result = await query('UPDATE schools SET name=COALESCE($1,name), code=COALESCE($2,code), bot_code=COALESCE($3,bot_code), start_date=COALESCE($4,start_date), end_date=COALESCE($5,end_date), active=COALESCE($6,active) WHERE id=$7 AND deleted_at IS NULL RETURNING *', [input.name ?? null,input.code ?? null,input.botCode ?? null,input.startDate ?? null,input.endDate ?? null,input.active ?? null,req.params.id]);
  if (!result.rowCount) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'Colegio no encontrado'); res.json(result.rows[0]);
}));
adminRouter.delete('/schools/:id', asyncHandler(async (req, res) => { await query('UPDATE schools SET deleted_at = now(), active = false WHERE id = $1', [req.params.id]); res.status(204).end(); }));

for (const [route, table, hasSort] of [['activities', 'activities', false], ['shifts', 'shifts', true]] as const) {
  adminRouter.get(`/${route}`, asyncHandler(async (_req, res) => { const result = await query(`SELECT * FROM ${table} ORDER BY ${hasSort ? 'sort_order, ' : ''}name`); res.json({ items: result.rows }); }));
  adminRouter.post(`/${route}`, asyncHandler(async (req, res) => { const input = catalogSchema.parse(req.body); const result = await query(`INSERT INTO ${table} (name, bot_code, active${hasSort ? ', sort_order' : ''}) VALUES ($1,$2,$3${hasSort ? ',$4' : ''}) RETURNING *`, hasSort ? [input.name,input.botCode,input.active ?? true,input.sortOrder ?? 0] : [input.name,input.botCode,input.active ?? true]); res.status(201).json(result.rows[0]); }));
  adminRouter.patch(`/${route}/:id`, asyncHandler(async (req, res) => { const input = catalogSchema.partial().parse(req.body); const result = await query(`UPDATE ${table} SET name=COALESCE($1,name), bot_code=COALESCE($2,bot_code), active=COALESCE($3,active)${hasSort ? ', sort_order=COALESCE($4,sort_order)' : ''} WHERE id=$${hasSort ? 5 : 4} RETURNING *`, hasSort ? [input.name ?? null,input.botCode ?? null,input.active ?? null,input.sortOrder ?? null,req.params.id] : [input.name ?? null,input.botCode ?? null,input.active ?? null,req.params.id]); if (!result.rowCount) throw new AppError(404, 'CATALOG_NOT_FOUND', 'Registro no encontrado'); res.json(result.rows[0]); }));
  adminRouter.delete(`/${route}/:id`, asyncHandler(async (req, res) => { await query(`UPDATE ${table} SET active=false WHERE id=$1`, [req.params.id]); res.status(204).end(); }));
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
  if (!kind) throw new AppError(400, 'INVALID_CATALOG', 'Catálogo inválido');
  const table = kind === 'activities' ? 'school_activities' : 'school_shifts'; const column = kind === 'activities' ? 'activity_id' : 'shift_id';
  await query(`INSERT INTO ${table} (school_id, ${column}, enabled) VALUES ($1,$2,true) ON CONFLICT (school_id,${column}) DO UPDATE SET enabled=true`, [req.params.schoolId,req.params.catalogId]);
  res.status(204).end();
}));

adminRouter.post('/imports/:kind/preview', upload.single('file'), asyncHandler(async (req, res) => {
  const kind = z.enum(['schools', 'users', 'memberships']).parse(req.params.kind);
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Seleccioná un CSV');
  const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const required: Record<typeof kind, string[]> = { schools: ['name','code','bot_code'], users: ['name','email','password','role'], memberships: ['email','school_code','membership_role'] };
  const errors = rows.flatMap((row, index) => required[kind].filter(key => !row[key]).map(key => ({ row: index + 2, field: key, message: 'Obligatorio' })));
  res.json({ kind, rows, valid: errors.length === 0, errors });
}));
adminRouter.post('/imports/:kind/commit', upload.single('file'), asyncHandler(async (req, res) => {
  const kind = z.enum(['schools', 'users', 'memberships']).parse(req.params.kind);
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Seleccioná un CSV');
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
