import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { Router } from 'express';
import { z } from 'zod';
import { fileTypeFromFile } from 'file-type';
import { assertSchoolAccess, requireRoles } from '../auth.js';
import { config, paths } from '../config.js';
import { query, transaction } from '../db.js';
import { AppError } from '../errors.js';
import { asyncHandler, parsePagination } from '../http.js';
import { getStorage } from '../storage.js';

const destination = async (done: (error: Error | null, destination: string) => void) => { try { await fs.mkdir(paths.uploads, { recursive: true }); done(null, paths.uploads); } catch (error) { done(error as Error, paths.uploads); } };
const disk = multer.diskStorage({ destination: (_req, _file, done) => { void destination(done); }, filename: (_req, file, done) => done(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`) });
const upload = multer({ storage: disk, limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 } });
const createSchema = z.object({ schoolId: z.string().uuid(), activityId: z.string().uuid().optional().nullable(), shiftId: z.string().uuid().optional().nullable(), eventDate: z.string().date() });
const moderationSchema = z.object({ action: z.enum(['reject', 'restore']) });
const accepted = new Map<string, 'IMAGE' | 'VIDEO'>([['image/jpeg','IMAGE'],['image/png','IMAGE'],['image/heic','IMAGE'],['image/heif','IMAGE'],['video/mp4','VIDEO'],['video/quicktime','VIDEO']]);
const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

type Lot = { id: string; school_id: string; event_date: string; school_code: string; shift_code: string; activity_code: string; latest_version_id: string | null; latest_status: string | null; current_published_version_id: string | null; };
async function loadLot(id: string) {
  const result = await query<Lot>(`SELECT l.id,l.school_id,l.event_date::text,s.code school_code,sh.bot_code shift_code,a.bot_code activity_code,l.current_published_version_id,
  (SELECT id FROM lot_versions WHERE lot_id=l.id ORDER BY version_number DESC LIMIT 1) latest_version_id,
  (SELECT status FROM lot_versions WHERE lot_id=l.id ORDER BY version_number DESC LIMIT 1) latest_status
  FROM lots l JOIN schools s ON s.id=l.school_id LEFT JOIN shifts sh ON sh.id=l.shift_id LEFT JOIN activities a ON a.id=l.activity_id WHERE l.id=$1`, [id]);
  if (!result.rowCount) throw new AppError(404, 'LOT_NOT_FOUND', 'Lote no encontrado'); return result.rows[0];
}
async function editableVersion(lotId: string) {
  const result = await query<{ id: string; version_number: number; status: string }>('SELECT id,version_number,status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1', [lotId]);
  const version = result.rows[0]; if (!version || !['DRAFT','UPLOADING'].includes(version.status)) throw new AppError(409, 'LOT_NOT_EDITABLE', 'El lote debe reabrirse antes de cargar mÃ¡s archivos'); return version;
}

export const lotsRouter = Router();
lotsRouter.get('/my-schools', asyncHandler(async (req, res) => {
  if (req.user!.role === 'ADMIN') { const all = await query('SELECT id,name,code,bot_code FROM schools WHERE active AND deleted_at IS NULL ORDER BY name'); return res.json({ items: all.rows }); }
  const result = await query('SELECT s.id,s.name,s.code,s.bot_code FROM schools s JOIN user_schools us ON us.school_id=s.id WHERE us.user_id=$1 AND us.membership_role=$2 AND us.active AND s.active AND s.deleted_at IS NULL ORDER BY s.name',[req.user!.id,req.user!.role]); res.json({ items: result.rows });
}));
lotsRouter.get('/catalogs', asyncHandler(async (req, res) => {
  const schoolId = z.string().uuid().parse(req.query.schoolId); await assertSchoolAccess(req.user!, schoolId, ['COORDINATOR','PARENT']);
  const [activities, shifts] = await Promise.all([query('SELECT a.id,a.name,a.bot_code FROM activities a JOIN school_activities sa ON sa.activity_id=a.id WHERE sa.school_id=$1 AND sa.enabled AND a.active ORDER BY a.name',[schoolId]),query('SELECT s.id,s.name,s.bot_code FROM shifts s JOIN school_shifts ss ON ss.shift_id=s.id WHERE ss.school_id=$1 AND ss.enabled AND s.active ORDER BY s.sort_order,s.name',[schoolId])]); res.json({ activities: activities.rows, shifts: shifts.rows });
}));
lotsRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query); const values: unknown[] = []; let where = 'WHERE 1=1';
  if (req.user!.role !== 'ADMIN') { values.push(req.user!.id,req.user!.role); where += ` AND EXISTS (SELECT 1 FROM user_schools us WHERE us.school_id=l.school_id AND us.user_id=$${values.length - 1} AND us.membership_role=$${values.length} AND us.active)`; }
  if (req.user!.role === 'PARENT') where += ' AND l.current_published_version_id IS NOT NULL';
  if (req.query.status && req.user!.role !== 'PARENT') { values.push(z.enum(['DRAFT','UPLOADING','PENDING','PUBLISHED','REJECTED','ERROR']).parse(req.query.status)); where += ` AND v.status=$${values.length}`; }
  values.push(pageSize,(page - 1)*pageSize); const limit = values.length - 1; const offset = values.length;
  const visibleVersion = req.user!.role === 'PARENT' ? 'l.current_published_version_id' : '(SELECT id FROM lot_versions WHERE lot_id=l.id ORDER BY version_number DESC LIMIT 1)';
  const orderBy = req.query.status === 'PENDING' ? 'COALESCE(v.submitted_at,v.created_at) ASC' : 'l.event_date DESC,v.created_at DESC';
  const result = await query(`SELECT l.id,l.event_date,s.id school_id,s.name school_name,a.name activity_name,sh.name shift_name,v.id version_id,v.version_number,v.status,v.submitted_at,v.created_at version_created_at,count(m.id) FILTER (WHERE m.status <> 'UPLOADING') approved_count FROM lots l JOIN schools s ON s.id=l.school_id LEFT JOIN activities a ON a.id=l.activity_id LEFT JOIN shifts sh ON sh.id=l.shift_id JOIN lot_versions v ON v.id=${visibleVersion} LEFT JOIN media_assets m ON m.lot_version_id=v.id ${where} GROUP BY l.id,s.id,a.id,sh.id,v.id ORDER BY ${orderBy} LIMIT $${limit} OFFSET $${offset}`,values); res.json({ items: result.rows,page,pageSize });
}));
lotsRouter.get('/:id', asyncHandler(async (req, res) => {
  const lot = await loadLot(param(req.params.id)); await assertSchoolAccess(req.user!, lot.school_id, ['COORDINATOR','PARENT']); const versionId = req.user!.role === 'PARENT' ? lot.current_published_version_id : lot.latest_version_id; if (!versionId) throw new AppError(404,'LOT_NOT_PUBLISHED','No hay una versiÃ³n publicada');
  const [version,media] = await Promise.all([query('SELECT * FROM lot_versions WHERE id=$1',[versionId]),query('SELECT id,kind,status,original_name,mime_type,size_bytes,width,height,duration_seconds,sort_order,created_at,purge_after FROM media_assets WHERE lot_version_id=$1 AND status <> \'UPLOADING\' AND ($2 <> \'PARENT\' OR status=\'APPROVED\') ORDER BY sort_order,created_at',[versionId,req.user!.role])]); res.json({ lot,version:version.rows[0],media:media.rows });
}));
lotsRouter.post('/', requireRoles('ADMIN','COORDINATOR'), asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body); await assertSchoolAccess(req.user!,input.schoolId,['COORDINATOR']);
  const enabledQueries = [];
  if (input.activityId) enabledQueries.push(query('SELECT 1 FROM school_activities WHERE school_id=$1 AND activity_id=$2 AND enabled',[input.schoolId,input.activityId]));
  if (input.shiftId) enabledQueries.push(query('SELECT 1 FROM school_shifts WHERE school_id=$1 AND shift_id=$2 AND enabled',[input.schoolId,input.shiftId]));
  const results = await Promise.all(enabledQueries);
  if (results.some(r => r.rowCount === 0)) throw new AppError(400,'CATALOG_DISABLED','La actividad o el turno no están habilitados para este colegio');
  const response = await transaction(async client => { const existing = await client.query<{ id:string }>('SELECT id FROM lots WHERE school_id=$1 AND (activity_id=$2 OR ($2 IS NULL AND activity_id IS NULL)) AND (shift_id=$3 OR ($3 IS NULL AND shift_id IS NULL)) AND event_date=$4 FOR UPDATE',[input.schoolId,input.activityId || null,input.shiftId || null,input.eventDate]); if (existing.rowCount) { const version = await client.query<{id:string;status:string}>('SELECT id,status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1',[existing.rows[0].id]); if (version.rows[0] && ['DRAFT','UPLOADING'].includes(version.rows[0].status)) return { lotId:existing.rows[0].id,versionId:version.rows[0].id,existing:true }; throw new AppError(409,'LOT_PUBLISHED','El lote ya fue publicado; un administrador debe reabrirlo'); } const lot = await client.query<{id:string}>('INSERT INTO lots (school_id,activity_id,shift_id,event_date,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',[input.schoolId,input.activityId || null,input.shiftId || null,input.eventDate,req.user!.id]); const version = await client.query<{id:string}>('INSERT INTO lot_versions (lot_id,version_number,created_by) VALUES ($1,1,$2) RETURNING id',[lot.rows[0].id,req.user!.id]); return { lotId:lot.rows[0].id,versionId:version.rows[0].id,existing:false }; }); res.status(response.existing?200:201).json(response);
}));
lotsRouter.post('/:id/reopen', requireRoles('ADMIN'), asyncHandler(async (req,res) => { const lot = await loadLot(param(req.params.id)); const created = await transaction(async client => { const prior = await client.query<{version_number:number}>('SELECT version_number FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1 FOR UPDATE',[lot.id]); return client.query('INSERT INTO lot_versions (lot_id,version_number,created_by,source) VALUES ($1,$2,$3,\'PORTAL\') RETURNING *',[lot.id,(prior.rows[0]?.version_number ?? 0)+1,req.user!.id]); }); res.status(201).json(created.rows[0]); }));
lotsRouter.post('/:id/media', requireRoles('ADMIN','COORDINATOR'), upload.single('file'), asyncHandler(async (req,res) => {
  const file = req.file; if (!file) throw new AppError(400,'FILE_REQUIRED','SeleccionÃ¡ un archivo');
  try { const lot = await loadLot(param(req.params.id)); await assertSchoolAccess(req.user!,lot.school_id,['COORDINATOR']); const version = await editableVersion(lot.id); const detected = await fileTypeFromFile(file.path); const mimeType = detected?.mime ?? file.mimetype; const kind = accepted.get(mimeType); if (!kind) throw new AppError(400,'UNSUPPORTED_MEDIA','Se permiten JPEG, PNG, HEIC, MP4 y MOV'); const checksum = crypto.createHash('sha256').update(await fs.readFile(file.path)).digest('hex'); const asset = await query<{id:string}>('INSERT INTO media_assets (lot_version_id,kind,original_name,mime_type,size_bytes,sha256,uploaded_by,status,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,\'UPLOADING\',(SELECT count(*) FROM media_assets WHERE lot_version_id=$1)) RETURNING id',[version.id,kind,file.originalname,mimeType,file.size,checksum,req.user!.id]); const folder = await getStorage().createVersionFolder({schoolCode:lot.school_code,eventDate:lot.event_date,shiftCode:lot.shift_code,activityCode:lot.activity_code,lotId:lot.id,version:version.version_number}); const driveFileId = await getStorage().uploadOriginal({path:file.path,filename:file.originalname,mimeType,parentId:folder}); await query('UPDATE lot_versions SET status=\'UPLOADING\',drive_folder_id=$1 WHERE id=$2',[folder,version.id]); await query('UPDATE media_assets SET drive_file_id=$1,status=\'READY\' WHERE id=$2',[driveFileId,asset.rows[0].id]); res.status(201).json({id:asset.rows[0].id,kind,status:'READY'}); } finally { await fs.rm(file.path,{force:true}).catch(()=>undefined); }
}));
lotsRouter.post('/:id/submit', requireRoles('ADMIN','COORDINATOR'), asyncHandler(async (req,res) => { const lot = await loadLot(param(req.params.id)); await assertSchoolAccess(req.user!,lot.school_id,['COORDINATOR']); const version=await editableVersion(lot.id); const files=await query('SELECT 1 FROM media_assets WHERE lot_version_id=$1 AND status=\'READY\' LIMIT 1',[version.id]); if(!files.rowCount) throw new AppError(400,'EMPTY_LOT','El lote no tiene archivos listos'); await query('UPDATE lot_versions SET status=\'PENDING\',submitted_at=now() WHERE id=$1',[version.id]); res.status(204).end(); }));
lotsRouter.post('/:id/approve', requireRoles('ADMIN'), asyncHandler(async (req,res) => { const lot=await loadLot(param(req.params.id)); const version=await query<{id:string;status:string}>('SELECT id,status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1',[lot.id]); if(!version.rows[0] || version.rows[0].status !== 'PENDING') throw new AppError(409,'LOT_NOT_PENDING','El lote no estÃ¡ pendiente de moderaciÃ³n'); const ready=await query('SELECT 1 FROM media_assets WHERE lot_version_id=$1 AND status=\'READY\' LIMIT 1',[version.rows[0].id]); if(!ready.rowCount) throw new AppError(400,'EMPTY_LOT','No hay archivos vÃ¡lidos para publicar'); await transaction(async client=>{await client.query('UPDATE media_assets SET status=\'APPROVED\',moderated_by=$1,moderated_at=now() WHERE lot_version_id=$2 AND status=\'READY\'',[req.user!.id,version.rows[0].id]);await client.query('UPDATE lot_versions SET status=\'PUBLISHED\',reviewed_by=$1,reviewed_at=now() WHERE id=$2',[req.user!.id,version.rows[0].id]);await client.query('UPDATE lots SET current_published_version_id=$1 WHERE id=$2',[version.rows[0].id,lot.id]);});res.status(204).end(); }));
lotsRouter.patch('/media/:mediaId/moderation', requireRoles('ADMIN'), asyncHandler(async(req,res)=>{const input=moderationSchema.parse(req.body);const status=input.action==='reject'?'REJECTED':'READY';const result=await query(`UPDATE media_assets m SET status=CASE WHEN $1::media_status='REJECTED'::media_status THEN 'REJECTED'::media_status WHEN EXISTS (SELECT 1 FROM lot_versions v WHERE v.id=m.lot_version_id AND v.status='PUBLISHED') THEN 'APPROVED'::media_status ELSE 'READY'::media_status END,moderated_by=$2,moderated_at=now(),purge_after=CASE WHEN $1::media_status='REJECTED'::media_status THEN now()+interval '30 days' ELSE NULL END WHERE m.id=$3 RETURNING id,status`,[status,req.user!.id,param(req.params.mediaId)]);if(!result.rowCount)throw new AppError(404,'MEDIA_NOT_FOUND','Archivo no encontrado');res.status(204).end();}));











