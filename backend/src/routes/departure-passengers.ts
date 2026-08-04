import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { assertDepartureAccess, requireRoles } from '../auth.js';
import { query, transaction } from '../db.js';
import { AppError } from '../errors.js';
import { asyncHandler, parsePagination } from '../http.js';
import { parsePassengerWorkbook, passengerSchema } from '../passengers.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const uuid = z.string().uuid();
const passengerFields = 'p.id,p.external_number,p.full_name,p.document_type,p.document_number,p.birth_date::text,p.document_expires_at::text,p.country,p.passenger_status,p.bonus,p.phone,p.mobile,p.email,p.active,p.created_at,p.updated_at,p.deactivated_at';

async function departureContext(departureId: string, user: NonNullable<Express.Request['user']>) {
  await assertDepartureAccess(user, departureId, ['COORDINATOR']);
  const departure = await query<{id:string;name:string;type:'MICRO'|'AEREO';destination:string;start_date:string;end_date:string;active:boolean}>(`SELECT id,name,type,destination,start_date::text,end_date::text,active FROM departures WHERE id=$1`, [departureId]);
  if (!departure.rowCount) throw new AppError(404, 'DEPARTURE_NOT_FOUND', 'Salida no encontrada');
  const schools = await query<{id:string;name:string;code:string;passenger_count:number}>(`SELECT s.id,s.name,s.code,COUNT(pda.id)::int AS passenger_count FROM departure_schools ds JOIN schools s ON s.id=ds.school_id LEFT JOIN passenger_departure_assignments pda ON pda.departure_id=ds.departure_id AND pda.school_id=ds.school_id AND pda.unassigned_at IS NULL WHERE ds.departure_id=$1 GROUP BY s.id,s.name,s.code ORDER BY s.name`, [departureId]);
  return { departure: departure.rows[0], schools: schools.rows };
}

async function assertDepartureSchool(departureId: string, schoolId: string) {
  const result = await query('SELECT 1 FROM departure_schools ds JOIN schools s ON s.id=ds.school_id WHERE ds.departure_id=$1 AND ds.school_id=$2 AND s.active AND s.deleted_at IS NULL', [departureId, schoolId]);
  if (!result.rowCount) throw new AppError(400, 'INVALID_DEPARTURE_SCHOOL', 'El colegio no participa de esta salida');
}

async function assignToDeparture(client: any, departureId: string, schoolId: string, passengerId: string, actorId: string) {
  await client.query('UPDATE passenger_departure_assignments SET unassigned_at=NULL,assigned_by=$4,school_id=$3 WHERE passenger_id=$1 AND departure_id=$2 AND unassigned_at IS NOT NULL', [passengerId, departureId, schoolId, actorId]);
  await client.query('INSERT INTO passenger_departure_assignments(passenger_id,departure_id,school_id,assigned_by) SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM passenger_departure_assignments WHERE passenger_id=$1 AND departure_id=$2 AND unassigned_at IS NULL)', [passengerId, departureId, schoolId, actorId]);
}

async function upsertSchoolPassenger(client: any, schoolId: string, row: ReturnType<typeof passengerSchema.parse>, actorId: string) {
  const found = await client.query('SELECT id FROM passengers WHERE document_type=$1 AND document_number=$2 FOR UPDATE', [row.documentType, row.documentNumber]);
  let passengerId: string;
  if (found.rowCount) {
    passengerId = found.rows[0].id;
    await client.query('UPDATE passengers SET external_number=$1,full_name=$2,document_type=$3,document_number=$4,birth_date=$5,document_expires_at=$6,country=$7,passenger_status=$8,bonus=$9,phone=$10,mobile=$11,email=$12,active=COALESCE($13,active),deactivated_at=CASE WHEN COALESCE($13,active) THEN NULL ELSE deactivated_at END WHERE id=$14', [row.externalNumber,row.fullName,row.documentType,row.documentNumber,row.birthDate,row.documentExpiresAt,row.country,row.passengerStatus,row.bonus,row.phone,row.mobile,row.email,row.active ?? true,passengerId]);
  } else {
    const created = await client.query('INSERT INTO passengers(external_number,full_name,document_type,document_number,birth_date,document_expires_at,country,passenger_status,bonus,phone,mobile,email,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id', [row.externalNumber,row.fullName,row.documentType,row.documentNumber,row.birthDate,row.documentExpiresAt,row.country,row.passengerStatus,row.bonus,row.phone,row.mobile,row.email,row.active ?? true]);
    passengerId = created.rows[0].id;
  }
  await client.query('UPDATE passenger_school_assignments SET unassigned_at=NULL,assigned_by=$3 WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NOT NULL', [passengerId, schoolId, actorId]);
  await client.query('INSERT INTO passenger_school_assignments(passenger_id,school_id,assigned_by) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM passenger_school_assignments WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NULL)', [passengerId, schoolId, actorId]);
  return passengerId;
}

