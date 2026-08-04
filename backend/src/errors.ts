import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
};

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: error.flatten() } });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  const pgError = error as { code?: string; constraint?: string };
  if (pgError.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Ya existe un registro con esos datos', constraint: pgError.constraint } });
  }
  // Preserve the real failure in server logs without leaking query strings, bodies or public tokens.
  const loggedError = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : error;
  console.error('Unhandled API error', {
    error: loggedError,
    method: req.method,
    path: `${req.baseUrl}${req.path}`,
  });
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'No se pudo completar la solicitud. Intentá nuevamente.'
    }
  });
}
