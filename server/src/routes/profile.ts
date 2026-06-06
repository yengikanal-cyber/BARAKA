import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, publicUser, UserRow } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';

const router = Router();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB per image
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('invalid_image'));
  },
});

const profileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  language: z.enum(['uz', 'ru', 'en']).optional(),
});

router.patch('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const fields: Record<string, unknown> = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return res.json({ user: publicUser(req.user!) });
  vals.push(req.user!.id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;
  res.json({ user: publicUser(fresh) });
});

const appearanceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  accent: z
    .enum(['green', 'blue', 'indigo', 'purple', 'pink', 'orange', 'teal', 'graphite'])
    .optional(),
  glass: z.enum(['off', 'soft', 'medium', 'strong']).optional(),
  background: z.enum(['plain', 'gradient', 'pattern']).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  font: z.enum(['system', 'inter', 'outfit', 'manrope']).optional(),
  radius: z.enum(['square', 'soft', 'round']).optional(),
});

router.patch('/appearance', authMiddleware, (req: AuthedRequest, res: Response) => {
  const parsed = appearanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const fields: Record<string, unknown> = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return res.json({ user: publicUser(req.user!) });
  vals.push(req.user!.id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;
  res.json({ user: publicUser(fresh) });
});

function extFor(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

router.post(
  '/avatar',
  authMiddleware,
  upload.single('avatar'),
  (req: AuthedRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    try {
      const ext = extFor(req.file.mimetype);
      const filename = `avatar_${req.user!.id}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(filepath, req.file.buffer);
      const url = `/uploads/${filename}`;

      // delete old avatar file if it was a local upload
      const old = req.user!.avatar_url;
      if (old && old.startsWith('/uploads/')) {
        const oldPath = path.join(UPLOAD_DIR, path.basename(old));
        fs.promises.unlink(oldPath).catch(() => {});
      }

      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.user!.id);
      const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;
      res.json({ user: publicUser(fresh) });
    } catch (err) {
      console.error('avatar upload failed', err);
      res.status(500).json({ error: 'upload_failed' });
    }
  },
);

const passwordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(6),
});

router.post('/password', authMiddleware, (req: AuthedRequest, res: Response) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { current, next } = parsed.data;
  const bcrypt = require('bcryptjs');
  if (!bcrypt.compareSync(current, req.user!.password_hash))
    return res.status(400).json({ error: 'current_password_wrong' });
  const hash = bcrypt.hashSync(next, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user!.id);
  res.json({ ok: true });
});

export default router;
