import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value === 'replace_this_with_a_long_random_secret') {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set to a secure random value in production.');
  }
  return value || 'development-only-secret-change-me';
}

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice(7), secret());
    const result = await pool.query('SELECT id, username, email, blocked FROM users WHERE id = $1', [payload.id]);
    const user = result.rows[0];
    if (user && !user.blocked) req.user = { id: Number(user.id), username: user.username, email: user.email };
  } catch {
    // Optional auth should not block public read routes.
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: { message: 'Authentication required.' } });
  next();
}

export function requireOwnerOrAdmin(getOwnerId) {
  return (req, res, next) => {
    Promise.resolve(getOwnerId(req))
      .then((ownerId) => {
        if (ownerId === null || ownerId === undefined) return res.status(404).json({ error: { message: 'Resource not found.' } });
        if (Number(ownerId) !== Number(req.user?.id)) return res.status(403).json({ error: { message: 'You can only modify your own content.' } });
        next();
      })
      .catch(next);
  };
}
