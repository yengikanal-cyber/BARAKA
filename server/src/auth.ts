import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { db, UserRow } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'baraka_session';

export function hashPassword(plain: string) {
  return bcrypt.hashSync(plain, 10);
}
export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(userId: number) {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: '30d' });
}

// In production the frontend (vercel.app) and backend (onrender.com) are
// different sites, so the session cookie must be SameSite=None + Secure or
// the browser will silently drop it. In local dev we use Lax over http.
// Render automatically sets RENDER=true on every service.
const CROSS_SITE =
  process.env.NODE_ENV === 'production' ||
  !!process.env.RENDER ||
  process.env.COOKIE_CROSS_SITE === 'true';

const cookieOptions = {
  httpOnly: true as const,
  sameSite: (CROSS_SITE ? 'none' : 'lax') as 'none' | 'lax',
  secure: CROSS_SITE,
  path: '/',
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

export interface AuthedRequest extends Request {
  user?: UserRow;
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: number };
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.uid) as UserRow | undefined;
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export function requireRole(...roles: UserRow['role'][]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
