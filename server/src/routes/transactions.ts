import { Router, Response } from 'express';
import { z } from 'zod';
import { db, computeDebt, notify } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { resolvePair } from '../context';
import { loadTx, TxRow } from './chat';

const router = Router();

const itemSchema = z.object({
  product_id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(24),
  price: z.number().min(0),
  quantity: z.number().positive(),
  reason: z.string().trim().max(200).nullable().optional(),
});

const createSchema = z.object({
  otherId: z.number().int().positive(),
  type: z.enum(['delivery', 'order', 'return']),
  items: z.array(itemSchema).min(1),
  note: z.string().trim().max(500).nullable().optional(),
});

/** Create a delivery (seller), or an order/return (buyer). */
router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { otherId, type, items, note } = parsed.data;

  const pair = resolvePair(u, otherId);
  if (!pair) return res.status(404).json({ error: 'no_connection' });

  // Role gating: who can create what.
  if (type === 'delivery' && !pair.iAmSeller) return res.status(403).json({ error: 'forbidden' });
  if ((type === 'order' || type === 'return') && pair.iAmSeller) return res.status(403).json({ error: 'forbidden' });

  const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

  const info = db
    .prepare(`INSERT INTO transactions (manufacturer_id, buyer_id, type, status, total, note, created_by)
              VALUES (?, ?, ?, 'pending', ?, ?, ?)`)
    .run(pair.manufacturerId as any, pair.buyerId as any, type, total as any, (note ?? null) as any, u.id as any);
  const txId = Number(info.lastInsertRowid);

  const insItem = db.prepare(
    `INSERT INTO transaction_items (transaction_id, product_id, name, unit, price, quantity, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const it of items) {
    insItem.run(txId as any, (it.product_id ?? null) as any, it.name, it.unit, it.price as any, it.quantity as any, (it.reason ?? null) as any);
  }

  notify(otherId, `tx_new_${type}`, `tx_new_${type}`, undefined, { name: u.name, nickname: u.nickname, total });

  res.json({ transaction: loadTx(txId), debt: computeDebt(pair.manufacturerId, pair.buyerId) });
});

const actionSchema = z.object({ action: z.enum(['accept', 'deliver', 'pay', 'reject']) });

/** Advance a transaction's lifecycle. Seller-side only. */
router.post('/:id/action', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const id = Number(req.params.id);
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { action } = parsed.data;

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TxRow | undefined;
  if (!tx) return res.status(404).json({ error: 'not_found' });

  const pair = resolvePair(u, u.role === 'buyer' || u.role === 'partner' ? tx.manufacturer_id : tx.buyer_id);
  if (!pair || pair.connection.manufacturer_id !== tx.manufacturer_id || pair.connection.buyer_id !== tx.buyer_id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  // All lifecycle actions are seller-side.
  if (!pair.iAmSeller) return res.status(403).json({ error: 'forbidden' });

  // Validate transition for this type + current status.
  let next: string | null = null;
  let stamp: 'delivered_at' | 'paid_at' | 'accepted_at' | null = null;
  const { type, status } = tx;

  if (action === 'accept') {
    if ((type === 'order' || type === 'return') && status === 'pending') { next = 'accepted'; stamp = 'accepted_at'; }
  } else if (action === 'deliver') {
    if (type === 'delivery' && status === 'pending') { next = 'delivered'; stamp = 'delivered_at'; }
    else if (type === 'order' && status === 'accepted') { next = 'delivered'; stamp = 'delivered_at'; }
  } else if (action === 'pay') {
    if (type !== 'return' && status === 'delivered') { next = 'paid'; stamp = 'paid_at'; }
  } else if (action === 'reject') {
    if ((type === 'order' || type === 'return') && status === 'pending') { next = 'rejected'; }
  }

  if (!next) return res.status(409).json({ error: 'invalid_transition' });

  if (stamp) {
    db.prepare(`UPDATE transactions SET status = ?, ${stamp} = CURRENT_TIMESTAMP WHERE id = ?`).run(next, id as any);
  } else {
    db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run(next, id as any);
  }

  // Notify the buyer (the other party) about the status change.
  notify(tx.buyer_id, `tx_${action}_${type}`, `tx_${action}_${type}`, undefined, { name: u.name, nickname: u.nickname });

  res.json({ transaction: loadTx(id), debt: computeDebt(tx.manufacturer_id, tx.buyer_id) });
});

export default router;
