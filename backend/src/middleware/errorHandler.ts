import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors → 400 with structured detail
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
  }

  // Multer file errors
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  // Mongoose duplicate key
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
    return res
      .status(409)
      .json({ error: `Duplicate value for ${field}` });
  }

  // Mongoose validation
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Mongoose cast (bad ObjectId, etc.)
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid identifier' });
  }

  // Operational app errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unknown — log full trace in dev, opaque in prod
  console.error('[Unhandled error]', err);
  res.status(500).json({
    error:
      env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err?.message ?? 'Internal server error',
  });
}
