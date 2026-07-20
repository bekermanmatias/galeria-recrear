import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:4321'),
  SESSION_SECRET: z.string().min(16).default('development-session-secret-change-me'),
  SESSION_DAYS: z.coerce.number().int().positive().default(14),
  MEDIA_STORAGE: z.enum(['local', 'drive']).default('local'),
  LOCAL_MEDIA_DIR: z.string().default('/tmp/galeria-recrear/media'),
  UPLOAD_TEMP_DIR: z.string().default('/tmp/galeria-recrear/uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().max(500).default(500),
  DRIVE_ROOT_FOLDER_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  INITIAL_ADMIN_EMAIL: z.string().email().default('admin@recrear.local'),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).default('change-me-now'),
});

export const config = schema.parse(process.env);
export const paths = {
  localMedia: path.resolve(config.LOCAL_MEDIA_DIR),
  uploads: path.resolve(config.UPLOAD_TEMP_DIR),
};