export const departurePassengersRouter = Router();

departurePassengersRouter.get('/:departureId/passengers', asyncHandler(async (req, res) => {
  const departureId = uuid.parse(req.params.departureId); const schoolId = req.query.schoolId ? uuid.parse(String(req.query.schoolId)) : undefined;
  const context = await departureContext(departureId, req.user!); if (schoolId) await assertDepartureSchool(departureId, schoolId);
  const { page, pageSize } = parsePagination(req.query); const term = String(req.query.q ?? '').trim();
  const params: unknown[] = [departureId, `%${term}%`]; let where = 'pda.departure_id=$1 AND pda.unassigned_at IS NULL AND (p.full_name ILIKE $2 OR p.document_number ILIKE $2 OR COALESCE(p.external_number,\'\') ILIKE $2)';
  if (schoolId) { params.push(schoolId); where += ` AND pda.school_id=$${params.length}`; }
  params.push(pageSize, (page - 1) * pageSize);
  const items = await query(`${'SELECT ' + passengerFields},s.id AS school_id,s.name AS school_name,s.code AS school_code FROM passenger_departure_assignments pda JOIN passengers p ON p.id=pda.passenger_id JOIN schools s ON s.id=pda.school_id WHERE ${where} ORDER BY s.name,p.active DESC,p.full_name LIMIT $${params.length - 1} OFFSET $${params.length}` , params);
  const total = await query<{total:number}>(`SELECT COUNT(*)::int total FROM passenger_departure_assignments pda JOIN passengers p ON p.id=pda.passenger_id WHERE ${where}`, params.slice(0, schoolId ? 3 : 2));
  res.set('Cache-Control', 'private, no-store').json({ ...context, total: total.rows[0].total, items: items.rows, page, pageSize });
}));

departurePassengersRouter.get('/:departureId/schools/:schoolId/passengers/available', requireRoles('ADMIN'), asyncHandler(async (req, res) => {
  const departureId = uuid.parse(req.params.departureId); const schoolId = uuid.parse(req.params.schoolId); await departureContext(departureId, req.user!); await assertDepartureSchool(departureId, schoolId);
  const term = String(req.query.q ?? '').trim(); const result = await query(`${'SELECT ' + passengerFields} FROM passenger_school_assignments psa JOIN passengers p ON p.id=psa.passenger_id WHERE psa.school_id=$1 AND psa.unassigned_at IS NULL AND NOT EXISTS (SELECT 1 FROM passenger_departure_assignments pda WHERE pda.passenger_id=p.id AND pda.departure_id=$2 AND pda.unassigned_at IS NULL) AND (p.full_name ILIKE $3 OR p.document_number ILIKE $3 OR COALESCE(p.external_number,'') ILIKE $3) ORDER BY p.active DESC,p.full_name LIMIT 100`, [schoolId, departureId, `%${term}%`]);
  res.set('Cache-Control', 'private, no-store').json({ items: result.rows });
}));

departurePassengersRouter.post('/:departureId/passengers/:passengerId', requireRoles('ADMIN'), asyncHandler(async (req, res) => {
  const departureId = uuid.parse(req.params.departureId); const passengerId = uuid.parse(req.params.passengerId); const schoolId = uuid.parse(req.body.schoolId); await departureContext(departureId, req.user!); await assertDepartureSchool(departureId, schoolId);
  await transaction(async client => { const membership = await client.query('SELECT 1 FROM passenger_school_assignments WHERE passenger_id=$1 AND school_id=$2 AND unassigned_at IS NULL', [passengerId, schoolId]); if (!membership.rowCount) throw new AppError(400, 'PASSENGER_NOT_IN_SCHOOL', 'El pasajero no pertenece al colegio seleccionado'); await assignToDeparture(client, departureId, schoolId, passengerId, req.user!.id); });
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [req.user!.id, 'PASSENGER_DEPARTURE_ASSIGNED', 'passenger', passengerId, JSON.stringify({ departureId, schoolId })]); res.status(204).end();
}));

