import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const uploadDir = path.resolve('public/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const maxFileSize = Math.max(1, Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 5)) * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = (path.extname(file.originalname).slice(0, 10) || ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' }[file.mimetype] ?? '.img')).toLowerCase();
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});
const multerUpload = multer({
  storage,
  limits: { fileSize: maxFileSize, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only JPEG, PNG, WebP, GIF, and AVIF images are supported.');
      error.code = 'UNSUPPORTED_IMAGE_TYPE';
      return callback(error);
    }
    callback(null, true);
  }
});

// Compatible with Strapi's POST /api/upload. Send multipart/form-data with `files`.
router.post('/', requireAuth, (req, res, next) => {
  multerUpload.array('files', 5)(req, res, async (error) => {
    if (error) return next(error);
    try {
      const files = req.files ?? [];
      if (!files.length) return res.status(400).json({ error: { message: 'Send at least one image using the multipart field "files".' } });
      const created = [];
      for (const file of files) {
        if (!allowedMimeTypes.has(file.mimetype)) {
          fs.rmSync(file.path, { force: true });
          return res.status(415).json({ error: { message: 'Only JPEG, PNG, WebP, GIF, and AVIF images are supported.' } });
        }
        const url = `/uploads/${file.filename}`;
        const { rows } = await pool.query(
          'INSERT INTO uploads (name, url, mime, size, created_by_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, url, mime, size, created_at AS "createdAt"',
          [file.originalname, url, file.mimetype, file.size, req.user.id]
        );
        created.push({ ...rows[0], id: Number(rows[0].id) });
      }
      res.status(201).json(created);
    } catch (caught) {
      for (const file of req.files ?? []) fs.rmSync(file.path, { force: true });
      next(caught);
    }
  });
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, url, created_by_user_id FROM uploads WHERE id = $1', [req.params.id]);
    const file = rows[0];
    if (!file) return res.status(404).json({ error: { message: 'Upload not found.' } });
    if (Number(file.created_by_user_id) !== Number(req.user.id)) return res.status(403).json({ error: { message: 'You can only delete your own uploads.' } });
    await pool.query('DELETE FROM uploads WHERE id = $1', [file.id]);
    const safeName = path.basename(file.url);
    fs.rmSync(path.join(uploadDir, safeName), { force: true });
    res.json({ id: Number(file.id), deleted: true });
  } catch (error) { next(error); }
});

export default router;
