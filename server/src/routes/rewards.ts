import { Router, Response } from 'express';
import { z } from 'zod';
import { db, userBrief, notify, PublicUser } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { manufacturerContext, buyerContext } from '../context';

const router = Router();

type RewardRow = {
  id: number;
  manufacturer_id: number;
  title: string;
  photo_url: string | null;
  description: string | null;
  period_type: string;
  start_date: string | null;
  end_date: string | null;
  criteria: string;
  top_n: number;
  created_at: string;
};

type Leader = { user: PublicUser | null; total: number; rank: number };

/**
 * Rank a manufacturer's connected buyers by the reward criteria over the
 * reward's period, returning every buyer with a positive metric (sorted desc).
 *   criteria 'volume' -> turnover (delivered+paid, non-return)
 *   criteria 'paid'   -> paid totals (non-return)
 */
function leaderboard(r: RewardRow): Leader[] {
  const statusClause =
    r.criteria === 'paid'
      ? `status = 'paid'`
      : `status IN ('delivered','paid')`;

  const dateParams: any[] = [];
  let dateClause = '';
  if (r.start_date) { dateClause += ` AND date(created_at) >= date(?)`; dateParams.push(r.start_date); }
  if (r.end_date)   { dateClause += ` AND date(created_at) <= date(?)`; dateParams.push(r.end_date); }

  const rows = db
    .prepare(
      `SELECT buyer_id, COALESCE(SUM(total),0) AS total
       FROM transactions
       WHERE manufacturer_id = ? AND type != 'return' AND ${statusClause}${dateClause}
       GROUP BY buyer_id
       HAVING total > 0
       ORDER BY total DESC`,
    )
    .all(r.manufacturer_id, ...dateParams) as { buyer_id: number; total: number }[];

  return rows.map((row, i) => ({ user: userBrief(row.buyer_id), total: row.total, rank: i + 1 }));
}

function rewardOut(r: RewardRow) {
  const board = leaderboard(r);
  return {
    id: r.id,
    manufacturer: userBrief(r.manufacturer_id),
    title: r.title,
    photo_url: r.photo_url,
    description: r.description,
    period_type: r.period_type,
    start_date: r.start_date,
    end_date: r.end_date,
    criteria: r.criteria,
    top_n: r.top_n,
    created_at: r.created_at,
    leaders: board.slice(0, r.top_n),
  };
}

/**
 * Reward programs.
 *  - seller side: own rewards + canManage (manufacturer only)
 *  - buyer side: rewards from connected manufacturers, each with my rank/total
 */
router.get('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);

  if (mfg != null) {
    const rows = db.prepare('SELECT * FROM rewards WHERE manufacturer_id = ? ORDER BY created_at DESC').all(mfg) as RewardRow[];
    return res.json({ rewards: rows.map(rewardOut), canManage: u.role === 'manufacturer' });
  }

  if (buyer != null) {
    const mfgIds = db.prepare('SELECT manufacturer_id FROM connections WHERE buyer_id = ?').all(buyer) as { manufacturer_id: number }[];
    const ids = mfgIds.map(m => m.manufacturer_id);
    const rewards: any[] = [];
    for (const mid of ids) {
      const rows = db.prepare('SELECT * FROM rewards WHERE manufacturer_id = ? ORDER BY created_at DESC').all(mid) as RewardRow[];
      for (const r of rows) {
        const board = leaderboard(r);
        const mine = board.find(b => b.user?.id === buyer) || null;
        rewards.push({
          ...rewardOut(r),
          myRank: mine ? mine.rank : null,
          myTotal: mine ? mine.total : 0,
          qualifying: mine ? mine.rank <= r.top_n : false,
        });
      }
    }
    return res.json({ rewards, canManage: false });
  }

  res.json({ rewards: [], canManage: false });
});

const rewardSchema = z.object({
  title: z.string().trim().min(1).max(120),
  photo_url: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(800).nullable().optional(),
  period_type: z.enum(['month', 'quarter', 'custom']).default('custom'),
  start_date: z.string().trim().max(20).nullable().optional(),
  end_date: z.string().trim().max(20).nullable().optional(),
  criteria: z.enum(['volume', 'paid']).default('volume'),
  top_n: z.number().int().min(1).max(50).default(3),
});

router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'manufacturer') return res.status(403).json({ error: 'forbidden' });
  const parsed = rewardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const d = parsed.data;

  const info = db
    .prepare(
      `INSERT INTO rewards (manufacturer_id, title, photo_url, description, period_type, start_date, end_date, criteria, top_n)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      u.id as any,
      d.title,
      (d.photo_url ?? null) as any,
      (d.description ?? null) as any,
      d.period_type,
      (d.start_date ?? null) as any,
      (d.end_date ?? null) as any,
      d.criteria,
      d.top_n as any,
    );

  // Notify connected buyers about the new reward program.
  const buyers = db.prepare('SELECT buyer_id FROM connections WHERE manufacturer_id = ?').all(u.id) as { buyer_id: number }[];
  for (const b of buyers) {
    notify(b.buyer_id, 'reward_new', 'reward_new', d.title, { rewardId: Number(info.lastInsertRowid) });
  }

  const row = db.prepare('SELECT * FROM rewards WHERE id = ?').get(Number(info.lastInsertRowid)) as RewardRow;
  res.json({ reward: rewardOut(row) });
});

router.patch('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'manufacturer') return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id) as RewardRow | undefined;
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (existing.manufacturer_id !== u.id) return res.status(403).json({ error: 'forbidden' });

  const parsed = rewardSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const d = parsed.data;

  db.prepare(
    `UPDATE rewards SET
       title = COALESCE(?, title),
       photo_url = ?,
       description = ?,
       period_type = COALESCE(?, period_type),
       start_date = ?,
       end_date = ?,
       criteria = COALESCE(?, criteria),
       top_n = COALESCE(?, top_n)
     WHERE id = ?`,
  ).run(
    (d.title ?? null) as any,
    (d.photo_url !== undefined ? d.photo_url : existing.photo_url) as any,
    (d.description !== undefined ? d.description : existing.description) as any,
    (d.period_type ?? null) as any,
    (d.start_date !== undefined ? d.start_date : existing.start_date) as any,
    (d.end_date !== undefined ? d.end_date : existing.end_date) as any,
    (d.criteria ?? null) as any,
    (d.top_n ?? null) as any,
    id as any,
  );

  const row = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id) as RewardRow;
  res.json({ reward: rewardOut(row) });
});

router.delete('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id) as RewardRow | undefined;
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (existing.manufacturer_id !== u.id) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM rewards WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
