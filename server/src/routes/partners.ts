import { Router, Response } from 'express';
import { z } from 'zod';
import { db, publicUser, UserRow } from '../db';
import { AuthedRequest, authMiddleware, hashPassword } from '../auth';
import { buyerContext } from '../context';

const router = Router();

function uniqueNickname(base: string): string {
  const nick = base.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase() || 'partner';
  let candidate = nick;
  let i = 0;
  while (db.prepare('SELECT 1 FROM users WHERE nickname = ?').get(candidate)) {
    i++; candidate = `${nick}${i}`;
  }
  return candidate;
}

/** List the partners of the buyer account the current user operates on. */
router.get('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const buyer = buyerContext(u);
  if (buyer == null) return res.status(403).json({ error: 'forbidden' });
  const partners = db
    .prepare(`SELECT * FROM users WHERE parent_id = ? AND role = 'partner' ORDER BY name COLLATE NOCASE`)
    .all(buyer) as UserRow[];
  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(buyer) as UserRow | undefined;
  res.json({
    partners: partners.map(p => publicUser(p)),
    owner: owner ? publicUser(owner) : null,
    canManage: u.role === 'buyer',
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  phone: z.string().trim().max(40).nullable().optional(),
});

/** Only the account owner (role buyer) may add a partner. */
router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'buyer') return res.status(403).json({ error: 'forbidden' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { name, email, password, phone } = parsed.data;

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase())) {
    return res.status(409).json({ error: 'email_taken' });
  }
  const nickname = uniqueNickname(email.split('@')[0]);
  const info = db
    .prepare(`INSERT INTO users (email, password_hash, name, nickname, phone, role, parent_id)
              VALUES (?, ?, ?, ?, ?, 'partner', ?)`)
    .run(email.toLowerCase(), hashPassword(password), name, nickname, (phone ?? null) as any, u.id as any);
  const partner = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid)) as UserRow;
  res.json({ partner: publicUser(partner) });
});

router.delete('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'buyer') return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  const partner = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!partner || partner.parent_id !== u.id || partner.role !== 'partner') return res.status(404).json({ error: 'not_found' });
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  } catch {
    return res.status(409).json({ error: 'has_history' });
  }
  res.json({ ok: true });
});

export default router;
