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
