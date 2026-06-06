import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || './data/baraka.db';
const absDbPath = path.resolve(dbPath);
fs.mkdirSync(path.dirname(absDbPath), { recursive: true });

export const db = new DatabaseSync(absDbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Phase 1 schema. Designed PG-compatible: keep types simple, no SQLite-specific tricks.
// Future phases will add: connections, products, transactions (deliveries/orders/returns),
// transaction_items, stories, rewards, notifications, messages.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL CHECK(role IN ('manufacturer','accountant','staff','buyer','partner')),
  parent_id INTEGER REFERENCES users(id),
  avatar_url TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  language TEXT NOT NULL DEFAULT 'uz',
  theme TEXT NOT NULL DEFAULT 'system',
  accent TEXT NOT NULL DEFAULT 'blue',
  glass TEXT NOT NULL DEFAULT 'medium',
  background TEXT NOT NULL DEFAULT 'plain',
  density TEXT NOT NULL DEFAULT 'comfortable',
  font TEXT NOT NULL DEFAULT 'inter',
  radius TEXT NOT NULL DEFAULT 'soft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_parent ON users(parent_id);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  category TEXT,
  photo_url TEXT,
  in_stock INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Connections: a link between a manufacturer (seller) and a buyer.
-- staff_id optionally assigns this connection to a staff member of the manufacturer.
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(manufacturer_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_conn_mfg ON connections(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_conn_buyer ON connections(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conn_staff ON connections(staff_id);

-- Transactions: deliveries / orders / returns between a manufacturer and a buyer.
-- type:   'delivery' | 'order' | 'return'
-- status: pending | accepted | delivered | paid | rejected
--   delivery: pending -> delivered -> paid
--   order:    pending -> accepted -> delivered -> paid
--   return:   pending -> accepted
-- total is the sum of item (price * quantity), stored for fast aggregation.
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('delivery','order','return')),
  status TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  note TEXT,
  reason TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  paid_at TEXT,
  accepted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_pair ON transactions(manufacturer_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_tx_mfg ON transactions(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_tx_buyer ON transactions(buyer_id);

CREATE TABLE IF NOT EXISTS transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 0,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_txitem_tx ON transaction_items(transaction_id);

-- Plain text chat messages (used by accountant messaging & general chat).
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(manufacturer_id, buyer_id);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- Stories: 24h ephemeral posts by a manufacturer.
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  discount_percent REAL,
  photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stories_mfg ON stories(manufacturer_id);

-- Rewards: incentive programs defined by a manufacturer.
CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manufacturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  photo_url TEXT,
  description TEXT,
  period_type TEXT NOT NULL DEFAULT 'custom',
  start_date TEXT,
  end_date TEXT,
  criteria TEXT NOT NULL DEFAULT 'volume',
  top_n INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rewards_mfg ON rewards(manufacturer_id);
`);

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  nickname: string;
  phone: string | null;
  role: 'manufacturer' | 'accountant' | 'staff' | 'buyer' | 'partner';
  parent_id: number | null;
  avatar_url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  language: string;
  theme: string;
  accent: string;
  glass: string;
  background: string;
  density: string;
  font: string;
  radius: string;
  created_at: string;
};

export function publicUser(u: UserRow) {
  const { password_hash, ...rest } = u;
  return rest;
}

export type ProductRow = {
  id: number;
  manufacturer_id: number;
  name: string;
  price: number;
  unit: string;
  category: string | null;
  photo_url: string | null;
  in_stock: number; // 0/1
  created_at: string;
};

export type ProductDTO = Omit<ProductRow, 'in_stock'> & { in_stock: boolean };

export function productOut(p: ProductRow): ProductDTO {
  return { ...p, in_stock: p.in_stock === 1 };
}

// ---------- Shared helpers ----------

export type PublicUser = {
  id: number;
  name: string;
  nickname: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
};

export function userBrief(id: number): PublicUser | null {
  const u = db
    .prepare('SELECT id, name, nickname, role, avatar_url, phone FROM users WHERE id = ?')
    .get(id) as PublicUser | undefined;
  return u ?? null;
}

/**
 * Debt a buyer owes a manufacturer:
 *   SUM(delivered & unpaid totals, type != return)  -  SUM(accepted return totals)
 * clamped at 0.
 */
export function computeDebt(manufacturerId: number, buyerId: number): number {
  const owed = (db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS s FROM transactions
       WHERE manufacturer_id = ? AND buyer_id = ?
       AND type != 'return' AND status = 'delivered'`,
    )
    .get(manufacturerId, buyerId) as { s: number }).s;
  const returned = (db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS s FROM transactions
       WHERE manufacturer_id = ? AND buyer_id = ?
       AND type = 'return' AND status = 'accepted'`,
    )
    .get(manufacturerId, buyerId) as { s: number }).s;
  return Math.max(0, owed - returned);
}

export function notify(
  userId: number,
  type: string,
  title: string,
  body?: string,
  data?: Record<string, unknown>,
) {
  db.prepare(
    `INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    userId as any,
    type,
    title,
    (body ?? null) as any,
    (data ? JSON.stringify(data) : null) as any,
  );
}