departurePassengersRouter.post('/:departureId/passengers', requireRoles('ADMIN'), asyncHandler(async (req, res) => {
  const departureId = uuid.parse(req.params.departureId); const input = z.object({ schoolId: uuid, passenger: passengerSchema }).parse(req.body); await departureContext(departureId, req.user!); await assertDepartureSchool(departureId, input.schoolId);
  const passengerId = await transaction(async client => { const id = await upsertSchoolPassenger(client, input.schoolId, input.passenger, req.user!.id); await assignToDeparture(client, departureId, input.schoolId, id, req.user!.id); return id; });
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [req.user!.id, 'PASSENGER_DEPARTURE_CREATED', 'passenger', passengerId, JSON.stringify({ departureId, schoolId: input.schoolId })]); res.status(201).json({ id: passengerId });
}));

departurePassengersRouter.post('/:departureId/passengers/import/preview', requireRoles('ADMIN'), upload.single('file'), asyncHandler(async (req, res) => {
  const departureId = uuid.parse(req.params.departureId); const schoolId = uuid.parse(req.body.schoolId); await departureContext(departureId, req.user!); await assertDepartureSchool(departureId, schoolId); if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Seleccioná un archivo Excel');
  const parsed = parsePassengerWorkbook(req.file.buffer); res.json({ valid: parsed.errors.length === 0, totalRows: parsed.totalRows, validRows: parsed.rows.length, errors: parsed.errors, summary: { create: parsed.rows.length, update: 0, associate: parsed.rows.length, rejected: parsed.errors.length }, sample: parsed.rows.slice(0, 25) });
}));

departurePassengersRouter.post('/:departureId/passengers/import/commit', requireRoles('ADMIN'), upload.single('file'), asyncHandler(async (req, res) => {
  const departureId = uuid.parse(req.params.departureId); const schoolId = uuid.parse(req.body.schoolId); await departureContext(departureId, req.user!); await assertDepartureSchool(departureId, schoolId); if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Seleccioná un archivo Excel');
  const parsed = parsePassengerWorkbook(req.file.buffer); if (parsed.errors.length) throw new AppError(400, 'INVALID_PASSENGER_IMPORT', 'El archivo tiene errores. Validalo antes de confirmar.');
  const summary = await transaction(async client => { const imported = await client.query('INSERT INTO passenger_imports(file_name,total_rows,imported_by,school_id) VALUES($1,$2,$3,$4) RETURNING id', [req.file!.originalname, parsed.totalRows, req.user!.id, schoolId]); let created = 0; let updated = 0; for (const row of parsed.rows) { const found = await client.query('SELECT 1 FROM passengers WHERE document_type=$1 AND document_number=$2', [row.documentType, row.documentNumber]); const passengerId = await upsertSchoolPassenger(client, schoolId, row, req.user!.id); await assignToDeparture(client, departureId, schoolId, passengerId, req.user!.id); if (found.rowCount) updated++; else created++; } return { importId: imported.rows[0].id, created, updated, associated: parsed.rows.length }; });
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [req.user!.id, 'PASSENGERS_DEPARTURE_IMPORTED', 'passenger_import', summary.importId, JSON.stringify({ departureId, schoolId, ...summary })]); res.status(201).json(summary);
}));

departurePassengersRouter.delete('/:departureId/passengers/:passengerId', requireRoles('ADMIN'), asyncHandler(async (req, res) => {
  const departureId = uuid.parse(req.params.departureId); const passengerId = uuid.parse(req.params.passengerId); await departureContext(departureId, req.user!);
  const result = await query('UPDATE passenger_departure_assignments SET unassigned_at=now(),assigned_by=$3 WHERE departure_id=$1 AND passenger_id=$2 AND unassigned_at IS NULL RETURNING id,school_id', [departureId, passengerId, req.user!.id]); if (!result.rowCount) throw new AppError(404, 'PASSENGER_DEPARTURE_NOT_FOUND', 'Pasajero no asociado a esta salida');
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [req.user!.id, 'PASSENGER_DEPARTURE_UNASSIGNED', 'passenger', passengerId, JSON.stringify({ departureId, schoolId: result.rows[0].school_id })]); res.status(204).end();
}));