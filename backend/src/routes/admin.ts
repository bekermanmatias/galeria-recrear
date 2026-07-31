import { Router } from 'express';
import crypto from 'node:crypto';
import { parse } from 'csv-parse/sync';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { hashPassword } from '../auth.js';
import { query, transaction } from '../db.js';
import { AppError } from '../errors.js';
import { parsePassengerWorkbook, passengerSchema } from '../passengers.js';
import { asyncHandler, parsePagination } from '../http.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const userSchema = z.object({ name: z.string().min(2).max(160), email: z.string().email(), password: z.string().min(8).max(128), role: z.enum(['ADMIN', 'COORDINATOR', 'PARENT']) });
const schoolSchema = z.object({ name: z.string().min(2).max(160), code: z.string().min(2).max(32).transform(v => v.toUpperCase()), botCode: z.string().min(2).max(32).transform(v => v.toUpperCase()), startDate: z.string().date().optional().nullable(), endDate: z.string().date().optional().nullable(), active: z.boolean().optional() });
const catalogSchema = z.object({ name: z.string().min(2).max(100), botCode: z.string().min(1).max(32).transform(v => v.toUpperCase()), active: z.boolean().optional(), sortOrder: z.number().int().optional() });

export const adminRouter = Router();

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const term = String(req.query.q ?? '');
  const includeInactive = String(req.query.includeInactive ?? '') === 'true';
  const result = await query(`
    SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
           COALESCE(array_agg(us.school_id) FILTER (WHERE us.school_id IS NOT NULL AND us.active = true), ARRAY[]::uuid[]) as school_ids
    FROM users u
    LEFT JOIN user_schools us ON u.id = us.user_id
    WHERE ($4::boolean OR u.active = true)
      AND (u.name ILIKE $1 OR u.email ILIKE $1)
    GROUP BY u.id
    ORDER BY u.name
    LIMIT $2 OFFSET $3
  `, [`%${term}%`, pageSize, (page - 1) * pageSize, includeInactive]);
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
    if (!target.rowCount || !target.rows[0].active) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    if (target.rows[0].role === 'ADMIN') {
      const admins = await client.query("SELECT count(*)::int AS total FROM users WHERE role='ADMIN' AND active");
      if (admins.rows[0].total <= 1) throw new AppError(400, 'LAST_ADMIN', 'No se puede eliminar el último administrador activo');
    }
    await client.query('UPDATE users SET active=false WHERE id=$1', [userId]);
    await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
    await client.query('UPDATE user_schools SET active=false WHERE user_id=$1', [userId]);
    await client.query('DELETE FROM departure_coordinators WHERE user_id=$1', [userId]);
  });
  res.status(204).end();
}));

