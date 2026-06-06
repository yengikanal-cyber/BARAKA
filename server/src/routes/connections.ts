import { Router, Response } from 'express';
import { z } from 'zod';
import { db, computeDebt, notify, UserRow } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { buyerContext, manufacturerContext } from '../context';

const router = Router();

type ContactRow = {
  connection_id: number;
  other_id: number;
  name: string;
  nickname: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  staff_id: number | null;
  debt: number;
};

/**
 * List the current user's contacts (the "other party" of each connection),
 * with live debt. Respects role scoping:
 *  - manufacturer: all its connections (other = buyer)
 *  - staff:        only connections assigned to them (staff_id = me)
 *  - accountant:   all the manufacturer's connections
 *  - buyer/partner: all the buyer's connections (other = manufacturer)
 */
router.get('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);
  let rows: ContactRow[] = [];

  if (mfg != null) {
    const where = ['c.manufacturer_id = ?'];
    const params: unknown[] = [mfg];
    if (u.role === 'staff') { where.push('c.staff_id = ?'); params.push(u.id); }
    rows = db
      .prepare(
        `SELECT c.id AS connection_id, c.staff_id, c.buyer_id AS other_id,
                o.name, o.nickname, o.role, o.avatar_url, o.phone
         FROM connections c JOIN users o ON o.id = c.buyer_id
         WHERE ${where.join(' AND ')}
         ORDER BY o.name COLLATE NOCASE`,
      )
      .all(...(params as any[])) as any[];
    rows = rows.map(r => ({ ...r, debt: computeDebt(mfg, r.other_id) }));
  } else if (buyer != null) {
    rows = db
      .prepare(
        `SELECT c.id AS connection_id, c.staff_id, c.manufacturer_id AS other_id,
                o.name, o.nickname, o.role, o.avatar_url, o.phone
         FROM connections c JOIN users o ON o.id = c.manufacturer_id
         WHERE c.buyer_id = ?
         ORDER BY o.name COLLATE NOCASE`,
      )
      .all(buyer) as any[];
    rows = rows.map(r => ({ ...r, debt: computeDebt(r.other_id, buyer) }));
  }

  res.json({ contacts: rows });
});

/**
 * Search users to connect with. From 1 char, matches nickname/name/phone.
 * Hides self, sub-accounts (staff/accountant/partner), and—for buyers—shows
 * manufacturers; for manufacturers—shows buyers. Marks already-connected.
 */
router.get('/search', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const q = ((req.query.q as string) || '').trim();
  if (q.length < 1) return res.json({ results: [] });
  const like = `%${q}%`;

  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);
  // Who can THIS user connect to?
  let targetRole: 'manufacturer' | 'buyer';
  if (buyer != null) targetRole = 'manufacturer';
  else if (mfg != null) targetRole = 'buyer';
  else return res.json({ results: [] });

  const rows = db
    .prepare(
      `SELECT id, name, nickname, role, avatar_url, phone FROM users
       WHERE role = ?
       AND id != ?
       AND (nickname LIKE ? OR name LIKE ? OR (phone IS NOT NULL AND phone LIKE ?))
       ORDER BY name COLLATE NOCASE LIMIT 25`,
    )
    .all(targetRole, u.id, like, like, like) as any[];

  // Determine existing connections to mark them
  const results = rows.map(r => {
    let connected = false;
    if (buyer != null) {
      connected = !!db.prepare('SELECT 1 FROM connections WHERE manufacturer_id = ? AND buyer_id = ?').get(r.id, buyer);
    } else if (mfg != null) {
      connected = !!db.prepare('SELECT 1 FROM connections WHERE manufacturer_id = ? AND buyer_id = ?').get(mfg, r.id);
    }
    return { ...r, connected };
  });

  res.json({ results });
});

const addSchema = z.object({ userId: z.number().int().positive() });

router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const otherId = parsed.data.userId;

  const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId) as UserRow | undefined;
  if (!other) return res.status(404).json({ error: 'user_not_found' });

  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);

  let manufacturerId: number;
  let buyerId: number;
  let initiatorIsMfg: boolean;

  if (buyer != null && other.role === 'manufacturer') {
    manufacturerId = other.id; buyerId = buyer; initiatorIsMfg = false;
  } else if (mfg != null && other.role === 'buyer') {
    manufacturerId = mfg; buyerId = other.id; initiatorIsMfg = true;
  } else {
    return res.status(400).json({ error: 'invalid_pair' });
  }

  const existing = db
    .prepare('SELECT id FROM connections WHERE manufacturer_id = ? AND buyer_id = ?')
    .get(manufacturerId, buyerId);
  if (existing) return res.status(409).json({ error: 'already_connected' });

  const info = db
    .prepare('INSERT INTO connections (manufacturer_id, buyer_id) VALUES (?, ?)')
    .run(manufacturerId as any, buyerId as any);

  // Notify the OTHER party
  notify(
    other.id,
    'connection_new',
    'connection_new',
    undefined,
    { name: u.name, nickname: u.nickname },
  );

  res.json({ connection_id: Number(info.lastInsertRowid) });
});

router.delete('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const id = Number(req.params.id);
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
  if (!conn) return res.status(404).json({ error: 'not_found' });
  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);
  const allowed =
    (mfg != null && conn.manufacturer_id === mfg) ||
    (buyer != null && conn.buyer_id === buyer);
  if (!allowed) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
