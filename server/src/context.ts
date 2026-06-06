import { db, UserRow } from './db';

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

export type ConnRow = {
  id: number;
  manufacturer_id: number;
  buyer_id: number;
  staff_id: number | null;
};

export type Pair = {
  manufacturerId: number;
  buyerId: number;
  connection: ConnRow;
  /** True if the current user operates on the manufacturer/seller side. */
  iAmSeller: boolean;
};

/**
 * Resolve the manufacturer<->buyer connection between the current user and
 * `otherId`, enforcing role scoping. Returns null if no such connection exists
 * or the user isn't allowed to see it (e.g. staff not assigned to it).
 */
export function resolvePair(u: UserRow, otherId: number): Pair | null {
  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);

  let manufacturerId: number;
  let buyerId: number;
  let iAmSeller: boolean;

  if (mfg != null) {
    manufacturerId = mfg; buyerId = otherId; iAmSeller = true;
  } else if (buyer != null) {
    manufacturerId = otherId; buyerId = buyer; iAmSeller = false;
  } else {
    return null;
  }

  const conn = db
    .prepare('SELECT id, manufacturer_id, buyer_id, staff_id FROM connections WHERE manufacturer_id = ? AND buyer_id = ?')
    .get(manufacturerId, buyerId) as ConnRow | undefined;
  if (!conn) return null;

  // Staff may only access connections assigned to them.
  if (u.role === 'staff' && conn.staff_id !== u.id) return null;

  return { manufacturerId, buyerId, connection: conn, iAmSeller };
}
