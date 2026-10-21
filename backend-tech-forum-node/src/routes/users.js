import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { getPayload, getQueryValue, publicUser, readPagination } from '../services/format.js';

const router = Router();

const USER_SELECT = `SELECT u.id, u.username, u.email, u.confirmed, u.blocked, u.created_at AS "createdAt", u.updated_at AS "updatedAt",
 CASE WHEN f.id IS NULL THEN NULL ELSE json_build_object('id',f.id,'name',f.name,'url',f.url,'mime',f.mime,'size',f.size) END AS image
 FROM users u LEFT JOIN uploads f ON f.id = u.image_id`;

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${USER_SELECT} WHERE u.id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: { message: 'User not found.' } });
    res.json(publicUser(rows[0]));
  } catch (error) { next(error); }
});

const updateMe = async (req, res, next) => {
  try {
    const data = getPayload(req.body);
    const updates = [];
    const values = [];
    const add = (column, value) => { values.push(value); updates.push(`${column} = $${values.length}`); };

    if (data.username !== undefined) {
      const username = String(data.username).trim();
      if (username.length < 3) return res.status(400).json({ error: { message: 'Username must have at least 3 characters.' } });
      add('username', username);
    }
    if (data.email !== undefined) {
      const email = String(data.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: { message: 'A valid email is required.' } });
      add('email', email);
    }
    if (data.password !== undefined) {
      if (String(data.password).length < 6) return res.status(400).json({ error: { message: 'Password must have at least 6 characters.' } });
      add('password', await bcrypt.hash(String(data.password), 12));
    }
    if (data.image !== undefined) {
      let imageId = data.image === null ? null : (typeof data.image === 'object' ? data.image.id : data.image);
      if (imageId !== null) {
        imageId = Number(imageId);
        if (!Number.isSafeInteger(imageId) || imageId <= 0) return res.status(400).json({ error: { message: 'image must be an upload ID, an object with an id, or null.' } });
        const asset = await pool.query('SELECT id FROM uploads WHERE id = $1', [imageId]);
        if (!asset.rowCount) return res.status(400).json({ error: { message: 'Uploaded image not found.' } });
      }
      add('image_id', imageId);
    }
    if (updates.length === 0) return res.status(400).json({ error: { message: 'No supported fields to update.' } });

    values.push(req.user.id);
    const updateResult = await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING id`, values);
    if (!updateResult.rowCount) return res.status(404).json({ error: { message: 'User not found.' } });
    const { rows } = await pool.query(`${USER_SELECT} WHERE u.id = $1`, [req.user.id]);
    res.json(publicUser(rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: { message: 'Username or email is already in use.' } });
    next(error);
  }
};

router.patch('/me', requireAuth, updateMe);
router.put('/me', requireAuth, updateMe);

// Public profile listing. Passwords and private tokens are never selected.
router.get('/', async (req, res, next) => {
  try {
    const { page, pageSize, offset } = readPagination(req.query);
    const q = String(getQueryValue(req.query, 'filters[username][$containsi]') ?? req.query.search ?? '').trim();
    const { rows } = await pool.query(
      `${USER_SELECT} ${q ? 'WHERE u.username ILIKE $1' : ''} ORDER BY u.username ASC LIMIT $${q ? 2 : 1} OFFSET $${q ? 3 : 2}`,
      q ? [`%${q}%`, pageSize, offset] : [pageSize, offset]
    );
    res.json(rows.map(publicUser));
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: { message: 'Invalid user ID.' } });
    const { rows } = await pool.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: { message: 'User not found.' } });
    res.json(publicUser(rows[0]));
  } catch (error) { next(error); }
});

export default router;