adminRouter.get('/schools', asyncHandler(async (_req, res) => {
  const result = await query(`
    SELECT s.*, p.active AS public_link_active, p.generated_at AS public_link_generated_at, p.revoked_at AS public_link_revoked_at, p.token_value AS public_link_token,
           COALESCE(array_agg(u.id) FILTER (WHERE u.id IS NOT NULL), ARRAY[]::uuid[]) as coordinator_ids,
           COALESCE(array_agg(u.name) FILTER (WHERE u.id IS NOT NULL), ARRAY[]::text[]) as coordinators
    FROM schools s
    LEFT JOIN public_school_links p ON p.school_id = s.id
    LEFT JOIN user_schools us ON s.id = us.school_id AND us.membership_role = 'COORDINATOR' AND us.active = true
    LEFT JOIN users u ON us.user_id = u.id AND u.active = true
    WHERE s.deleted_at IS NULL AND s.active = true
    GROUP BY s.id, p.active, p.generated_at, p.revoked_at, p.token_value
    ORDER BY s.name
  `);
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
  if (!result.rowCount) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'Colegio no encontrado'); res.json(result.rows[0]);
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
  adminRouter.get(`/${route}`, asyncHandler(async (_req, res) => { const result = await query(`SELECT * FROM ${table} WHERE active = true ORDER BY ${hasSort ? 'sort_order, ' : ''}name`); res.json({ items: result.rows }); }));
  adminRouter.post(`/${route}`, asyncHandler(async (req, res) => { const input = catalogSchema.parse(req.body); const result = await query(`INSERT INTO ${table} (name, bot_code, active${hasSort ? ', sort_order' : ''}) VALUES ($1,$2,$3${hasSort ? ',$4' : ''}) RETURNING *`, hasSort ? [input.name,input.botCode,input.active ?? true,input.sortOrder ?? 0] : [input.name,input.botCode,input.active ?? true]); res.status(201).json(result.rows[0]); }));
  adminRouter.patch(`/${route}/:id`, asyncHandler(async (req, res) => { const input = catalogSchema.partial().parse(req.body); const result = await query(`UPDATE ${table} SET name=COALESCE($1,name), bot_code=COALESCE($2,bot_code), active=COALESCE($3,active)${hasSort ? ', sort_order=COALESCE($4,sort_order)' : ''} WHERE id=$${hasSort ? 5 : 4} RETURNING *`, hasSort ? [input.name ?? null,input.botCode ?? null,input.active ?? null,input.sortOrder ?? null,req.params.id] : [input.name ?? null,input.botCode ?? null,input.active ?? null,String(req.params.id)]); if (!result.rowCount) throw new AppError(404, 'CATALOG_NOT_FOUND', 'Registro no encontrado'); res.json(result.rows[0]); }));
  adminRouter.delete(`/${route}/:id`, asyncHandler(async (req, res) => { await query(`UPDATE ${table} SET active=false WHERE id=$1`, [String(req.params.id)]); res.status(204).end(); }));
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
  if (!kind) throw new AppError(400, 'INVALID_CATALOG', 'CatÃ¡logo invÃ¡lido');
  const table = kind === 'activities' ? 'school_activities' : 'school_shifts'; const column = kind === 'activities' ? 'activity_id' : 'shift_id';
  await query(`INSERT INTO ${table} (school_id, ${column}, enabled) VALUES ($1,$2,true) ON CONFLICT (school_id,${column}) DO UPDATE SET enabled=true`, [req.params.schoolId,req.params.catalogId]);
  res.status(204).end();
}));

