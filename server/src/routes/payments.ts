import { Router, Response } from 'express';
import { z } from 'zod';
import { db, computeDebt, notify, PaymentRow } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { resolvePair } from '../context';

const router = Router();

export function loadPayment(id: number): PaymentRow | null {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as PaymentRow | undefined;
  return p ?? null;
}

const createSchema = z.object({
  otherId: z.number().int().positive(),
  amount: z.number().positive(),
  method: z.enum(['bank', 'card', 'cash']),
  receipt_url: z.string().trim().max(300).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

/** Buyer-side: record a payment toward the debt. Starts as 'pending'. */
router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { otherId, amount, method, receipt_url, note } = parsed.data;

  const pair = resolvePair(u, otherId);
  if (!pair) return res.status(404).json({ error: 'no_connection' });
  // Only the buyer side initiates payments.
  if (pair.iAmSeller) return res.status(403).json({ error: 'forbidden' });

  // If the seller disabled cash, reject a cash payment.
  if (method === 'cash') {
    const seller = db
      .prepare('SELECT cash_enabled FROM users WHERE id = ?')
      .get(pair.manufacturerId) as { cash_enabled: number } | undefined;
    if (seller && seller.cash_enabled === 0) return res.status(400).json({ error: 'cash_disabled' });
  }

  const info = db
    .prepare(
      `INSERT INTO payments (manufacturer_id, buyer_id, amount, method, status, receipt_url, note, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
    .run(
      pair.manufacturerId as any,
      pair.buyerId as any,
      amount as any,
      method,
      (receipt_url ?? null) as any,
      (note ?? null) as any,
      u.id as any,
    );
  const payId = Number(info.lastInsertRowid);

  notify(pair.manufacturerId, 'pay_new', 'pay_new', undefined, {
    name: u.name,
    nickname: u.nickname,
    total: amount,
    method,
  });

  res.json({ payment: loadPayment(payId), debt: computeDebt(pair.manufacturerId, pair.buyerId) });
});

const actionSchema = z.object({ action: z.enum(['confirm', 'reject']) });

/** Seller-side: confirm (reduces debt) or reject a pending payment. */
router.post('/:id/action', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const id = Number(req.params.id);
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { action } = parsed.data;

  const pay = loadPayment(id);
  if (!pay) return res.status(404).json({ error: 'not_found' });

  // Resolve the pair from the seller's perspective and verify it matches.
  const pair = resolvePair(u, u.role === 'buyer' || u.role === 'partner' ? pay.manufacturer_id : pay.buyer_id);
  if (!pair || pair.manufacturerId !== pay.manufacturer_id || pair.buyerId !== pay.buyer_id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  // Only the seller confirms/rejects payments.
  if (!pair.iAmSeller) return res.status(403).json({ error: 'forbidden' });
  if (pay.status !== 'pending') return res.status(409).json({ error: 'invalid_transition' });

  if (action === 'confirm') {
    db.prepare(`UPDATE payments SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id as any);
  } else {
    db.prepare(`UPDATE payments SET status = 'rejected' WHERE id = ?`).run(id as any);
  }

  const debt = computeDebt(pay.manufacturer_id, pay.buyer_id);
  notify(pay.buyer_id, `pay_${action}`, `pay_${action}`, undefined, {
    name: u.name,
    nickname: u.nickname,
    total: pay.amount,
    debt,
  });

  res.json({ payment: loadPayment(id), debt });
});

export default router;
