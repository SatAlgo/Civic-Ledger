import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, type IUser } from '../models/User';
import { UnauthorizedError } from '../utils/errors';

export interface AuthPayload {
  sub: string; // user id
  role: 'citizen' | 'department_admin' | 'super_admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUser;
      authPayload?: AuthPayload;
    }
  }
}

export function signToken(user: IUser): string {
  const payload: AuthPayload = { sub: user._id.toString(), role: user.role };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}

/**
 * Required auth — sets req.user and req.authPayload, or 401s.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }
    const token = header.slice(7);
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw new UnauthorizedError('User no longer exists');
    req.user = user;
    req.authPayload = payload;
    next();
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'));
    } else if (err?.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(err);
    }
  }
}

/**
 * Optional auth — best-effort, sets req.user if a valid token is present
 * but never errors out.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    const token = header.slice(7);
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user) {
      req.user = user;
      req.authPayload = payload;
    }
  } catch {
    // ignore — anon view
  }
  next();
}
