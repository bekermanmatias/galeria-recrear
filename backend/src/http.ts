import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };

export function parsePagination(query: Record<string, unknown>) {
  const raw = Number(query.page ?? 1);
  const size = Number(query.pageSize ?? 24);
  return { page: Number.isInteger(raw) && raw > 0 ? raw : 1, pageSize: Number.isInteger(size) ? Math.min(Math.max(size, 1), 100) : 24 };
}
