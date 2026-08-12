import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeDatabase, query } from '../db.js';
import { paths } from '../config.js';
import { createThumbnail } from '../media-processing.js';
import { getStorage } from '../storage.js';

type PendingThumbnail = {
  id: string;
  source_id: string;
  original_name: string;
  drive_folder_id: string | null;
};

await fs.mkdir(paths.uploads, { recursive: true });
const pending = await query<PendingThumbnail>(`
  SELECT m.id,
         COALESCE(m.delivery_drive_file_id,m.drive_file_id) source_id,
         COALESCE(m.delivery_name,m.original_name) original_name,
         v.drive_folder_id
  FROM media_assets m
  JOIN lot_versions v ON v.id=m.lot_version_id
  WHERE m.kind='IMAGE'
    AND m.status <> 'DELETED'
    AND m.thumbnail_drive_file_id IS NULL
    AND COALESCE(m.delivery_drive_file_id,m.drive_file_id) IS NOT NULL
  ORDER BY m.created_at,m.id
`);

const storage = getStorage();
let completed = 0;
let failed = 0;

for (const item of pending.rows) {
  const input = path.join(paths.uploads, `thumbnail-source-${crypto.randomUUID()}`);
  let output = '';
  try {
    await storage.download(item.source_id, input);
    const thumbnail = await createThumbnail(input, 'IMAGE', item.original_name);
    if (!thumbnail) continue;
    output = thumbnail.path;
    const parentId = item.drive_folder_id ?? path.posix.dirname(item.source_id.replace(/\\/g, '/'));
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
    console.error(`Thumbnail failed: ${item.id}`, error instanceof Error ? error.message : error);
  } finally {
    await fs.rm(input, { force: true }).catch(() => undefined);
    if (output) await fs.rm(output, { force: true }).catch(() => undefined);
  }
}

console.log(`Thumbnail backfill complete: ${completed} created, ${failed} failed, ${pending.rowCount} pending at start`);
await closeDatabase();
if (failed) process.exitCode = 1;
