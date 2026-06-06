import { Router, Response } from 'express';
import { z } from 'zod';
import { db, userBrief, UserRow } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';
import { manufacturerContext, buyerContext } from '../context';

const router = Router();

const ACTIVE = `created_at >= datetime('now','-1 day')`;

type StoryRow = {
  id: number;
  manufacturer_id: number;
  type: string;
  title: string;
  description: string | null;
  discount_percent: number | null;
  photo_url: string | null;
  created_at: string;
};

/**
 * Active (last 24h) stories.
 *  - seller side: one group with own stories, canCreate=true
 *  - buyer side: a group per connected manufacturer that has active stories
 */
router.get('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const mfg = manufacturerContext(u);
  const buyer = buyerContext(u);

  if (mfg != null) {
    const stories = db.prepare(`SELECT * FROM stories WHERE manufacturer_id = ? AND ${ACTIVE} ORDER BY created_at DESC`).all(mfg) as StoryRow[];
    return res.json({ groups: stories.length ? [{ manufacturer: userBrief(mfg), stories }] : [], canCreate: u.role === 'manufacturer' });
  }

  if (buyer != null) {
    const mfgIds = db.prepare('SELECT manufacturer_id FROM connections WHERE buyer_id = ?').all(buyer) as { manufacturer_id: number }[];
    const groups = [];
    for (const { manufacturer_id } of mfgIds) {
      const stories = db.prepare(`SELECT * FROM stories WHERE manufacturer_id = ? AND ${ACTIVE} ORDER BY created_at DESC`).all(manufacturer_id) as StoryRow[];
      if (stories.length) groups.push({ manufacturer: userBrief(manufacturer_id), stories });
    }
    return res.json({ groups, canCreate: false });
  }

  res.json({ groups: [], canCreate: false });
});

const createSchema = z.object({
  type: z.enum(['news', 'discount', 'product']).default('news'),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  photo_url: z.string().trim().max(300).nullable().optional(),
});

router.post('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'manufacturer') return res.status(403).json({ error: 'forbidden' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { type, title, description, discount_percent, photo_url } = parsed.data;

  const info = db
    .prepare(`INSERT INTO stories (manufacturer_id, type, title, description, discount_percent, photo_url)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(u.id as any, type, title, (description ?? null) as any, (discount_percent ?? null) as any, (photo_url ?? null) as any);
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(Number(info.lastInsertRowid));
  res.json({ story });
});

router.delete('/:id', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const id = Number(req.params.id);
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as StoryRow | undefined;
  if (!story) return res.status(404).json({ error: 'not_found' });
  if (story.manufacturer_id !== u.id) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM stories WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
