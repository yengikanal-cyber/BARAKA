import { Router, Response } from 'express';
import { db, computeDebt, userBrief, UserRow } from '../db';
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

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Detailed report: cards, type counts, 6-month turnover series, top partners & products. */
router.get('/report', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const sellerSide = manufacturerContext(u) != null;
  const pairs = visiblePairs(u);

  let turnover = 0, paid = 0, debt = 0, returns = 0;
  const counts = { delivery: 0, order: 0, return: 0 };
  const months = lastMonths(6);
  const monthly: Record<string, number> = Object.fromEntries(months.map(m => [m, 0]));
  const perOther: Record<number, number> = {};
  const perProduct: Record<string, { qty: number; total: number }> = {};

  for (const p of pairs) {
    debt += computeDebt(p.manufacturerId, p.buyerId);
    const otherId = sellerSide ? p.buyerId : p.manufacturerId;

    const txs = db
      .prepare('SELECT type, status, total, created_at FROM transactions WHERE manufacturer_id = ? AND buyer_id = ?')
      .all(p.manufacturerId, p.buyerId) as { type: string; status: string; total: number; created_at: string }[];
    for (const tx of txs) {
      counts[tx.type as keyof typeof counts]++;
      const moved = tx.type !== 'return' && (tx.status === 'delivered' || tx.status === 'paid');
      if (moved) {
        turnover += tx.total;
        perOther[otherId] = (perOther[otherId] || 0) + tx.total;
        const key = tx.created_at.slice(0, 7);
        if (key in monthly) monthly[key] += tx.total;
      }
      if (tx.type !== 'return' && tx.status === 'paid') paid += tx.total;
      if (tx.type === 'return' && tx.status === 'accepted') returns += tx.total;
    }

    const items = db
      .prepare(`SELECT ti.name, ti.price, ti.quantity FROM transaction_items ti
                JOIN transactions t ON t.id = ti.transaction_id
                WHERE t.manufacturer_id = ? AND t.buyer_id = ? AND t.type != 'return' AND t.status IN ('delivered','paid')`)
      .all(p.manufacturerId, p.buyerId) as { name: string; price: number; quantity: number }[];
    for (const it of items) {
      const e = perProduct[it.name] || { qty: 0, total: 0 };
      e.qty += it.quantity;
      e.total += it.price * it.quantity;
      perProduct[it.name] = e;
    }
  }

  const topPartners = Object.entries(perOther)
    .map(([id, total]) => ({ user: userBrief(Number(id)), total }))
    .filter(x => x.user)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const topProducts = Object.entries(perProduct)
    .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  res.json({
    cards: { turnover, paid, debt, returns },
    counts,
    monthly: months.map(m => ({ month: m, total: monthly[m] })),
    topPartners,
    topProducts,
    sellerSide,
  });
});

export default router;
