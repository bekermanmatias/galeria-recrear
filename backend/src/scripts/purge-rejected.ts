import 'dotenv/config';
import { query, closeDatabase } from '../db.js';
import { getStorage } from '../storage.js';

const result = await query<{ id: string; drive_file_id: string; delivery_drive_file_id: string | null }>('SELECT id,drive_file_id,delivery_drive_file_id FROM media_assets WHERE status=\'REJECTED\' AND purge_after <= now() AND drive_file_id IS NOT NULL');
for (const media of result.rows) { await getStorage().trash(media.drive_file_id); if(media.delivery_drive_file_id) await getStorage().trash(media.delivery_drive_file_id); await query('UPDATE media_assets SET status=\'DELETED\',deleted_at=now() WHERE id=$1',[media.id]); }
console.log(`Purged ${result.rowCount ?? 0} rejected assets`);
await closeDatabase();
