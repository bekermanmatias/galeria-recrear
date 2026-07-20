import 'dotenv/config';
import { hashPassword } from '../auth.js';
import { config } from '../config.js';
import { query, closeDatabase } from '../db.js';

await query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,\'ADMIN\') ON CONFLICT (email) DO NOTHING',['Administrador',config.INITIAL_ADMIN_EMAIL,await hashPassword(config.INITIAL_ADMIN_PASSWORD)]);
console.log(`Seed complete: ${config.INITIAL_ADMIN_EMAIL}`);
await closeDatabase();
