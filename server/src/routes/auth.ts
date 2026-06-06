import { Router, Response } from 'express';
import { z } from 'zod';
import { db, publicUser, UserRow } from '../db';
import {
  AuthedRequest,
  authMiddleware,
  clearAuthCookie,
  hashPassword,
  setAuthCookie,
  signToken,
  verifyPassword,
} from '../auth';

const router = Router();

const ROLES = ['manufacturer', 'accountant', 'staff', 'buyer', 'partner'] as const;

const registerSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(6),
  name: z.string().trim().min(1),
  nickname: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_\.]+$/, 'invalid_nickname'),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(ROLES),
  ownerNickname: z.string().trim().optional().nullable(),
});

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const existsEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
  if (existsEmail) return res.status(409).json({ error: 'email_taken' });

  const existsNick = db.prepare('SELECT id FROM users WHERE nickname = ?').get(data.nickname);
  if (existsNick) return res.status(409).json({ error: 'nickname_taken' });

  let parentId: number | null = null;
  if (data.role === 'staff' || data.role === 'accountant' || data.role === 'partner') {
    if (!data.ownerNickname) return res.status(400).json({ error: 'owner_nickname_required' });
    const owner = db
      .prepare('SELECT id, role FROM users WHERE nickname = ?')
      .get(data.ownerNickname) as { id: number; role: string } | undefined;
    if (!owner) return res.status(400).json({ error: 'owner_not_found' });
    if ((data.role === 'staff' || data.role === 'accountant') && owner.role !== 'manufacturer') {
      return res.status(400).json({ error: 'owner_must_be_manufacturer' });
    }
    if (data.role === 'partner' && owner.role !== 'buyer') {
      return res.status(400).json({ error: 'owner_must_be_buyer' });
    }
    parentId = owner.id;
  }

  const passwordHash = hashPassword(data.password);
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, nickname, phone, role, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.email,
      passwordHash,
      data.name,
      data.nickname,
      data.phone || null,
      data.role,
      parentId as any,
    );
  const userId = Number(info.lastInsertRowid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { email, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | UserRow
    | undefined;
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  if (!verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'invalid_credentials' });
  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req: AuthedRequest, res: Response) => {
  res.json({ user: publicUser(req.user!) });
});

export default router;
