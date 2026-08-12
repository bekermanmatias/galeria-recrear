import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeDatabase, query } from '../db.js';
import { paths } from '../config.js';
import { createThumbnail } from '../media-processing.js';
import { getStorage } from '../storage.js';

type PendingThumbnail = {
  id: string;
  delivery_source_id: string | null;
  original_source_id: string;
  original_name: string;
  kind: 'IMAGE' | 'VIDEO';
  drive_folder_id: string | null;
};

await fs.mkdir(paths.uploads, { recursive: true });
const pending = await query<PendingThumbnail>(`
  SELECT m.id,
         m.delivery_drive_file_id delivery_source_id,
         m.drive_file_id original_source_id,
         COALESCE(m.delivery_name,m.original_name) original_name,
         m.kind,
         v.drive_folder_id
  FROM media_assets m
  JOIN lot_versions v ON v.id=m.lot_version_id
  WHERE m.kind IN ('IMAGE','VIDEO')
    AND m.status <> 'DELETED'
    AND m.thumbnail_drive_file_id IS NULL
    AND COALESCE(m.delivery_drive_file_id,m.drive_file_id) IS NOT NULL
  ORDER BY m.created_at,m.id
`);

const storage = getStorage();
let completed = 0;
let failed = 0;
const failureReasons = new Map<string, number>();

for (const item of pending.rows) {
  const input = path.join(paths.uploads, `thumbnail-source-${crypto.randomUUID()}`);
  let output = '';
  try {
    const candidates = [...new Set([item.delivery_source_id, item.original_source_id].filter((id): id is string => Boolean(id)))];
    let sourceId = '';
    let downloadError: unknown;
    for (const candidate of candidates) {
      try {
        await fs.rm(input, { force: true });
        await storage.download(candidate, input);
        sourceId = candidate;
        break;
      } catch (error) {
        downloadError = error;
      }
    }
    if (!sourceId) throw downloadError ?? new Error('No source object is available');
    const thumbnail = await createThumbnail(input, item.kind, item.original_name);
    if (!thumbnail) continue;
    output = thumbnail.path;
    const parentId = item.drive_folder_id ?? path.posix.dirname(sourceId.replace(/\\/g, '/'));
    const thumbnailId = await storage.uploadOriginal({ path: thumbnail.path, filename: thumbnail.name, mimeType: thumbnail.mimeType, parentId });
    const stat = await fs.stat(thumbnail.path);
    await query(`UPDATE media_assets SET thumbnail_drive_file_id=$1,thumbnail_mime_type=$2,thumbnail_size_bytes=$3 WHERE id=$4 AND thumbnail_drive_file_id IS NULL`, [thumbnailId, thumbnail.mimeType, stat.size, item.id]);
    completed += 1;
    const processed = completed + failed;
    if (processed % 25 === 0 || processed === pending.rowCount) {
      console.log(`Thumbnails processed: ${processed}/${pending.rowCount}`);
    }
  } catch (error) {
    failed += 1;
    const reason = error instanceof Error ? error.message : String(error);
    failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
  } finally {
    await fs.rm(input, { force: true }).catch(() => undefined);
    if (output) await fs.rm(output, { force: true }).catch(() => undefined);
  }
}

console.log(`Thumbnail backfill complete: ${completed} created, ${failed} failed, ${pending.rowCount} pending at start`);
for (const [reason, count] of failureReasons) console.error(`Thumbnail failures: ${count} x ${reason}`);
await closeDatabase();
if (failed) process.exitCode = 1;
