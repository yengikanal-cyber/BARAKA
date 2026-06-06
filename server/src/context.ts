import { UserRow } from './db';

/**
 * The buyer account this user operates on, or null if not a buyer-side user.
 * - buyer  -> self
 * - partner -> parent (the buyer they co-own)
 */
export function buyerContext(u: UserRow): number | null {
  if (u.role === 'buyer') return u.id;
  if (u.role === 'partner') return u.parent_id ?? null;
  return null;
}

/**
 * The manufacturer account this user operates within, or null.
 * - manufacturer -> self
 * - staff / accountant -> parent (the manufacturer they work for)
 */
export function manufacturerContext(u: UserRow): number | null {
  if (u.role === 'manufacturer') return u.id;
  if (u.role === 'staff' || u.role === 'accountant') return u.parent_id ?? null;
  return null;
}

/** Can this user create deliveries / set prices / manage catalog & team? */
export function canSell(u: UserRow): boolean {
  return u.role === 'manufacturer';
}

/** Buyer-side action capability (orders, returns, confirm delivery). */
export function canBuy(u: UserRow): boolean {
  return u.role === 'buyer' || u.role === 'partner';
}
