import { Router, Response } from 'express';
import { z } from 'zod';
import { db, publicUser, UserRow } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { hashPassword } from '../auth';

const router = Router();

/** Only a manufacturer owns a team. */
function requireManufacturer(req: AuthedRequest, res: Response): number | null {
  const u = req.user!;
  if (u.role !== 'manufacturer') { res.status(403).json({ error: 'forbidden' }); return null; }
  return u.id;
}

function uniqueNickname(base: string): string {
  let nick = base.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase() || 'member';
  let candidate = nick;
  let i = 0;
  while (db.prepare('SELECT 1 FROM users WHERE nickname = ?').get(candidate)) {
    i++; candidate = `${nick}${i}`;
  }
  return candidate;
}

/** List staff & accountant members of the manufacturer, with assigned-client counts. */
router.get('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const mfg = requireManufacturer(req, res);
  if (mfg == null) return;
  const members = db
    .prepare(`SELECT * FROM users WHERE parent_id = ? AND role IN ('staff','accountant') ORDER BY name COLLATE NOCASE`)
    .all(mfg) as UserRow[];
  const out = members.map(m => {
    const assigned = m.role === 'staff'
      ? (db.prepare('SELECT COUNT(*) AS c FROM connections WHERE manufacturer_id = ? AND staff_id = ?').get(mfg, m.id) as { c: number }).c
      : 0;
    return { ...publicUser(m), assignedCount: assigned };
  });
  res.json({ members: out });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['staff', 'accountant']),
  phone: z.string().trim().max(40).nullable().optional(),
});

router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const mfg = requireManufacturer(req, res);
  if (mfg == null) return;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { name, email, password, role, phone } = parsed.data;

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase())) {
    return res.status(409).json({ error: 'email_taken' });
  }
  const nickname = uniqueNickname(email.split('@')[0]);
  const info = db
    .prepare(`INSERT INTO users (email, password_hash, name, nickname, phone, role, parent_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(email.toLowerCase(), hashPassword(password), name, nickname, (phone ?? null) as any, role, mfg as any);
  const member = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid)) as UserRow;
  res.json({ member: { ...publicUser(member), assignedCount: 0 } });
});

router.delete('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const mfg = requireManufacturer(req, res);
  if (mfg == null) return;
  const id = Number(req.params.id);
  const member = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!member || member.parent_id !== mfg) return res.status(404).json({ error: 'not_found' });
  // Unassign their connections, then delete the account.
  db.prepare('UPDATE connections SET staff_id = NULL WHERE staff_id = ?').run(id);
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  } catch {
    return res.status(409).json({ error: 'has_history' });
  }
  res.json({ ok: true });
});

/** For a staff member: list all the manufacturer's connections with an assigned flag. */
router.get('/:id/clients', authMiddleware, (req: AuthedRequest, res: Response) => {
  const mfg = requireManufacturer(req, res);
  if (mfg == null) return;
  const id = Number(req.params.id);
  const member = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!member || member.parent_id !== mfg || member.role !== 'staff') return res.status(404).json({ error: 'not_found' });
  const rows = db
    .prepare(`SELECT c.id AS connection_id, c.staff_id, c.buyer_id,
                     o.name, o.nickname, o.avatar_url
              FROM connections c JOIN users o ON o.id = c.buyer_id
              WHERE c.manufacturer_id = ?
              ORDER BY o.name COLLATE NOCASE`)
    .all(mfg) as any[];
  res.json({ clients: rows.map(r => ({ ...r, assigned: r.staff_id === id })) });
});

const assignSchema = z.object({ connectionId: z.number().int().positive(), assigned: z.boolean(), staffId: z.number().int().positive() });

router.post('/assign', authMiddleware, (req: AuthedRequest, res: Response) => {
  const mfg = requireManufacturer(req, res);
  if (mfg == null) return;
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { connectionId, assigned, staffId } = parsed.data;

  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId) as any;
  if (!conn || conn.manufacturer_id !== mfg) return res.status(404).json({ error: 'not_found' });
  const staff = db.prepare('SELECT * FROM users WHERE id = ?').get(staffId) as UserRow | undefined;
  if (!staff || staff.parent_id !== mfg || staff.role !== 'staff') return res.status(404).json({ error: 'not_found' });

  db.prepare('UPDATE connections SET staff_id = ? WHERE id = ?').run((assigned ? staffId : null) as any, connectionId as any);
  res.json({ ok: true });
});

export default router;
