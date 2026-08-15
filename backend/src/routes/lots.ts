import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { Router } from 'express';
import { z } from 'zod';
import { fileTypeFromFile } from 'file-type';
import type { PoolClient } from 'pg';
import { assertDepartureAccess, requireRoles, requirePermission } from '../auth.js';
import { config, paths } from '../config.js';
import { query, transaction } from '../db.js';
import { AppError } from '../errors.js';
import { asyncHandler, parsePagination } from '../http.js';
import { getStorage } from '../storage.js';
import { createThumbnail, processLocalMedia, queueVideoProcessing } from '../media-processing.js';

const destination = async (done: (error: Error | null, destination: string) => void) => { try { await fs.mkdir(paths.uploads, { recursive: true }); done(null, paths.uploads); } catch (error) { done(error as Error, paths.uploads); } };
const disk = multer.diskStorage({ destination: (_req, _file, done) => { void destination(done); }, filename: (_req, file, done) => done(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`) });
// Multer debe admitir el máximo de ambos tipos; el límite específico se valida
// luego de detectar el formato real del archivo.
const upload = multer({ storage: disk, limits: { fileSize: Math.max(config.MAX_FILE_SIZE_MB, config.MAX_VIDEO_FILE_SIZE_MB) * 1024 * 1024, files: 1 } });
const albumNameSchema = z.string().trim().min(1).max(160);
const createSchema = z.object({ departureId: z.string().uuid(), activityId: z.string().uuid().optional().nullable(), eventDate: z.string().date(), albumName: albumNameSchema.optional() });
const updateSchema = z.object({ albumName: albumNameSchema.optional(), departureId: z.string().uuid().optional(), activityId: z.string().uuid().optional().nullable(), eventDate: z.string().date().optional() });
const moderationSchema = z.object({ action: z.enum(['reject', 'restore']) });
// Se valida por la firma real del archivo (file-type), no por su extensión.
const accepted = new Map<string, 'IMAGE' | 'VIDEO'>([
  ['image/jpeg','IMAGE'], ['image/png','IMAGE'], ['image/heic','IMAGE'], ['image/heif','IMAGE'],
  ['image/x-adobe-dng','IMAGE'], ['image/tiff','IMAGE'], ['image/gif','IMAGE'], ['image/webp','IMAGE'], ['image/avif','IMAGE'],
  ['video/mp4','VIDEO'], ['video/quicktime','VIDEO'], ['video/x-m4v','VIDEO'], ['video/webm','VIDEO'],
  ['video/avi','VIDEO'], ['video/x-msvideo','VIDEO'], ['video/3gpp','VIDEO'], ['video/x-matroska','VIDEO'],
]);
const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
async function retryStorage<T>(operation: () => Promise<T>): Promise<T> {
  let failure: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      failure = error;
      if (error instanceof AppError && error.status < 500) throw error;
      if (attempt < 2) await delay(1000 * 2 ** attempt);
    }
  }
  console.error('Media storage failed after retries', failure);
  throw new AppError(503, 'MEDIA_STORAGE_UNAVAILABLE', 'El almacenamiento está temporalmente ocupado. Intentá subir este archivo nuevamente.');
}

export type Lot = { id: string; departure_id: string; event_date: string; title: string | null; album_name: string; departure_name: string; departure_destination: string; departure_type: 'MICRO'|'AEREO'; departure_public_code: string | null; shift_code: string | null; activity_code: string | null; activity_name: string | null; latest_version_id: string | null; latest_status: string | null; current_published_version_id: string | null; created_by_name: string | null; created_by_id: string | null; };
const driveFolderName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120);
const departureFolder = (lot: Lot) => driveFolderName(`${lot.departure_public_code ?? lot.departure_type} - ${lot.departure_name}${lot.departure_destination ? ` - ${lot.departure_destination}` : ''}`) || lot.departure_id;
const lotFolder = (lot: Lot) => driveFolderName(`${lot.event_date} - ${lot.album_name} - ${lot.id.slice(0,8)}`);
export async function loadLot(id: string) {
  const result = await query<Lot>(`SELECT l.id,l.departure_id,l.event_date::text,l.title,COALESCE(NULLIF(l.title,''),a.name,'General') album_name,d.name departure_name,d.destination departure_destination,d.type departure_type,d.public_code departure_public_code,
    sh.bot_code shift_code,a.bot_code activity_code,a.name activity_name,l.current_published_version_id,
    (SELECT id FROM lot_versions WHERE lot_id=l.id ORDER BY version_number DESC LIMIT 1) latest_version_id,
    (SELECT status FROM lot_versions WHERE lot_id=l.id ORDER BY version_number DESC LIMIT 1) latest_status,
    u.name created_by_name,l.created_by created_by_id
    FROM lots l JOIN departures d ON d.id=l.departure_id LEFT JOIN activities a ON a.id=l.activity_id LEFT JOIN shifts sh ON sh.id=l.shift_id LEFT JOIN users u ON u.id=l.created_by WHERE l.id=$1 AND l.deleted_at IS NULL`, [id]);
  if (!result.rowCount) throw new AppError(404, 'LOT_NOT_FOUND', 'Lote no encontrado'); return result.rows[0];
}
async function editableVersion(lotId: string) {
  const result = await query<{ id: string; version_number: number; status: string }>('SELECT id,version_number,status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1', [lotId]);
  const version = result.rows[0]; if (!version || !['DRAFT','UPLOADING'].includes(version.status)) throw new AppError(409, 'LOT_NOT_EDITABLE', 'El lote debe reabrirse antes de cargar más archivos'); return version;
}
async function uploadableVersion(lotId: string) {
  const result = await query<{ id: string; version_number: number; status: string }>('SELECT id,version_number,status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1', [lotId]);
  const version = result.rows[0];
  if (!version || !['DRAFT','UPLOADING','PENDING'].includes(version.status)) throw new AppError(409, 'LOT_NOT_EDITABLE', 'El lote ya no admite más archivos');
  return version;
}
async function assertDepartureActive(id: string) { const result=await query('SELECT 1 FROM departures WHERE id=$1 AND active', [id]); if(!result.rowCount) throw new AppError(409,'DEPARTURE_ARCHIVED','La salida est? archivada o no existe'); }

type SubmissionState = { total: number; ready: number; uploading: number; errors: number; blocked_names: string[] };
async function submissionState(client: PoolClient, versionId: string): Promise<SubmissionState> {
  const result = await client.query<SubmissionState>(`SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE status='READY')::int AS ready,
    count(*) FILTER (WHERE status='UPLOADING')::int AS uploading,
    count(*) FILTER (WHERE status='ERROR')::int AS errors,
    COALESCE(array_agg(original_name ORDER BY created_at) FILTER (WHERE status IN ('UPLOADING','ERROR')), ARRAY[]::varchar[]) AS blocked_names
    FROM media_assets WHERE lot_version_id=$1`, [versionId]);
  return result.rows[0];
}

async function submitVersion(client: PoolClient, versionId: string, actorId: string, source: 'REQUESTED'|'AUTO'): Promise<SubmissionState> {
  const version = await client.query<{ status: string; submitted_at: Date | null }>('SELECT status,submitted_at FROM lot_versions WHERE id=$1 FOR UPDATE', [versionId]);
  if (!version.rowCount) throw new AppError(404, 'LOT_VERSION_NOT_FOUND', 'Versión de lote no encontrada');
  if (version.rows[0].status === 'PENDING') return submissionState(client, versionId);
  const state = await submissionState(client, versionId);
  if (!state.total) throw new AppError(400, 'EMPTY_LOT', 'El lote no tiene archivos');
  if (source === 'REQUESTED') await client.query('UPDATE lot_versions SET submitted_at=now(),updated_at=now() WHERE id=$1', [versionId]);
  if (state.uploading || state.errors) return state;
  if (!state.ready) throw new AppError(400, 'EMPTY_LOT', 'El lote no tiene archivos listos');
  if (source === 'AUTO' && !version.rows[0].submitted_at) return state;
  await client.query(`UPDATE lot_versions SET status='PENDING',submitted_at=COALESCE(submitted_at,now()),updated_at=now() WHERE id=$1`, [versionId]);
  await client.query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,\'lot_version\',$3,$4)', [actorId, source === 'AUTO' ? 'LOT_SUBMISSION_AUTO_COMPLETED' : 'LOT_SUBMITTED_FOR_MODERATION', versionId, JSON.stringify({ ...state, source })]);
  return state;
}

function blockedSubmissionError(state: SubmissionState) {
  const labels = state.blocked_names.slice(0, 5).join(', ');
  const more = state.blocked_names.length > 5 ? ` y ${state.blocked_names.length - 5} más` : '';
  const details = [state.uploading ? `${state.uploading} cargando` : '', state.errors ? `${state.errors} con error` : ''].filter(Boolean).join(' y ');
  return new AppError(409, 'LOT_SUBMISSION_BLOCKED', `El lote no puede enviarse a moderación: hay ${details}${labels ? ` (${labels}${more})` : ''}.`);
}

export const lotsRouter = Router();
lotsRouter.get('/my-schools', asyncHandler(async (req, res) => {
  if (req.user!.role === 'ADMIN') { const all = await query('SELECT id,name,code,bot_code FROM schools WHERE active AND deleted_at IS NULL ORDER BY name'); return res.json({ items: all.rows }); }
  const result = await query('SELECT s.id,s.name,s.code,s.bot_code FROM schools s JOIN user_schools us ON us.school_id=s.id WHERE us.user_id=$1 AND us.membership_role=$2 AND us.active AND s.active AND s.deleted_at IS NULL ORDER BY s.name',[req.user!.id,req.user!.role]); res.json({ items: result.rows });
}));
lotsRouter.get('/my-departures', asyncHandler(async (req,res) => {
  const where=req.user!.role==='ADMIN'?'':'WHERE dc.user_id=$1';
  const values=req.user!.role==='ADMIN'?[]:[req.user!.id];
  const result=await query(`SELECT d.id,d.type,d.name,d.destination,d.event_date::text,d.start_date::text,d.end_date::text,d.active,
    COALESCE(array_agg(s.name) FILTER (WHERE s.id IS NOT NULL),ARRAY[]::text[]) school_names
    FROM departures d LEFT JOIN departure_coordinators dc ON dc.departure_id=d.id LEFT JOIN departure_schools ds ON ds.departure_id=d.id LEFT JOIN schools s ON s.id=ds.school_id
    ${where} GROUP BY d.id ORDER BY d.active DESC,d.start_date DESC,d.name`,values);
  res.json({items:result.rows});
}));
lotsRouter.get('/catalogs', asyncHandler(async (_req,res) => {
  const activities=await query('SELECT id,name,bot_code FROM activities WHERE active ORDER BY name');
  res.json({activities:activities.rows,shifts:[]});
}));
lotsRouter.get('/', requirePermission('lots','view'), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query); const values: unknown[]=[]; let where='WHERE l.deleted_at IS NULL';
  if(req.user!.role==='COORDINATOR'){values.push(req.user!.id);where+=` AND EXISTS (SELECT 1 FROM departure_coordinators dc WHERE dc.departure_id=l.departure_id AND dc.user_id=$${values.length})`;}
  if(req.user!.role==='PARENT'){values.push(req.user!.id);where+=` AND EXISTS (SELECT 1 FROM departure_schools ds JOIN user_schools us ON us.school_id=ds.school_id WHERE ds.departure_id=l.departure_id AND us.user_id=$${values.length} AND us.membership_role='PARENT' AND us.active) AND l.current_published_version_id IS NOT NULL`;}
  if(req.query.status && req.user!.role!=='PARENT'){values.push(z.enum(['DRAFT','UPLOADING','PENDING','PUBLISHED','REJECTED','ERROR']).parse(req.query.status));where+=` AND v.status=$${values.length}`;}
  const visible=req.user!.role==='PARENT'?'l.current_published_version_id':'(SELECT id FROM lot_versions WHERE lot_id=l.id ORDER BY version_number DESC LIMIT 1)';
  const orderBy=req.query.status==='PENDING'?'COALESCE(v.submitted_at,v.created_at) ASC':'l.event_date DESC,v.created_at DESC';
  values.push(pageSize,(page-1)*pageSize); const limit=values.length-1,offset=values.length;
  const result=await query(`SELECT l.id,l.event_date,l.activity_id,d.id departure_id,d.name departure_name,d.destination departure_destination,d.type departure_type,d.public_code departure_public_code,
    d.name school_name,NULL::uuid school_id,COALESCE(a.name,'General') activity_name,COALESCE(NULLIF(l.title,''),a.name,'General') album_name,''::text shift_name,
    v.id version_id,v.version_number,v.status,v.submitted_at,v.created_at version_created_at,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status <> 'UPLOADING')::int approved_count,
    COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL),ARRAY[]::text[]) school_names,
    u.name created_by_name,l.created_by created_by_id
    FROM lots l JOIN departures d ON d.id=l.departure_id LEFT JOIN activities a ON a.id=l.activity_id
    JOIN lot_versions v ON v.id=${visible} LEFT JOIN media_assets m ON m.lot_version_id=v.id
    LEFT JOIN departure_schools ds ON ds.departure_id=d.id LEFT JOIN schools s ON s.id=ds.school_id
    LEFT JOIN users u ON u.id=l.created_by
    ${where} GROUP BY l.id,l.activity_id,d.id,a.id,v.id,u.id ORDER BY ${orderBy} LIMIT $${limit} OFFSET $${offset}`,values);
  res.json({items:result.rows,page,pageSize});
}));
lotsRouter.get('/:id', requirePermission('lots','view'), asyncHandler(async(req,res)=>{
  const lot=await loadLot(param(req.params.id)); await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR','PARENT']);
  const versionId=req.user!.role==='PARENT'?lot.current_published_version_id:lot.latest_version_id; if(!versionId) throw new AppError(404,'LOT_NOT_PUBLISHED','No hay una versión publicada');
  const [version,media]=await Promise.all([query('SELECT * FROM lot_versions WHERE id=$1',[versionId]),query(`SELECT m.id,m.kind,m.status,m.original_name,COALESCE(m.delivery_mime_type,m.mime_type) mime_type,COALESCE(m.delivery_size_bytes,m.size_bytes) size_bytes,m.width,m.height,m.duration_seconds,m.sort_order,m.created_at,m.created_at AS uploaded_at,m.purge_after,m.watermark_status,m.watermark_error,u.name AS uploaded_by_name FROM media_assets m LEFT JOIN users u ON u.id=m.uploaded_by WHERE m.lot_version_id=$1 AND m.status <> 'UPLOADING' AND ($2 <> 'PARENT' OR m.status='APPROVED') ORDER BY m.sort_order,m.created_at`,[versionId,req.user!.role])]);
  res.json({lot,version:version.rows[0],media:media.rows});
}));
lotsRouter.post('/',requireRoles('ADMIN','COORDINATOR'),requirePermission('lots','create'),asyncHandler(async(req,res)=>{
  const input=createSchema.parse(req.body); await assertDepartureAccess(req.user!,input.departureId,['COORDINATOR']); await assertDepartureActive(input.departureId);
  const response=await transaction(async client=>{const activity= input.activityId ? await client.query<{name:string}>('SELECT name FROM activities WHERE id=$1',[input.activityId]) : {rows:[] as {name:string}[]};const albumTitle=(input.albumName?.trim()||activity.rows[0]?.name||'General').trim();const existing=await client.query<{id:string}>('SELECT l.id FROM lots l WHERE l.departure_id=$1 AND (l.activity_id=$2 OR ($2 IS NULL AND l.activity_id IS NULL)) AND lower(trim(COALESCE(l.title,(SELECT name FROM activities WHERE id=l.activity_id),\'General\'))) = lower(trim($3)) AND l.deleted_at IS NULL ORDER BY l.event_date DESC,l.created_at DESC LIMIT 1 FOR UPDATE',[input.departureId,input.activityId??null,albumTitle]);
    if(existing.rowCount){const version=await client.query<{id:string;status:string;version_number:number}>('SELECT id,status,version_number FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1',[existing.rows[0].id]);const latest=version.rows[0];if(latest&&['DRAFT','UPLOADING','PENDING'].includes(latest.status)){await client.query('UPDATE lots SET event_date=$1,title=$2,updated_at=now() WHERE id=$3',[input.eventDate,albumTitle,existing.rows[0].id]);return{lotId:existing.rows[0].id,versionId:latest.id,existing:true};}
      const next=await client.query<{id:string}>('INSERT INTO lot_versions(lot_id,version_number,created_by,source) VALUES($1,$2,$3,\'PORTAL\') RETURNING id',[existing.rows[0].id,(latest?.version_number??0)+1,req.user!.id]);await client.query('UPDATE lots SET event_date=$1,title=$2,updated_at=now() WHERE id=$3',[input.eventDate,albumTitle,existing.rows[0].id]);return{lotId:existing.rows[0].id,versionId:next.rows[0].id,existing:true};}
    const lot=await client.query<{id:string}>('INSERT INTO lots(departure_id,activity_id,shift_id,event_date,created_by,title) VALUES($1,$2,NULL,$3,$4,$5) RETURNING id',[input.departureId,input.activityId??null,input.eventDate,req.user!.id,albumTitle]);const version=await client.query<{id:string}>('INSERT INTO lot_versions(lot_id,version_number,created_by) VALUES($1,1,$2) RETURNING id',[lot.rows[0].id,req.user!.id]);return{lotId:lot.rows[0].id,versionId:version.rows[0].id,existing:false};});
  res.status(response.existing?200:201).json(response);
}));
lotsRouter.patch('/:id',requireRoles('ADMIN','COORDINATOR'),requirePermission('lots','edit'),asyncHandler(async(req,res)=>{
  const input=updateSchema.parse(req.body);const lot=await loadLot(param(req.params.id));
  if(req.user!.role==='COORDINATOR'){
    await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR']);
    const version=await query<{status:string}>('SELECT status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1',[lot.id]);
    if(version.rows[0]&&!['DRAFT','UPLOADING'].includes(version.rows[0].status))throw new AppError(403,'LOT_NOT_EDITABLE','Solo se pueden editar lotes que aún no fueron publicados');
  }
  await transaction(async client=>{
    if(input.albumName!==undefined) await client.query('UPDATE lots SET title=$1,updated_at=now() WHERE id=$2',[input.albumName,lot.id]);
    if(input.departureId!==undefined && req.user!.role==='ADMIN') await client.query('UPDATE lots SET departure_id=$1,updated_at=now() WHERE id=$2',[input.departureId,lot.id]);
    if(input.activityId!==undefined && req.user!.role==='ADMIN') await client.query('UPDATE lots SET activity_id=$1,updated_at=now() WHERE id=$2',[input.activityId||null,lot.id]);
    if(input.eventDate!==undefined && req.user!.role==='ADMIN') await client.query('UPDATE lots SET event_date=$1,updated_at=now() WHERE id=$2',[input.eventDate,lot.id]);
  });
  await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'LOT_UPDATED','lot',lot.id,JSON.stringify(input)]);
  res.json({success:true});
}));
lotsRouter.delete('/:id',requireRoles('ADMIN','COORDINATOR'),requirePermission('lots','delete'),asyncHandler(async(req,res)=>{
  const lot=await loadLot(param(req.params.id));
  await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR']);
  if(req.user!.role==='COORDINATOR'){
    const version=await query<{status:string}>('SELECT status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1',[lot.id]);
    if(version.rows[0]&&!['DRAFT','UPLOADING'].includes(version.rows[0].status))throw new AppError(403,'LOT_NOT_DELETABLE','Solo se pueden eliminar lotes que aún no fueron publicados');
  }
  await transaction(async client=>{
    await client.query('UPDATE lots SET deleted_at=now(),deleted_by=$1,current_published_version_id=NULL,updated_at=now() WHERE id=$2 AND deleted_at IS NULL',[req.user!.id,lot.id]);
    await client.query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'LOT_DELETED','lot',lot.id,JSON.stringify({albumName:lot.album_name,departureId:lot.departure_id})]);
  });
  res.status(204).end();
}));
lotsRouter.get('/:id/processing',requireRoles('ADMIN','COORDINATOR'),requirePermission('lots','view'),asyncHandler(async(req,res)=>{res.json({items:[]});}));
lotsRouter.post('/:id/media/:mediaId/watermark/retry',requireRoles('ADMIN','COORDINATOR'),requirePermission('lots','edit'),asyncHandler(async(req,res)=>{const lot=await loadLot(param(req.params.id));await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR']);const media=await query<{id:string}>('SELECT m.id FROM media_assets m JOIN lot_versions v ON v.id=m.lot_version_id WHERE m.id=$1 AND v.lot_id=$2 AND m.kind=\'VIDEO\' AND m.drive_file_id IS NOT NULL',[param(req.params.mediaId),lot.id]);if(!media.rowCount)throw new AppError(404,'VIDEO_NOT_FOUND','Video original no encontrado');await transaction(async client=>{await client.query(`UPDATE media_assets SET watermark_status='QUEUED',watermark_error=NULL,updated_at=now() WHERE id=$1`,[media.rows[0].id]);await client.query(`INSERT INTO media_watermark_jobs(media_asset_id,status,attempts,available_at,error,updated_at) VALUES($1,'QUEUED',0,now(),NULL,now()) ON CONFLICT(media_asset_id) DO UPDATE SET status='QUEUED',attempts=0,available_at=now(),error=NULL,updated_at=now()`,[media.rows[0].id]);});queueVideoProcessing();res.status(204).end();}));
lotsRouter.post('/:id/media',requireRoles('ADMIN','COORDINATOR'),requirePermission('lots','create'),upload.single('file'),asyncHandler(async(req,res)=>{
  const file=req.file;
  if(!file)throw new AppError(400,'FILE_REQUIRED','Selecciona un archivo');
  let renderedPath = '';
  let thumbnailPath = '';
  try{
    const lot=await loadLot(param(req.params.id));
    await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR']);
    await assertDepartureActive(lot.departure_id);
    const version=await uploadableVersion(lot.id);
    const detected=await fileTypeFromFile(file.path);
    const mimeType=detected?.mime??file.mimetype;
    const kind=accepted.get(mimeType);
    if(!kind)throw new AppError(400,'UNSUPPORTED_MEDIA','Formato no compatible. Se permiten JPG/JFIF, PNG, HEIC/HEIF, ProRAW (DNG), TIFF, GIF, WebP, AVIF, MP4, MOV, M4V, WebM, AVI, 3GP y MKV.');
    const maxSizeMb=kind==='VIDEO'?config.MAX_VIDEO_FILE_SIZE_MB:config.MAX_FILE_SIZE_MB;
    if(file.size>maxSizeMb*1024*1024)throw new AppError(413,'FILE_TOO_LARGE',`El ${kind==='VIDEO'?'video':'archivo'} supera el límite de ${maxSizeMb} MB.`);
    const checksum=crypto.createHash('sha256').update(await fs.readFile(file.path)).digest('hex');
    if (kind === 'VIDEO') {
      const storage=getStorage();
      const originals=await retryStorage(()=>storage.createVersionFolder({departureFolder:departureFolder(lot),lotFolder:lotFolder(lot),version:version.version_number},'originales'));
      const originalId=await retryStorage(()=>storage.uploadOriginal({path:file.path,filename:file.originalname,mimeType,parentId:originals}));
      const asset=await transaction(async client=>{
        const locked=await client.query<{id:string;status:string}>('SELECT id,status FROM lot_versions WHERE id=$1 AND lot_id=$2 FOR UPDATE',[version.id,lot.id]);
        const current=locked.rows[0];
        if(!current || !['DRAFT','UPLOADING','PENDING'].includes(current.status)) throw new AppError(409,'LOT_NOT_EDITABLE','El lote cambió de estado antes de finalizar la carga');
        const created=await client.query<{id:string}>(`INSERT INTO media_assets(lot_version_id,kind,original_name,mime_type,size_bytes,sha256,uploaded_by,status,watermark_status,sort_order,drive_file_id)
          VALUES($1,'VIDEO',$2,$3,$4,$5,$6,'READY','QUEUED',(SELECT count(*) FROM media_assets WHERE lot_version_id=$1),$7) RETURNING id`,[version.id,file.originalname,mimeType,file.size,checksum,req.user!.id,originalId]);
        await client.query(`INSERT INTO media_watermark_jobs(media_asset_id,status,available_at) VALUES($1,'QUEUED',now()) ON CONFLICT(media_asset_id) DO UPDATE SET status='QUEUED',available_at=now(),error=NULL,updated_at=now()`,[created.rows[0].id]);
        await client.query(`UPDATE lot_versions SET status=CASE WHEN status='DRAFT' THEN 'UPLOADING'::lot_version_status ELSE status END,drive_folder_id=$1 WHERE id=$2`,[originals,version.id]);
        await submitVersion(client, version.id, req.user!.id, 'AUTO');
        await client.query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'VIDEO_UPLOADED_ORIGINAL','media_asset',created.rows[0].id,JSON.stringify({lotId:lot.id,lotVersionId:version.id,originalName:file.originalname,sizeBytes:file.size})]);
        return created.rows[0];
      });
      queueVideoProcessing();
      res.status(202).json({id:asset.id,kind,status:'READY'});
      return;
    }
    console.time(`Upload and process ${file.originalname}`);
    let rendered;
    try { rendered = await processLocalMedia(file.path, kind, file.originalname, mimeType); }
    catch (error) {
      console.error('Media processing failed', { name: file.originalname, mimeType, error });
      const failedAsset=await transaction(async client=>{const locked=await client.query<{id:string;status:string}>('SELECT id,status FROM lot_versions WHERE id=$1 AND lot_id=$2 FOR UPDATE',[version.id,lot.id]);const current=locked.rows[0];if(!current||!['DRAFT','UPLOADING','PENDING'].includes(current.status))throw new AppError(409,'LOT_NOT_EDITABLE','El lote cambió de estado antes de finalizar la carga');const created=await client.query<{id:string}>(`INSERT INTO media_assets(lot_version_id,kind,original_name,mime_type,size_bytes,sha256,uploaded_by,status,watermark_status,watermark_error,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,'ERROR','ERROR',$8,(SELECT count(*) FROM media_assets WHERE lot_version_id=$1)) RETURNING id`,[version.id,kind,file.originalname,mimeType,file.size,checksum,req.user!.id,error instanceof Error?error.message.slice(0,1000):'Error de procesamiento']);await client.query(`UPDATE lot_versions SET status=CASE WHEN status='DRAFT' THEN 'UPLOADING'::lot_version_status ELSE status END WHERE id=$1`,[version.id]);await client.query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'MEDIA_PROCESSING_FAILED','media_asset',created.rows[0].id,JSON.stringify({lotId:lot.id,lotVersionId:version.id,originalName:file.originalname,kind,sizeBytes:file.size})]);return created.rows[0];});res.status(202).json({id:failedAsset.id,kind,status:'ERROR'});return;
    }
    renderedPath = rendered.path;
    const stat=await fs.stat(rendered.path);
    const storage=getStorage();
    const folder=await retryStorage(()=>storage.createVersionFolder({departureFolder:departureFolder(lot),lotFolder:lotFolder(lot),version:version.version_number},'marcados'));
    const driveFileId=await retryStorage(()=>storage.uploadOriginal({path:rendered.path,filename:rendered.name,mimeType:rendered.mimeType,parentId:folder}));
    const thumbnail=await createThumbnail(rendered.path,kind,rendered.name);
    thumbnailPath=thumbnail?.path??'';
    const thumbnailId=thumbnail?await retryStorage(()=>storage.uploadOriginal({path:thumbnail.path,filename:thumbnail.name,mimeType:thumbnail.mimeType,parentId:folder})):null;
    const thumbnailSize=thumbnail?await fs.stat(thumbnail.path):null;
    const asset=await transaction(async client=>{
      const locked=await client.query<{id:string;status:string}>('SELECT id,status FROM lot_versions WHERE id=$1 AND lot_id=$2 FOR UPDATE',[version.id,lot.id]);
      const current=locked.rows[0];
      if(!current || !['DRAFT','UPLOADING','PENDING'].includes(current.status)) throw new AppError(409,'LOT_NOT_EDITABLE','El lote cambió de estado antes de finalizar la carga');
      const created=await client.query<{id:string}>(`INSERT INTO media_assets(lot_version_id,kind,original_name,mime_type,delivery_mime_type,size_bytes,delivery_size_bytes,delivery_name,sha256,uploaded_by,status,watermark_status,sort_order,drive_file_id,delivery_drive_file_id,thumbnail_drive_file_id,thumbnail_mime_type,thumbnail_size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'READY','READY',(SELECT count(*) FROM media_assets WHERE lot_version_id=$1),$11,$11,$12,$13,$14) RETURNING id`,[version.id,kind,file.originalname,mimeType,rendered.mimeType,file.size,stat.size,rendered.name,checksum,req.user!.id,driveFileId,thumbnailId,thumbnail?.mimeType??null,thumbnailSize?.size??null]);
      await client.query(`UPDATE lot_versions SET status=CASE WHEN status='DRAFT' THEN 'UPLOADING'::lot_version_status ELSE status END,drive_folder_id=$1 WHERE id=$2`,[folder,version.id]);
      await submitVersion(client, version.id, req.user!.id, 'AUTO');
      await client.query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',[req.user!.id,'MEDIA_UPLOADED','media_asset',created.rows[0].id,JSON.stringify({lotId:lot.id,lotVersionId:version.id,originalName:file.originalname,kind,sizeBytes:file.size,addedWhilePending:current.status==='PENDING'})]);
      return created.rows[0];
    });
    console.timeEnd(`Upload and process ${file.originalname}`);
    res.status(202).json({id:asset.id,kind,status:'READY'});
  }finally{
    await fs.rm(file.path,{force:true}).catch(()=>undefined);
    if(renderedPath) await fs.rm(renderedPath,{force:true}).catch(()=>undefined);
    if(thumbnailPath) await fs.rm(thumbnailPath,{force:true}).catch(()=>undefined);
  }
}));
lotsRouter.post('/:id/submit',requireRoles('ADMIN','COORDINATOR'),requirePermission('lots','edit'),asyncHandler(async(req,res)=>{const lot=await loadLot(param(req.params.id));await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR']);if(lot.latest_status==='PENDING')return res.status(204).end();const version=await editableVersion(lot.id);const state=await transaction(client=>submitVersion(client,version.id,req.user!.id,'REQUESTED'));if(state.uploading||state.errors){await query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,\'LOT_SUBMISSION_BLOCKED\',\'lot_version\',$2,$3)',[req.user!.id,version.id,JSON.stringify(state)]);throw blockedSubmissionError(state);}res.status(204).end();}));
lotsRouter.post('/:id/approve',requireRoles('ADMIN','COORDINATOR'),requirePermission('moderation','edit'),asyncHandler(async(req,res)=>{const lot=await loadLot(param(req.params.id));if(req.user!.role==='COORDINATOR') await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR']);await transaction(async client=>{const version=await client.query<{id:string;status:string}>('SELECT id,status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1 FOR UPDATE',[lot.id]);if(!version.rows[0]||version.rows[0].status!=='PENDING')throw new AppError(409,'LOT_NOT_PENDING','El lote no está pendiente de moderación');const ready=await client.query(`SELECT 1 FROM media_assets WHERE lot_version_id=$1 AND status='READY' LIMIT 1`,[version.rows[0].id]);if(ready.rowCount){await client.query(`UPDATE media_assets SET status='APPROVED',moderated_by=$1,moderated_at=now() WHERE lot_version_id=$2 AND status='READY'`,[req.user!.id,version.rows[0].id]);await client.query(`UPDATE lot_versions SET status='PUBLISHED',reviewed_by=$1,reviewed_at=now() WHERE id=$2`,[req.user!.id,version.rows[0].id]);await client.query('UPDATE lots SET current_published_version_id=$1 WHERE id=$2',[version.rows[0].id,lot.id]);}else await client.query(`UPDATE lot_versions SET status='REJECTED',reviewed_by=$1,reviewed_at=now() WHERE id=$2`,[req.user!.id,version.rows[0].id]);});res.status(204).end();}));
lotsRouter.post('/:id/reject',requireRoles('ADMIN','COORDINATOR'),requirePermission('moderation','edit'),asyncHandler(async(req,res)=>{const lot=await loadLot(param(req.params.id));if(req.user!.role==='COORDINATOR') await assertDepartureAccess(req.user!,lot.departure_id,['COORDINATOR']);const version=await query<{id:string;status:string}>('SELECT id,status FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1',[lot.id]);if(!version.rows[0]||version.rows[0].status!=='PENDING')throw new AppError(409,'LOT_NOT_PENDING','El lote no está pendiente de moderación');await transaction(async client=>{await client.query(`UPDATE media_assets SET status='REJECTED',moderated_by=$1,moderated_at=now(),purge_after=now()+interval '30 days' WHERE lot_version_id=$2 AND status='READY'`,[req.user!.id,version.rows[0].id]);await client.query(`UPDATE lot_versions SET status='REJECTED',reviewed_by=$1,reviewed_at=now() WHERE id=$2`,[req.user!.id,version.rows[0].id]);});res.status(204).end();}));
lotsRouter.patch('/media/:mediaId/moderation',requireRoles('ADMIN','COORDINATOR'),requirePermission('moderation','edit'),asyncHandler(async(req,res)=>{const input=moderationSchema.parse(req.body); if(req.user!.role==='COORDINATOR'){const access=await query('SELECT l.departure_id FROM media_assets m JOIN lot_versions v ON v.id=m.lot_version_id JOIN lots l ON l.id=v.lot_id WHERE m.id=$1',[param(req.params.mediaId)]); if(!access.rowCount) throw new AppError(404,'MEDIA_NOT_FOUND','Archivo no encontrado'); await assertDepartureAccess(req.user!,access.rows[0].departure_id,['COORDINATOR']);}const status=input.action==='reject'?'REJECTED':'READY';const result=await query(`UPDATE media_assets m SET status=CASE WHEN $1::media_status='REJECTED'::media_status THEN 'REJECTED'::media_status WHEN EXISTS(SELECT 1 FROM lot_versions v WHERE v.id=m.lot_version_id AND v.status='PUBLISHED') THEN 'APPROVED'::media_status ELSE 'READY'::media_status END,moderated_by=$2,moderated_at=now(),purge_after=CASE WHEN $1::media_status='REJECTED'::media_status THEN now()+interval '30 days' ELSE NULL END WHERE m.id=$3 RETURNING id,status`,[status,req.user!.id,param(req.params.mediaId)]);if(!result.rowCount)throw new AppError(404,'MEDIA_NOT_FOUND','Archivo no encontrado');res.status(204).end();}));
