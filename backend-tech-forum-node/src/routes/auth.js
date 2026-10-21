import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { optionalAuth } from '../middleware/auth.js';
import { getPayload, publicUser } from '../services/format.js';

const router = Router();

function jwtSecret() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_this_with_a_long_random_secret')) {
    throw new Error('Configure JWT_SECRET before running in production.');
  }
  return process.env.JWT_SECRET || 'development-only-secret-change-me';
}

function createToken(user) {
  return jwt.sign({ id: Number(user.id), username: user.username }, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function findPublicUserById(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.email, u.confirmed, u.blocked, u.created_at AS "createdAt", u.updated_at AS "updatedAt",
       CASE WHEN f.id IS NULL THEN NULL ELSE json_build_object('id', f.id, 'name', f.name, 'url', f.url, 'mime', f.mime, 'size', f.size) END AS image
     FROM users u LEFT JOIN uploads f ON f.id = u.image_id WHERE u.id = $1`, [id]
  );
  return rows[0] ? publicUser(rows[0]) : null;
}

// Strapi users-permissions compatible endpoint: POST /api/auth/local/register
router.post('/local/register', async (req, res, next) => {
  try {
    const data = getPayload(req.body);
    const username = String(data.username ?? '').trim();
    const email = String(data.email ?? '').trim().toLowerCase();
    const password = String(data.password ?? '');
    if (username.length < 3) return res.status(400).json({ error: { message: 'Username must have at least 3 characters.' } });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: { message: 'A valid email is required.' } });
    if (password.length < 6) return res.status(400).json({ error: { message: 'Password must have at least 6 characters.' } });

    const hashedPassword = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, $3)
       RETURNING id, username, email, confirmed, blocked, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [username, email, hashedPassword]
    );
    const user = publicUser(rows[0]);
    return res.status(201).json({ jwt: createToken(rows[0]), user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: { message: 'Username or email is already registered.' } });
    next(error);
  }
});

// Strapi users-permissions compatible endpoint: POST /api/auth/local
router.post('/local', async (req, res, next) => {
  try {
    const data = getPayload(req.body);
    const identifier = String(data.identifier ?? data.email ?? data.username ?? '').trim();
    const password = String(data.password ?? '');
    if (!identifier || !password) return res.status(400).json({ error: { message: 'Identifier and password are required.' } });

    const { rows } = await pool.query(
      'SELECT id, username, email, password, blocked FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) LIMIT 1',
      [identifier]
    );
    const userRow = rows[0];
    if (!userRow || userRow.blocked || !(await bcrypt.compare(password, userRow.password))) {
      return res.status(400).json({ error: { message: 'Invalid identifier or password.' } });
    }
    return res.json({ jwt: createToken(userRow), user: await findPublicUserById(userRow.id) });
  } catch (error) {
    next(error);
  }
});

// Convenience alias for API clients that use /api/auth/me.
router.get('/me', optionalAuth, async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: { message: 'Authentication required.' } });
  try {
    const user = await findPublicUserById(req.user.id);
    if (!user) return res.status(404).json({ error: { message: 'User not found.' } });
    res.json(user);
  } catch (error) { next(error); }
});

export default router;
