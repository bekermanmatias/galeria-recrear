import express from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { authenticate, requireRoles } from './auth.js';
import { config } from './config.js';
import { errorHandler, notFound } from './errors.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { lotsRouter } from './routes/lots.js';
import { mediaRouter } from './routes/media.js';
import { reopenRouter } from './routes/reopen.js';
import { query } from './db.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers.set-cookie'] }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/api/health', async (_req, res, next) => { try { await query('SELECT 1'); res.json({ status: 'ok' }); } catch (error) { next(error); } });
  app.use('/api/v1/auth', (req, res, next) => req.path === '/me' || req.path === '/change-password' ? authenticate(req, res, next) : next(), authRouter);
  app.use('/api/v1/admin', authenticate, requireRoles('ADMIN'), adminRouter);
  app.use('/api/v1/lots', authenticate, reopenRouter, lotsRouter);
  app.use('/api/v1/media', authenticate, mediaRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
