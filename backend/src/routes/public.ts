import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { asyncHandler } from '../http.js';
import { getStorage } from '../storage.js';

const require = createRequire(import.meta.url);
const createArchive = require('archiver') as (format: string, options: { zlib: { level: number } }) => {
  on(event: string, callback: (error: Error) => void): void;
  pipe(destination: NodeJS.WritableStream): void;
  append(source: NodeJS.ReadableStream, options: { name: string }): void;
  finalize(): Promise<void>;
};

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
const idSchema = z.string().uuid();
const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

type PublicLink = { school_id: string; school_name: string };
type PublicMedia = { id: string; drive_file_id: string; original_name: string; mime_type: string; size_bytes: number; kind: 'IMAGE' | 'VIDEO'; school_id: string };

function secureHeaders(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

async function resolveLink(rawToken: string): Promise<PublicLink> {
  const token = tokenSchema.parse(rawToken);
  const result = await query<PublicLink>(`
    SELECT p.school_id, s.name AS school_name
    FROM public_school_links p
    JOIN schools s ON s.id = p.school_id
    WHERE p.token_hash = $1 AND p.active = TRUE AND s.active = TRUE AND s.deleted_at IS NULL
  `, [hashToken(token)]);
  if (!result.rowCount) throw new AppError(404, 'PUBLIC_LINK_NOT_FOUND', 'El enlace no es valido o fue revocado');
  return result.rows[0];
}

async function publishedLot(schoolId: string, lotId: string) {
  const result = await query(`
    SELECT l.id, l.event_date, s.id AS school_id, s.name AS school_name,
           COALESCE(a.name, 'General') AS activity_name, COALESCE(sh.name, 'Unico') AS shift_name,
           v.id AS version_id, v.version_number, v.status,
           COUNT(m.id) FILTER (WHERE m.status = 'APPROVED')::int AS approved_count
    FROM lots l
    JOIN schools s ON s.id = l.school_id
    JOIN lot_versions v ON v.id = l.current_published_version_id AND v.status = 'PUBLISHED'
    LEFT JOIN activities a ON a.id = l.activity_id
    LEFT JOIN shifts sh ON sh.id = l.shift_id
    LEFT JOIN media_assets m ON m.lot_version_id = v.id
    WHERE l.id = $1 AND l.school_id = $2
    GROUP BY l.id, s.id, a.id, sh.id, v.id
  `, [lotId, schoolId]);
  if (!result.rowCount) throw new AppError(404, 'PUBLIC_LOT_NOT_FOUND', 'El lote publicado no existe');
  return result.rows[0];
}

async function publicMedia(schoolId: string, mediaId: string): Promise<PublicMedia> {
  const result = await query<PublicMedia>(`
    SELECT m.id, m.drive_file_id, m.original_name, m.mime_type, m.size_bytes, m.kind, l.school_id
    FROM media_assets m
    JOIN lot_versions v ON v.id = m.lot_version_id
    JOIN lots l ON l.id = v.lot_id
    WHERE m.id = $1 AND l.school_id = $2
      AND l.current_published_version_id = m.lot_version_id
      AND v.status = 'PUBLISHED' AND m.status = 'APPROVED'
  `, [mediaId, schoolId]);
  if (!result.rowCount || !result.rows[0].drive_file_id) throw new AppError(404, 'PUBLIC_MEDIA_NOT_FOUND', 'El archivo publicado no existe');
  return result.rows[0];
}

export const publicRouter = Router();
publicRouter.use((_, res, next) => { secureHeaders(res); next(); });

publicRouter.get('/:token', asyncHandler(async (req, res) => {
  const link = await resolveLink(param(req.params.token));
  const result = await query(`
    SELECT l.id, l.event_date, s.id AS school_id, s.name AS school_name,
           COALESCE(a.name, 'General') AS activity_name, COALESCE(sh.name, 'Unico') AS shift_name,
           v.id AS version_id, v.version_number, v.status,
           COUNT(m.id) FILTER (WHERE m.status = 'APPROVED')::int AS approved_count
    FROM lots l
    JOIN schools s ON s.id = l.school_id
    JOIN lot_versions v ON v.id = l.current_published_version_id AND v.status = 'PUBLISHED'
    LEFT JOIN activities a ON a.id = l.activity_id
    LEFT JOIN shifts sh ON sh.id = l.shift_id
    LEFT JOIN media_assets m ON m.lot_version_id = v.id
    WHERE l.school_id = $1
    GROUP BY l.id, s.id, a.id, sh.id, v.id
    ORDER BY l.event_date DESC, v.created_at DESC
  `, [link.school_id]);
  res.json({ school: { id: link.school_id, name: link.school_name }, items: result.rows });
}));

publicRouter.get('/:token/lots/:lotId', asyncHandler(async (req, res) => {
  const link = await resolveLink(param(req.params.token));
  const lot = await publishedLot(link.school_id, idSchema.parse(param(req.params.lotId)));
  const media = await query(`SELECT id, kind, status, original_name, mime_type, size_bytes FROM media_assets WHERE lot_version_id = $1 AND status = 'APPROVED' ORDER BY sort_order, created_at`, [lot.version_id]);
  res.json({ lot, media: media.rows });
}));

async function streamPublicMedia(req: Request, res: Response, disposition?: 'attachment') {
  const link = await resolveLink(param(req.params.token));
  const media = await publicMedia(link.school_id, idSchema.parse(param(req.params.mediaId)));
  const remote = await getStorage().stream(media.drive_file_id, req.headers.range);
  res.status(remote.status).setHeader('Content-Type', remote.mimeType || media.mime_type);
  res.setHeader('Content-Length', String(remote.size || media.size_bytes));
  res.setHeader('Accept-Ranges', 'bytes');
  if (remote.contentRange) res.setHeader('Content-Range', remote.contentRange);
  if (disposition) res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(media.original_name)}`);
  remote.stream.pipe(res);
}

publicRouter.get('/:token/media/:mediaId/content', asyncHandler(async (req, res) => streamPublicMedia(req, res)));
publicRouter.get('/:token/media/:mediaId/thumbnail', asyncHandler(async (req, res) => streamPublicMedia(req, res)));
publicRouter.get('/:token/media/:mediaId/download', asyncHandler(async (req, res) => streamPublicMedia(req, res, 'attachment')));

publicRouter.post('/:token/downloads/zip', asyncHandler(async (req, res) => {
  const link = await resolveLink(param(req.params.token));
  const input = z.object({ mediaIds: z.array(z.string().uuid()).min(1).max(100) }).parse(req.body);
  const items = await Promise.all(input.mediaIds.map(id => publicMedia(link.school_id, id)));
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="galeria-recrear.zip"');
  const archive = createArchive('zip', { zlib: { level: 6 } });
  archive.on('error', error => res.destroy(error));
  archive.pipe(res);
  for (const item of items) {
    const remote = await getStorage().stream(item.drive_file_id);
    archive.append(remote.stream, { name: item.original_name });
  }
  await archive.finalize();
}));
