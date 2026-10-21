import { Router } from 'express';
import pool from '../db/pool.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getPayload, getQueryValue, readPagination } from '../services/format.js';

const router = Router();
const SELECT = `SELECT ts.id, ts.name, ts.description, ts.created_at AS "createdAt", ts.updated_at AS "updatedAt", ts.published_at AS "publishedAt",
 (SELECT COUNT(*)::int FROM threads t WHERE t.thread_set_id = ts.id) AS "threadCount" FROM thread_sets ts`;

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { pageSize, offset } = readPagination(req.query);
    const nameFilter = getQueryValue(req.query, 'filters[name][$containsi]') ?? getQueryValue(req.query, 'filters[name][$eq]');
    const where = [];
    const values = [];
    if (nameFilter !== undefined) {
      values.push(String(nameFilter));
      where.push(getQueryValue(req.query, 'filters[name][$eq]') !== undefined ? `ts.name = $${values.length}` : `ts.name ILIKE '%' || $${values.length} || '%'`);
    }
    const rawSort = getQueryValue(req.query, 'sort[0]') ?? req.query.sort ?? 'name:asc';
    const order = String(Array.isArray(rawSort) ? rawSort[0] : rawSort).split(':');
    const direction = order[1]?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const column = ({ name: 'ts.name', createdAt: 'ts.created_at', updatedAt: 'ts.updated_at' })[order[0]] ?? 'ts.name';
    values.push(pageSize, offset);
    const { rows } = await pool.query(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${column} ${direction} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json(rows.map((row) => ({ ...row, id: Number(row.id) })));
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SELECT} WHERE ts.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: { message: 'Thread set not found.' } });
    res.json({ ...rows[0], id: Number(rows[0].id) });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = getPayload(req.body);
    const name = String(data.name ?? '').trim();
    const description = String(data.description ?? '').trim();
    if (!name || name.length > 100) return res.status(400).json({ error: { message: 'name is required and must have at most 100 characters.' } });
    if (!description) return res.status(400).json({ error: { message: 'description is required.' } });
    const { rows } = await pool.query(`INSERT INTO thread_sets (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at AS "createdAt", updated_at AS "updatedAt", published_at AS "publishedAt"`, [name, description]);
    res.status(201).json({ ...rows[0], id: Number(rows[0].id), threadCount: 0 });
  } catch (error) { if (error.code === '23505') return res.status(409).json({ error: { message: 'A thread set with this name already exists.' } }); next(error); }
});

const updateThreadSet = async (req, res, next) => {
  try {
    const data = getPayload(req.body);
    const updates = [];
    const values = [];
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name || name.length > 100) return res.status(400).json({ error: { message: 'name must have between 1 and 100 characters.' } });
      values.push(name); updates.push(`name = $${values.length}`);
    }
    if (data.description !== undefined) {
      const description = String(data.description).trim();
      if (!description) return res.status(400).json({ error: { message: 'description cannot be empty.' } });
      values.push(description); updates.push(`description = $${values.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: { message: 'No supported fields to update.' } });
    values.push(req.params.id);
    const { rows } = await pool.query(`UPDATE thread_sets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING id, name, description, created_at AS "createdAt", updated_at AS "updatedAt", published_at AS "publishedAt"`, values);
    if (!rows[0]) return res.status(404).json({ error: { message: 'Thread set not found.' } });
    res.json({ ...rows[0], id: Number(rows[0].id) });
  } catch (error) { if (error.code === '23505') return res.status(409).json({ error: { message: 'A thread set with this name already exists.' } }); next(error); }
};

router.patch('/:id', requireAuth, updateThreadSet);
router.put('/:id', requireAuth, updateThreadSet);

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM thread_sets WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: { message: 'Thread set not found.' } });
    res.json({ id: Number(req.params.id), deleted: true });
  } catch (error) { next(error); }
});

export default router;
