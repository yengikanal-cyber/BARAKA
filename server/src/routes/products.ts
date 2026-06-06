import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { db, productOut, ProductRow } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';

const router = Router();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

const UNITS = [
  'dona', 'kg', 'litr', 'metr', 'tonna', 'karobka',
  'pachka', 'qop', 'boglam', 'sht', 'juft',
] as const;

const productBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().nonnegative(),
  unit: z.enum(UNITS),
  category: z.string().trim().max(80).nullable().optional(),
  photo_url: z.string().trim().nullable().optional(),
  in_stock: z.boolean().optional(),
});

// Manufacturers manage their own catalog. Staff & accountant under that
// manufacturer can VIEW it (so they can build deliveries in later phases),
// but cannot modify it. Buyers/partners can also VIEW any specific
// manufacturer's catalog read-only via GET /:manufacturerId.
function ownerIdOf(user: any): number {
  // For staff/accountant the catalog they "own" is the parent's.
  if (user.role === 'manufacturer') return user.id;
  if ((user.role === 'staff' || user.role === 'accountant') && user.parent_id) return user.parent_id;
  return user.id;
}

// LIST: own catalog (manufacturer / staff / accountant)
// Optional ?category=foo filter, ?stock=in|out for stock filter
router.get('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (!['manufacturer', 'staff', 'accountant'].includes(u.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const ownerId = ownerIdOf(u);
  const category = (req.query.category as string | undefined)?.trim();
  const stock = req.query.stock as string | undefined;

  const where: string[] = ['manufacturer_id = ?'];
  const params: unknown[] = [ownerId];
  if (category) { where.push('category = ?'); params.push(category); }
  if (stock === 'in') { where.push('in_stock = 1'); }
  if (stock === 'out') { where.push('in_stock = 0'); }

  const rows = db
    .prepare(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC`)
    .all(...(params as any[])) as ProductRow[];
  const categories = (db
    .prepare(
      `SELECT DISTINCT category FROM products WHERE manufacturer_id = ? AND category IS NOT NULL AND category != ''
       ORDER BY category`,
    )
    .all(ownerId) as { category: string }[]).map(r => r.category);
  res.json({ products: rows.map(productOut), categories });
});

// READ a single manufacturer's catalog (used by buyers/partners viewing a seller).
// For now, allow any authed user to view any manufacturer's catalog;
// once connections exist (Phase 2 in your spec) we'll restrict to connected
// pairs. The endpoint always returns only in-stock products by default
// unless ?all=1.
router.get('/by/:manufacturerId', authMiddleware, (req: AuthedRequest, res: Response) => {
  const mfgId = Number(req.params.manufacturerId);
  if (!Number.isFinite(mfgId)) return res.status(400).json({ error: 'invalid_input' });
  const manufacturer = db
    .prepare('SELECT id, role, name, nickname, avatar_url FROM users WHERE id = ?')
    .get(mfgId) as any;
  if (!manufacturer || manufacturer.role !== 'manufacturer') {
    return res.status(404).json({ error: 'not_found' });
  }
  const all = req.query.all === '1';
  const where = all ? 'manufacturer_id = ?' : 'manufacturer_id = ? AND in_stock = 1';
  const rows = db
    .prepare(`SELECT * FROM products WHERE ${where} ORDER BY created_at DESC, id DESC`)
    .all(mfgId) as ProductRow[];
  const categories = (db
    .prepare(
      `SELECT DISTINCT category FROM products WHERE manufacturer_id = ? AND category IS NOT NULL AND category != ''
       ORDER BY category`,
    )
    .all(mfgId) as { category: string }[]).map(r => r.category);
  res.json({ manufacturer, products: rows.map(productOut), categories });
});

// CREATE — manufacturers only (staff/accountant cannot edit catalog per spec)
router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'manufacturer') return res.status(403).json({ error: 'forbidden' });
  const parsed = productBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO products (manufacturer_id, name, price, unit, category, photo_url, in_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      u.id as any,
      d.name,
      d.price,
      d.unit,
      (d.category || null) as any,
      (d.photo_url || null) as any,
      (d.in_stock === false ? 0 : 1) as any,
    );
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(info.lastInsertRowid)) as ProductRow;
  res.json({ product: productOut(created) });
});

// UPDATE
router.patch('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'manufacturer') return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.manufacturer_id !== u.id) return res.status(403).json({ error: 'forbidden' });

  const parsed = productBodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const d = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (d.name !== undefined) { sets.push('name = ?'); vals.push(d.name); }
  if (d.price !== undefined) { sets.push('price = ?'); vals.push(d.price); }
  if (d.unit !== undefined) { sets.push('unit = ?'); vals.push(d.unit); }
  if (d.category !== undefined) { sets.push('category = ?'); vals.push(d.category); }
  if (d.photo_url !== undefined) {
    sets.push('photo_url = ?'); vals.push(d.photo_url);
    if (row.photo_url && row.photo_url.startsWith('/uploads/') && row.photo_url !== d.photo_url) {
      const p = path.join(UPLOAD_DIR, path.basename(row.photo_url));
      fs.promises.unlink(p).catch(() => {});
    }
  }
  if (d.in_stock !== undefined) { sets.push('in_stock = ?'); vals.push(d.in_stock ? 1 : 0); }
  if (sets.length === 0) return res.json({ product: productOut(row) });
  vals.push(id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));
  const fresh = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow;
  res.json({ product: productOut(fresh) });
});

// Quick stock toggle (in_stock flip)
router.post('/:id/toggle-stock', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'manufacturer') return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.manufacturer_id !== u.id) return res.status(403).json({ error: 'forbidden' });
  const next = row.in_stock === 1 ? 0 : 1;
  db.prepare('UPDATE products SET in_stock = ? WHERE id = ?').run(next as any, id as any);
  const fresh = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow;
  res.json({ product: productOut(fresh) });
});

// DELETE
router.delete('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'manufacturer') return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.manufacturer_id !== u.id) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (row.photo_url && row.photo_url.startsWith('/uploads/')) {
    const p = path.join(UPLOAD_DIR, path.basename(row.photo_url));
    fs.promises.unlink(p).catch(() => {});
  }
  res.json({ ok: true });
});

export default router;
