import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AuthedRequest, authMiddleware } from '../auth';

const router = Router();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('invalid_image'));
  },
});

function extFor(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

// Generic image upload: accepts ?kind=product|story|reward (any short tag).
// Returns { url } that the caller stores in the corresponding row.
router.post('/image', authMiddleware, upload.single('image'), (req: AuthedRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const kind = (req.query.kind as string || 'img').replace(/[^a-z0-9_-]/gi, '').slice(0, 16) || 'img';
  const ext = extFor(req.file.mimetype);
  const filename = `${kind}_${req.user!.id}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  try {
    fs.writeFileSync(filepath, req.file.buffer);
    res.json({ url: `/uploads/${filename}` });
  } catch (e) {
    console.error('upload failed', e);
    res.status(500).json({ error: 'upload_failed' });
  }
});

export default router;
