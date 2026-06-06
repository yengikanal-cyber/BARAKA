import { Router, Response } from 'express';
import { z } from 'zod';
import { db, computeDebt, userBrief, notify } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { resolvePair } from '../context';

const router = Router();

export type TxItem = {
  id: number;
  product_id: number | null;
  name: string;
  unit: string;
  price: number;
  quantity: number;
  reason: string | null;
};

export type TxRow = {
  id: number;
  manufacturer_id: number;
  buyer_id: number;
  type: 'delivery' | 'order' | 'return';
  status: string;
  total: number;
  note: string | null;
  reason: string | null;
  created_by: number;
  created_at: string;
  delivered_at: string | null;
  paid_at: string | null;
  accepted_at: string | null;
};

export function loadTx(id: number) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TxRow | undefined;
  if (!tx) return null;
  const items = db
    .prepare('SELECT id, product_id, name, unit, price, quantity, reason FROM transaction_items WHERE transaction_id = ? ORDER BY id')
    .all(id) as TxItem[];
  return { ...tx, items };
}

/**
 * Chat timeline between the current user and `otherId`: merged messages +
 * transactions ordered oldest→newest, plus the counterpart and live debt.
 */
router.get('/:otherId', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const otherId = Number(req.params.otherId);
  const pair = resolvePair(u, otherId);
  if (!pair) return res.status(404).json({ error: 'no_connection' });

  const msgs = db
    .prepare('SELECT id, sender_id, body, created_at FROM messages WHERE manufacturer_id = ? AND buyer_id = ? ORDER BY created_at, id')
    .all(pair.manufacturerId, pair.buyerId) as any[];

  const txIds = db
    .prepare('SELECT id, created_at FROM transactions WHERE manufacturer_id = ? AND buyer_id = ? ORDER BY created_at, id')
    .all(pair.manufacturerId, pair.buyerId) as { id: number; created_at: string }[];

  const timeline = [
    ...msgs.map(m => ({ kind: 'message' as const, at: m.created_at, message: m })),
    ...txIds.map(t => ({ kind: 'transaction' as const, at: t.created_at, transaction: loadTx(t.id)! })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  res.json({
    other: userBrief(otherId),
    connection_id: pair.connection.id,
    iAmSeller: pair.iAmSeller,
    debt: computeDebt(pair.manufacturerId, pair.buyerId),
    timeline,
  });
});

const msgSchema = z.object({ body: z.string().trim().min(1).max(2000) });

router.post('/:otherId/message', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const otherId = Number(req.params.otherId);
  const pair = resolvePair(u, otherId);
  if (!pair) return res.status(404).json({ error: 'no_connection' });
  const parsed = msgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const info = db
    .prepare('INSERT INTO messages (manufacturer_id, buyer_id, sender_id, body) VALUES (?, ?, ?, ?)')
    .run(pair.manufacturerId as any, pair.buyerId as any, u.id as any, parsed.data.body);

  notify(otherId, 'message_new', 'message_new', undefined, { name: u.name, nickname: u.nickname });

  const message = db.prepare('SELECT id, sender_id, body, created_at FROM messages WHERE id = ?').get(Number(info.lastInsertRowid));
  res.json({ message });
});

export default router;
