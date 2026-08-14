import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { transaction } from './db.js';
import { query } from './db.js';
import { paths } from './config.js';
import { getStorage } from './storage.js';

import fsSync from 'node:fs';

function getWatermarkPath() {
  const distPath = fileURLToPath(new URL('./assets/marca_agua.png', import.meta.url));
  if (fsSync.existsSync(distPath)) return distPath;
  const srcPath = path.resolve(process.cwd(), 'src/assets/marca_agua.png');
  if (fsSync.existsSync(srcPath)) return srcPath;
  const backendSrcPath = path.resolve(process.cwd(), 'backend/src/assets/marca_agua.png');
  if (fsSync.existsSync(backendSrcPath)) return backendSrcPath;
  return distPath;
}

const MAX_ATTEMPTS = 3;
let running = false;
let timer: NodeJS.Timeout | undefined;
type Job = { id:string; attempts:number; media_asset_id:string; drive_file_id:string; mime_type:string; original_name:string; kind:'IMAGE'|'VIDEO'; version_number:number; departure_folder:string; lot_folder:string; };
const safeName=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'') || 'archivo';
const outputName=(name:string,extension:string)=>safeName(name).replace(/\.[^.]+$/,'')+'-recrear.'+extension;
const tempFile=(suffix:string)=>path.join(paths.uploads,'watermark-'+crypto.randomUUID()+suffix);
function runFfmpeg(input:string,output:string){return new Promise<void>((resolve,reject)=>{const child=spawn('ffmpeg',['-y','-i',input,'-c:v','libx264','-crf','22','-preset','superfast','-c:a','aac','-movflags','+faststart',output],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',chunk=>{error+=String(chunk);});child.on('error',err=>reject(new Error('No se pudo iniciar FFmpeg ('+(err.message||'No instalado')+')')));child.on('close',code=>code===0?resolve():reject(new Error('FFmpeg no pudo crear el video compatible ('+code+'): '+error.slice(-500))));});}
function convertHeicToJpeg(input:string){const output=tempFile('.jpg');return new Promise<string>((resolve,reject)=>{const child=spawn('magick',[input,'-auto-orient','-quality','92',output],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',chunk=>{error+=String(chunk);});child.on('error',err=>reject(new Error('No se pudo iniciar el conversor HEIC ('+(err.message||'no instalado')+')')));child.on('close',code=>code===0?resolve(output):reject(new Error('No se pudo convertir la foto HEIC: '+error.slice(-500))));});}
async function convertDngToTiff(input:string){const output=tempFile('.tiff');const child=spawn('dcraw_emu',['-c','-w','-T',input],{stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',chunk=>{error+=String(chunk);});try{const written=pipeline(child.stdout,createWriteStream(output));const code=await new Promise<number>((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});await written;if(code!==0)throw new Error('No se pudo convertir la foto ProRAW: '+error.slice(-500));return output;}catch(error){await fs.rm(output,{force:true}).catch(()=>undefined);throw error;}}
async function watermarkImage(input:string,mime:string){const watermarkPath = getWatermarkPath();const converted=mime==='image/heic'||mime==='image/heif'?await convertHeicToJpeg(input):mime==='image/x-adobe-dng'?await convertDngToTiff(input):undefined;try{const source=converted??input; const metadata=await sharp(source).metadata();let width=metadata.width,height=metadata.height;if(!width||!height)throw new Error('No se pudieron leer las dimensiones de la imagen');if(metadata.orientation&&metadata.orientation>=5){const t=width;width=height;height=t;}const watermarkWidth=Math.max(140,Math.min(650,Math.round(width*.28)));const mark=await sharp(watermarkPath).resize({width:watermarkWidth,withoutEnlargement:true}).png().toBuffer();const markMeta=await sharp(mark).metadata();const margin=Math.max(12,Math.round(width*.025));const target=tempFile(mime==='image/png'?'.png':'.jpg');const composed=sharp(source).rotate().composite([{input:mark,left:Math.max(0,width-(markMeta.width??watermarkWidth)-margin),top:Math.max(0,height-(markMeta.height??watermarkWidth)-margin)}]);if(mime==='image/png')await composed.png({compressionLevel:9}).toFile(target);else await composed.jpeg({quality:92,chromaSubsampling:'4:4:4'}).toFile(target);return {path:target,mimeType:mime==='image/png'?'image/png':'image/jpeg',name:outputName(path.basename(input),mime==='image/png'?'png':'jpg')};}finally{if(converted)await fs.rm(converted,{force:true}).catch(()=>undefined);}}
export async function processLocalMedia(input: string, kind: 'IMAGE'|'VIDEO', originalName: string, mimeType: string) {
  console.time(`Watermark ${originalName}`);
  try {
    if (kind === 'VIDEO') {
      const output = tempFile('.mp4');
      await runFfmpeg(input, output);
      return { path: output, mimeType: 'video/mp4', name: outputName(originalName, 'mp4') };
    } else {
      const rendered = await watermarkImage(input, mimeType);
      return { path: rendered.path, mimeType: rendered.mimeType, name: outputName(originalName, rendered.mimeType === 'image/png' ? 'png' : 'jpg') };
    }
  } finally {
    console.timeEnd(`Watermark ${originalName}`);
  }
}

export async function createThumbnail(input: string, kind: 'IMAGE'|'VIDEO', originalName: string) {
  if (kind === 'VIDEO') {
    const target = tempFile('.jpg');
    await new Promise<void>((resolve,reject)=>{const child=spawn('ffmpeg',['-y','-ss','0.5','-i',input,'-frames:v','1','-vf','scale=640:-2',target],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',chunk=>{error+=String(chunk);});child.on('error',err=>reject(new Error('No se pudo iniciar FFmpeg para la miniatura ('+(err.message||'no instalado')+')')));child.on('close',code=>code===0?resolve():reject(new Error('FFmpeg no pudo extraer la miniatura del video ('+code+'): '+error.slice(-500))));});
    return { path: target, mimeType: 'image/jpeg', name: outputName(originalName, 'jpg') };
  }
  const target = tempFile('.webp');
  await sharp(input).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(target);
  return { path: target, mimeType: 'image/webp', name: outputName(originalName, 'webp') };
}

type VideoJob = {
  id: string; attempts: number; media_asset_id: string; drive_file_id: string; original_name: string;
  mime_type: string; version_number: number; departure_folder: string; lot_folder: string;
};

const processingFile = (suffix: string) => path.join(paths.uploads, `video-process-${crypto.randomUUID()}${suffix}`);

export async function ensureVideoThumbnail(media: { id: string; drive_file_id: string; delivery_drive_file_id: string | null; original_name: string; drive_folder_id?: string | null }) {
  const sourceId = media.delivery_drive_file_id ?? media.drive_file_id;
  const input = processingFile(path.extname(media.original_name) || '.mp4');
  let output = '';
  try {
    await fs.mkdir(paths.uploads, { recursive: true });
    const storage = getStorage();
    await storage.download(sourceId, input);
    const thumbnail = await createThumbnail(input, 'VIDEO', media.original_name);
    if (!thumbnail) return null;
    output = thumbnail.path;
    const parentId = media.drive_folder_id ?? path.posix.dirname(sourceId.replace(/\\/g, '/'));
    const thumbnailId = await storage.uploadOriginal({ path: thumbnail.path, filename: thumbnail.name, mimeType: thumbnail.mimeType, parentId });
    const stat = await fs.stat(thumbnail.path);
    await query(`UPDATE media_assets SET thumbnail_drive_file_id=COALESCE(thumbnail_drive_file_id,$1),thumbnail_mime_type=COALESCE(thumbnail_mime_type,$2),thumbnail_size_bytes=COALESCE(thumbnail_size_bytes,$3),updated_at=now() WHERE id=$4`, [thumbnailId, thumbnail.mimeType, stat.size, media.id]);
    const stored = await query<{thumbnail_drive_file_id:string|null}>('SELECT thumbnail_drive_file_id FROM media_assets WHERE id=$1',[media.id]);
    return stored.rows[0]?.thumbnail_drive_file_id ?? thumbnailId;
  } finally {
    await fs.rm(input, { force: true }).catch(() => undefined);
    if (output) await fs.rm(output, { force: true }).catch(() => undefined);
  }
}

async function claimVideoJob(): Promise<VideoJob | undefined> {
  return transaction(async client => {
    const claimed = await client.query<VideoJob>(`SELECT j.id,j.attempts,j.media_asset_id,m.drive_file_id,m.original_name,m.mime_type,v.version_number,
      regexp_replace(d.public_code || '-' || d.name || '-' || COALESCE(d.destination,''),'[\\\\/:*?"<>|]+','-','g') departure_folder,
      regexp_replace(l.event_date::text || '-' || COALESCE(NULLIF(l.title,''),a.name,'General') || '-' || left(l.id::text,8),'[\\\\/:*?"<>|]+','-','g') lot_folder
      FROM media_watermark_jobs j JOIN media_assets m ON m.id=j.media_asset_id JOIN lot_versions v ON v.id=m.lot_version_id
      JOIN lots l ON l.id=v.lot_id JOIN departures d ON d.id=l.departure_id LEFT JOIN activities a ON a.id=l.activity_id
      WHERE j.status='QUEUED' AND j.available_at <= now() AND m.kind='VIDEO' AND m.drive_file_id IS NOT NULL
      ORDER BY j.available_at,j.created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    const job = claimed.rows[0];
    if (!job) return undefined;
    await client.query(`UPDATE media_watermark_jobs SET status='PROCESSING',attempts=attempts+1,started_at=now(),updated_at=now() WHERE id=$1`, [job.id]);
    await client.query(`UPDATE media_assets SET watermark_status='PROCESSING',watermark_attempts=watermark_attempts+1,watermark_error=NULL,updated_at=now() WHERE id=$1`, [job.media_asset_id]);
    return { ...job, attempts: job.attempts + 1 };
  });
}

async function processVideoJob(job: VideoJob) {
  let input = '';
  let output = '';
  let thumbnailPath = '';
  try {
    await fs.mkdir(paths.uploads, { recursive: true });
    input = processingFile(path.extname(job.original_name) || '.video');
    output = processingFile('.mp4');
    const storage = getStorage();
    await storage.download(job.drive_file_id, input);
    await runFfmpeg(input, output);
    const stat = await fs.stat(output);
    const folder = await storage.createVersionFolder({ departureFolder: job.departure_folder, lotFolder: job.lot_folder, version: job.version_number }, 'marcados');
    const name = outputName(job.original_name, 'mp4');
    const deliveryId = await storage.uploadOriginal({ path: output, filename: name, mimeType: 'video/mp4', parentId: folder });
    const thumbnail = await createThumbnail(output, 'VIDEO', job.original_name);
    thumbnailPath = thumbnail?.path ?? '';
    const thumbnailId = thumbnail ? await storage.uploadOriginal({ path: thumbnail.path, filename: thumbnail.name, mimeType: thumbnail.mimeType, parentId: folder }) : null;
    const thumbnailSize = thumbnail ? await fs.stat(thumbnail.path) : null;
    await transaction(async client => {
      await client.query(`UPDATE media_assets SET delivery_drive_file_id=$1,delivery_mime_type='video/mp4',delivery_size_bytes=$2,delivery_name=$3,thumbnail_drive_file_id=COALESCE($4,thumbnail_drive_file_id),thumbnail_mime_type=COALESCE($5,thumbnail_mime_type),thumbnail_size_bytes=COALESCE($6,thumbnail_size_bytes),watermark_status='READY',watermark_error=NULL,updated_at=now() WHERE id=$7`, [deliveryId, stat.size, name, thumbnailId, thumbnail?.mimeType ?? null, thumbnailSize?.size ?? null, job.media_asset_id]);
      await client.query(`UPDATE media_watermark_jobs SET status='DONE',completed_at=now(),error=NULL,updated_at=now() WHERE id=$1`, [job.id]);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'No se pudo procesar el video';
    const retry = job.attempts < MAX_ATTEMPTS;
    await transaction(async client => {
      await client.query(`UPDATE media_assets SET watermark_status=$1,watermark_error=$2,updated_at=now() WHERE id=$3`, [retry ? 'QUEUED' : 'FAILED', message, job.media_asset_id]);
      await client.query(`UPDATE media_watermark_jobs SET status=$1,error=$2,available_at=CASE WHEN $1='QUEUED' THEN now()+($3::text || ' seconds')::interval ELSE available_at END,completed_at=CASE WHEN $1='FAILED' THEN now() ELSE NULL END,updated_at=now() WHERE id=$4`, [retry ? 'QUEUED' : 'FAILED', message, Math.min(300, 15 * 2 ** Math.max(0, job.attempts - 1)), job.id]);
    });
    console.error('Video processing failed; original remains available', { mediaAssetId: job.media_asset_id, message });
  } finally {
    if (input) await fs.rm(input, { force: true }).catch(() => undefined);
    if (output) await fs.rm(output, { force: true }).catch(() => undefined);
    if (thumbnailPath) await fs.rm(thumbnailPath, { force: true }).catch(() => undefined);
  }
}

async function drainVideoJobs() {
  if (running) return;
  running = true;
  try { for (;;) { const job = await claimVideoJob(); if (!job) break; await processVideoJob(job); } }
  catch (error) { console.error('Video processing worker failed', error); }
  finally { running = false; }
}

export function queueVideoProcessing() { void drainVideoJobs(); }
async function enqueueVideosMissingThumbnails() {
  await query(`INSERT INTO media_watermark_jobs(media_asset_id,status,available_at)
    SELECT m.id,'QUEUED',now() FROM media_assets m
    -- También recupera videos que ya tienen miniatura pero nunca terminaron
    -- de generar su MP4 H.264 reproducible en el navegador.
    WHERE m.kind='VIDEO' AND m.status <> 'DELETED' AND m.drive_file_id IS NOT NULL
      AND (m.thumbnail_drive_file_id IS NULL OR m.delivery_drive_file_id IS NULL)
    ON CONFLICT(media_asset_id) DO UPDATE SET status=CASE WHEN media_watermark_jobs.status='DONE' THEN 'QUEUED' ELSE media_watermark_jobs.status END,available_at=CASE WHEN media_watermark_jobs.status='DONE' THEN now() ELSE media_watermark_jobs.available_at END,updated_at=now()`);
}
export function startMediaProcessingWorker() { if (!timer) timer = setInterval(() => void drainVideoJobs(), 15_000); void enqueueVideosMissingThumbnails().then(queueVideoProcessing).catch(error => console.error('Could not queue video thumbnails', error)); queueVideoProcessing(); }