adminRouter.post('/imports/:kind/preview', upload.single('file'), asyncHandler(async (req, res) => {
  const kind = z.enum(['schools', 'users', 'memberships']).parse(req.params.kind);
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'SeleccionÃ¡ un CSV');
  const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const required: Record<typeof kind, string[]> = { schools: ['name','code','bot_code'], users: ['name','email','password','role'], memberships: ['email','school_code','membership_role'] };
  const errors = rows.flatMap((row, index) => required[kind].filter(key => !row[key]).map(key => ({ row: index + 2, field: key, message: 'Obligatorio' })));
  res.json({ kind, rows, valid: errors.length === 0, errors });
}));
adminRouter.post('/imports/:kind/commit', upload.single('file'), asyncHandler(async (req, res) => {
  const kind = z.enum(['schools', 'users', 'memberships']).parse(req.params.kind);
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'SeleccionÃ¡ un CSV');
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

adminRouter.get('/passengers', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const term = String(req.query.q ?? '').trim();
  const result = await query(`
    SELECT id,external_number,full_name,document_type,document_number,birth_date::text,document_expires_at::text,country,passenger_status,bonus,phone,mobile,email,active,created_at,updated_at,deactivated_at
    FROM passengers
    WHERE full_name ILIKE $1 OR document_number ILIKE $1 OR COALESCE(external_number,'') ILIKE $1
    ORDER BY active DESC, full_name
    LIMIT $2 OFFSET $3
  `, [`%${term}%`, pageSize, (page - 1) * pageSize]);
  res.set('Cache-Control', 'private, no-store').json({ items: result.rows, page, pageSize });
}));
adminRouter.get('/passengers/imports', asyncHandler(async (_req, res) => {
  const result = await query(`SELECT i.id,i.file_name,i.total_rows,i.created_rows,i.updated_rows,i.rejected_rows,i.created_at,u.name AS imported_by_name FROM passenger_imports i JOIN users u ON u.id=i.imported_by ORDER BY i.created_at DESC LIMIT 30`);
  res.set('Cache-Control', 'private, no-store').json({ items: result.rows });
}));
adminRouter.patch('/passengers/:id', asyncHandler(async (req, res) => {
  const input = passengerSchema.partial().parse(req.body);
  const result = await query(`
    UPDATE passengers SET external_number=COALESCE($1,external_number),full_name=COALESCE($2,full_name),document_type=COALESCE($3,document_type),document_number=COALESCE($4,document_number),birth_date=COALESCE($5,birth_date),document_expires_at=COALESCE($6,document_expires_at),country=COALESCE($7,country),passenger_status=COALESCE($8,passenger_status),bonus=COALESCE($9,bonus),phone=COALESCE($10,phone),mobile=COALESCE($11,mobile),email=COALESCE($12,email),active=COALESCE($13,active),deactivated_at=CASE WHEN COALESCE($13,active) THEN NULL ELSE now() END,deactivated_by=CASE WHEN COALESCE($13,active) THEN NULL ELSE $14 END
    WHERE id=$15
    RETURNING id,external_number,full_name,document_type,document_number,birth_date::text,document_expires_at::text,country,passenger_status,bonus,phone,mobile,email,active,updated_at,deactivated_at
  `, [input.externalNumber ?? null,input.fullName ?? null,input.documentType?.toUpperCase() ?? null,input.documentNumber ?? null,input.birthDate ?? null,input.documentExpiresAt ?? null,input.country ?? null,input.passengerStatus ?? null,input.bonus ?? null,input.phone ?? null,input.mobile ?? null,input.email?.toLowerCase() ?? null,input.active ?? null,req.user!.id,String(req.params.id)]);
  if (!result.rowCount) throw new AppError(404, 'PASSENGER_NOT_FOUND', 'Pasajero no encontrado');
  await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGER_UPDATED','passenger',$2,'{}')`, [req.user!.id, String(req.params.id)]);
  res.set('Cache-Control', 'private, no-store').json(result.rows[0]);
}));
adminRouter.delete('/passengers/:id', asyncHandler(async (req, res) => {
  const result = await query(`UPDATE passengers SET active=false,deactivated_at=now(),deactivated_by=$1 WHERE id=$2 AND active=true RETURNING id`, [req.user!.id,String(req.params.id)]);
  if (!result.rowCount) throw new AppError(404, 'PASSENGER_NOT_FOUND', 'Pasajero no encontrado o ya est? desactivado');
  await query(`INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'PASSENGER_DEACTIVATED','passenger',$2,'{}')`, [req.user!.id, String(req.params.id)]);
  res.status(204).end();
}));
function excelFile(req: Express.Request) {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Seleccion? un archivo Excel');
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
const departureSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(['MICRO', 'AEREO']),
  destination: z.string().min(2).max(160),
  eventDate: z.string().date(),
  active: z.boolean().optional(),
  publicAccessActive: z.boolean().optional(),
  publicCode: z.string().trim().min(3).max(48).regex(/^[A-Za-z0-9_-]+$/).optional(),
});
const idsSchema = z.object({ ids: z.array(z.string().uuid()) });

async function departureExists(id: string) {
  const result = await query('SELECT id FROM departures WHERE id=$1', [id]);
  if (!result.rowCount) throw new AppError(404, 'DEPARTURE_NOT_FOUND', 'Salida no encontrada');
}

