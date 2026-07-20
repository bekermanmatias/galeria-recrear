import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, closeDatabase } from '../db.js';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
await query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, executed_at timestamptz NOT NULL DEFAULT now())');
for (const name of (await fs.readdir(directory)).filter(file => file.endsWith('.sql')).sort()) {
  const seen = await query('SELECT 1 FROM schema_migrations WHERE name=$1',[name]);
  if (seen.rowCount) continue;
  await query(await fs.readFile(path.join(directory,name),'utf8'));
  await query('INSERT INTO schema_migrations (name) VALUES ($1)',[name]);
  console.log(`Applied ${name}`);
}
await closeDatabase();
