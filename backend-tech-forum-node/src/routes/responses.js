import { Router } from 'express';
import pool from '../db/pool.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getPayload, getQueryValue, relationId, readPagination } from '../services/format.js';

const router = Router();
const SELECT = `SELECT r.id, r.content, r.created_at AS "createdAt", r.updated_at AS "updatedAt", r.published_at AS "publishedAt",
 CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id',u.id,'username',u.username,
   'image',CASE WHEN f.id IS NULL THEN NULL ELSE json_build_object('id',f.id,'name',f.name,'url',f.url) END) END AS author,
 CASE WHEN t.id IS NULL THEN NULL ELSE json_build_object('id',t.id,'title',t.title) END AS thread
 FROM responses r LEFT JOIN users u ON u.id = r.author_id LEFT JOIN uploads f ON f.id = u.image_id LEFT JOIN threads t ON t.id = r.thread_id`;

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { pageSize, offset } = readPagination(req.query);
    const where = [];
    const values = [];
    const threadId = getQueryValue(req.query, 'filters[thread][id][$eq]') ?? getQueryValue(req.query, 'filters[thread][$eq]') ?? req.query.threadId;
    if (threadId !== undefined) { values.push(Number(threadId)); where.push(`r.thread_id = $${values.length}`); }
    const authorId = getQueryValue(req.query, 'filters[author][id][$eq]') ?? req.query.authorId;
    if (authorId !== undefined) { values.push(Number(authorId)); where.push(`r.author_id = $${values.length}`); }
    const contains = getQueryValue(req.query, 'filters[content][$containsi]') ?? req.query.search;
    if (contains !== undefined) { values.push(String(contains)); where.push(`r.content ILIKE '%' || $${values.length} || '%'`); }
    values.push(pageSize, offset);
    const { rows } = await pool.query(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.created_at ASC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json(rows.map((row) => ({ ...row, id: Number(row.id) })));
  } catch (error) { next(error); }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SELECT} WHERE r.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: { message: 'Response not found.' } });
    res.json({ ...rows[0], id: Number(rows[0].id) });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = getPayload(req.body);
    const content = String(data.content ?? '').trim();
    const threadId = relationId(data.thread ?? data.threadId ?? data.thread_id);
    if (!content) return res.status(400).json({ error: { message: 'content is required.' } });
    if (!threadId) return res.status(400).json({ error: { message: 'thread is required.' } });
    const thread = await pool.query('SELECT id FROM threads WHERE id = $1', [threadId]);
    if (!thread.rowCount) return res.status(400).json({ error: { message: 'thread does not exist.' } });
    const { rows } = await pool.query('INSERT INTO responses (content, thread_id, author_id) VALUES ($1, $2, $3) RETURNING id', [content, threadId, req.user.id]);
    const detailed = await pool.query(`${SELECT} WHERE r.id = $1`, [rows[0].id]);
    res.status(201).json({ ...detailed.rows[0], id: Number(detailed.rows[0].id) });
  } catch (error) { next(error); }
});

const updateResponse = async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT author_id FROM responses WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: { message: 'Response not found.' } });
    if (Number(existing.rows[0].author_id) !== Number(req.user.id)) return res.status(403).json({ error: { message: 'You can only modify your own responses.' } });
    const data = getPayload(req.body);
    const content = String(data.content ?? '').trim();
    if (!content) return res.status(400).json({ error: { message: 'content is required.' } });
    await pool.query('UPDATE responses SET content = $1, updated_at = NOW() WHERE id = $2', [content, req.params.id]);
    const { rows } = await pool.query(`${SELECT} WHERE r.id = $1`, [req.params.id]);
    res.json({ ...rows[0], id: Number(rows[0].id) });
  } catch (error) { next(error); }
};

router.patch('/:id', requireAuth, updateResponse);
router.put('/:id', requireAuth, updateResponse);

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT author_id FROM responses WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: { message: 'Response not found.' } });
    if (Number(existing.rows[0].author_id) !== Number(req.user.id)) return res.status(403).json({ error: { message: 'You can only delete your own responses.' } });
    await pool.query('DELETE FROM responses WHERE id = $1', [req.params.id]);
    res.json({ id: Number(req.params.id), deleted: true });
  } catch (error) { next(error); }
});

export default router;