adminRouter.get('/departures', asyncHandler(async (_req, res) => {
  const result = await query(`
    SELECT d.id,d.type,d.name,d.destination,d.event_date::text,d.active,d.archived_at,d.created_at,d.public_code,d.public_access_active,
      COUNT(DISTINCT l.id)::int AS lot_count,
      COALESCE(array_agg(DISTINCT s.id) FILTER (WHERE s.id IS NOT NULL),ARRAY[]::uuid[]) school_ids,
      COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL),ARRAY[]::text[]) school_names,
      COALESCE(array_agg(DISTINCT u.id) FILTER (WHERE u.id IS NOT NULL),ARRAY[]::uuid[]) coordinator_ids,
      COALESCE(array_agg(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL),ARRAY[]::text[]) coordinator_names
    FROM departures d
    LEFT JOIN departure_schools ds ON ds.departure_id=d.id
    LEFT JOIN schools s ON s.id=ds.school_id
    LEFT JOIN departure_coordinators dc ON dc.departure_id=d.id
    LEFT JOIN users u ON u.id=dc.user_id AND u.active
    LEFT JOIN lots l ON l.departure_id=d.id
    WHERE d.active = true
    GROUP BY d.id
    ORDER BY d.event_date DESC,d.name
  `);
  res.json({ items: result.rows });
}));
adminRouter.post('/departures', asyncHandler(async (req,res) => {
  const input=departureSchema.parse(req.body);
  const generatedCode=[input.type,crypto.randomBytes(4).toString('hex').toUpperCase()].join('-');
  const result=await query('INSERT INTO departures(type,name,destination,event_date,active,created_by,public_code,public_access_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,type,name,destination,event_date::text,active,archived_at,created_at,public_code,public_access_active', [input.type,input.name,input.destination,input.eventDate,input.active??true,req.user!.id,input.publicCode??generatedCode,input.publicAccessActive??true]);  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'DEPARTURE_CREATED','departure',result.rows[0].id,JSON.stringify({type:input.type,name:input.name})]);
  res.status(201).json(result.rows[0]);
}));
adminRouter.patch('/departures/:id', asyncHandler(async(req,res) => {
  const input=departureSchema.partial().parse(req.body); await departureExists(String(req.params.id));
  const result=await query(`UPDATE departures SET type=COALESCE($1,type),name=COALESCE($2,name),destination=COALESCE($3,destination),event_date=COALESCE($4,event_date),active=COALESCE($5,active),public_access_active=COALESCE($6,public_access_active),public_code=COALESCE($7,public_code),archived_at=CASE WHEN COALESCE($5,active) THEN NULL WHEN active THEN now() ELSE archived_at END WHERE id=$8 RETURNING id,type,name,destination,event_date::text,active,archived_at,public_code,public_access_active`,[input.type??null,input.name??null,input.destination??null,input.eventDate??null,input.active??null,input.publicAccessActive??null,input.publicCode??null,String(req.params.id)]);  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,input.active===false?'DEPARTURE_ARCHIVED':'DEPARTURE_UPDATED','departure',String(req.params.id),JSON.stringify(input)]);
  res.json(result.rows[0]);
}));
adminRouter.put('/departures/:id/schools', asyncHandler(async(req,res) => {
  const input=idsSchema.parse(req.body); await departureExists(String(req.params.id));
  await transaction(async client=>{await client.query('DELETE FROM departure_schools WHERE departure_id=$1',[String(req.params.id)]);for(const schoolId of input.ids){const school=await client.query('SELECT 1 FROM schools WHERE id=$1 AND active AND deleted_at IS NULL',[schoolId]);if(!school.rowCount)throw new AppError(400,'INVALID_SCHOOL','Colegio invÃ¡lido');await client.query('INSERT INTO departure_schools(departure_id,school_id) VALUES($1,$2)',[req.params.id,schoolId]);}});
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'DEPARTURE_SCHOOLS_UPDATED','departure',String(req.params.id),JSON.stringify({schoolIds:input.ids})]);res.status(204).end();
}));
adminRouter.put('/departures/:id/coordinators', asyncHandler(async(req,res) => {
  const input=idsSchema.parse(req.body); await departureExists(String(req.params.id));
  await transaction(async client=>{await client.query('DELETE FROM departure_coordinators WHERE departure_id=$1',[String(req.params.id)]);for(const userId of input.ids){const coordinator=await client.query("SELECT 1 FROM users WHERE id=$1 AND role='COORDINATOR' AND active",[userId]);if(!coordinator.rowCount)throw new AppError(400,'INVALID_COORDINATOR','Coordinador invÃ¡lido');await client.query('INSERT INTO departure_coordinators(departure_id,user_id) VALUES($1,$2)',[req.params.id,userId]);}});
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
