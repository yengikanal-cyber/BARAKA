import { Router, Response } from 'express';
import { db, computeDebt, UserRow } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { manufacturerContext, buyerContext } from '../context';

const router = Router();

export type Pair = { manufacturerId: number; buyerId: number };

/** The manufacturer<->buyer pairs the current user is allowed to see. */
export function visiblePairs(u: UserRow): Pair[] {
  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);
  if (mfg != null) {
    const rows = u.role === 'staff'
      ? db.prepare('SELECT buyer_id FROM connections WHERE manufacturer_id = ? AND staff_id = ?').all(mfg, u.id) as { buyer_id: number }[]
      : db.prepare('SELECT buyer_id FROM connections WHERE manufacturer_id = ?').all(mfg) as { buyer_id: number }[];
    return rows.map(r => ({ manufacturerId: mfg, buyerId: r.buyer_id }));
  }
  if (buyer != null) {
    const rows = db.prepare('SELECT manufacturer_id FROM connections WHERE buyer_id = ?').all(buyer) as { manufacturer_id: number }[];
    return rows.map(r => ({ manufacturerId: r.manufacturer_id, buyerId: buyer }));
  }
  return [];
}

function sumWhere(p: Pair, extra: string): number {
  return (db
    .prepare(`SELECT COALESCE(SUM(total),0) AS s FROM transactions WHERE manufacturer_id = ? AND buyer_id = ? AND ${extra}`)
    .get(p.manufacturerId, p.buyerId) as { s: number }).s;
}

/** Dashboard summary: live debt, turnover (delivered+paid, non-return), paid total. */
router.get('/summary', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const pairs = visiblePairs(u);
  let debt = 0, turnover = 0, paid = 0;
  for (const p of pairs) {
    debt += computeDebt(p.manufacturerId, p.buyerId);
    turnover += sumWhere(p, `type != 'return' AND status IN ('delivered','paid')`);
    paid += sumWhere(p, `type != 'return' AND status = 'paid'`);
  }
  res.json({ debt, turnover, paid, contacts: pairs.length });
});

export default router;
