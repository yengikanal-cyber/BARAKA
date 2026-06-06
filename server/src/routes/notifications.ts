import { Router, Response } from 'express';
import { db } from '../db';
import { AuthedRequest, authMiddleware } from '../auth';

const router = Router();

type NotifRow = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string | null;
  data: string | null;
  is_read: number;
  created_at: string;
};

function out(n: NotifRow) {
  let data: Record<string, unknown> | null = null;
  if (n.data) { try { data = JSON.parse(n.data); } catch { data = null; } }
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data,
    is_read: n.is_read === 1,
    created_at: n.created_at,
  };
}

/** Full list (most recent 100) + unread count. */
router.get('/', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100')
    .all(u.id) as NotifRow[];
  const unread = (db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(u.id) as { c: number }).c;
  res.json({ notifications: rows.map(out), unread });
});

/** Lightweight unread count for the live badge. */
router.get('/unread-count', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const unread = (db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(u.id) as { c: number }).c;
  res.json({ unread });
});

/** Mark all as read. */
router.post('/read-all', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(u.id);
  res.json({ ok: true });
});

/** Mark a single notification as read. */
router.post('/:id/read', authMiddleware, (req: AuthedRequest, res: Response) => {
  const u = req.user!;
  const id = Number(req.params.id);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id as any, u.id);
  res.json({ ok: true });
});

export default router;
