import { Request, Response, NextFunction } from 'express';

export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled route error:', err && err.stack ? err.stack : err);
  const status = err && err.status && Number.isInteger(err.status) ? err.status : 500;
  const message = err && err.message ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
}
