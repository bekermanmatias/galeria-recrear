import { Router } from 'express';
import { requireRoles } from '../auth.js';
import { query, transaction } from '../db.js';
import { AppError } from '../errors.js';
import { asyncHandler } from '../http.js';

const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
export const reopenRouter = Router();

reopenRouter.post('/:id/reopen', requireRoles('ADMIN'), asyncHandler(async (req, res) => {
  const lotId = param(req.params.id);
  const created = await transaction(async client => {
    const lot = await client.query<{ current_published_version_id: string | null }>('SELECT current_published_version_id FROM lots WHERE id=$1 FOR UPDATE', [lotId]);
    if (!lot.rowCount) throw new AppError(404, 'LOT_NOT_FOUND', 'Lote no encontrado');
    const publishedVersionId = lot.rows[0].current_published_version_id;
    if (!publishedVersionId) throw new AppError(409, 'LOT_NOT_PUBLISHED', 'Sólo se puede reabrir un lote publicado');
    const latest = await client.query<{ version_number: number }>('SELECT version_number FROM lot_versions WHERE lot_id=$1 ORDER BY version_number DESC LIMIT 1', [lotId]);
    const version = await client.query<{ id: string }>('INSERT INTO lot_versions (lot_id,version_number,created_by,source) VALUES ($1,$2,$3,\'PORTAL\') RETURNING id', [lotId, (latest.rows[0]?.version_number ?? 0) + 1, req.user!.id]);
    await client.query(`INSERT INTO media_assets (lot_version_id,kind,status,original_name,mime_type,size_bytes,sha256,drive_file_id,preview_drive_file_id,width,height,duration_seconds,sort_order,uploaded_by)
      SELECT $1,kind,'READY',original_name,mime_type,size_bytes,sha256,drive_file_id,preview_drive_file_id,width,height,duration_seconds,sort_order,uploaded_by
      FROM media_assets WHERE lot_version_id=$2 AND status='APPROVED'`, [version.rows[0].id, publishedVersionId]);
    return client.query('SELECT * FROM lot_versions WHERE id=$1', [version.rows[0].id]);
  });
  res.status(201).json(created.rows[0]);
}));
