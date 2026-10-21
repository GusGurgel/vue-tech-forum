import { Router } from 'express';
import pool from '../db/pool.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getPayload, getQueryValue, relationId, readPagination } from '../services/format.js';

const router = Router();
const THREAD_SELECT = `SELECT t.id, t.title, t.is_fixed AS "isFixed", t.created_at AS "createdAt", t.updated_at AS "updatedAt", t.published_at AS "publishedAt",
 CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id',u.id,'username',u.username,
   'image', CASE WHEN uf.id IS NULL THEN NULL ELSE json_build_object('id',uf.id,'name',uf.name,'url',uf.url,'mime',uf.mime,'size',uf.size) END) END AS author,
 CASE WHEN ts.id IS NULL THEN NULL ELSE json_build_object('id',ts.id,'name',ts.name,'description',ts.description) END AS thread_set,
 COALESCE((SELECT json_agg(json_build_object('id',r.id,'content',r.content,'createdAt',r.created_at,'updatedAt',r.updated_at,'publishedAt',r.published_at,
   'author', CASE WHEN ru.id IS NULL THEN NULL ELSE json_build_object('id',ru.id,'username',ru.username,
     'image', CASE WHEN ruf.id IS NULL THEN NULL ELSE json_build_object('id',ruf.id,'url',ruf.url,'name',ruf.name) END) END)
   ORDER BY r.created_at ASC) FROM responses r LEFT JOIN users ru ON ru.id = r.author_id LEFT JOIN uploads ruf ON ruf.id = ru.image_id WHERE r.thread_id = t.id), '[]'::json) AS responses
 FROM threads t LEFT JOIN users u ON u.id = t.author_id LEFT JOIN uploads uf ON uf.id = u.image_id LEFT JOIN thread_sets ts ON ts.id = t.thread_set_id`;

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { pageSize, offset } = readPagination(req.query);
    const where = [];
    const values = [];
    const title = getQueryValue(req.query, 'filters[title][$containsi]') ?? req.query.search;
    const titleEq = getQueryValue(req.query, 'filters[title][$eq]');
    if (title !== undefined || titleEq !== undefined) {
      values.push(String(titleEq ?? title));
      where.push(titleEq !== undefined ? `t.title = $${values.length}` : `t.title ILIKE '%' || $${values.length} || '%'`);
    }
    const fixed = getQueryValue(req.query, 'filters[isFixed][$eq]') ?? getQueryValue(req.query, 'filters[is_fixed][$eq]');
    if (fixed !== undefined) { values.push(String(fixed).toLowerCase() === 'true'); where.push(`t.is_fixed = $${values.length}`); }
    const setId = getQueryValue(req.query, 'filters[thread_set][id][$eq]') ?? getQueryValue(req.query, 'filters[thread_set][$eq]') ?? req.query.threadSetId;
    if (setId !== undefined) { values.push(Number(setId)); where.push(`t.thread_set_id = $${values.length}`); }
    const authorId = getQueryValue(req.query, 'filters[author][id][$eq]') ?? req.query.authorId;
    if (authorId !== undefined) { values.push(Number(authorId)); where.push(`t.author_id = $${values.length}`); }

    const rawSort = getQueryValue(req.query, 'sort[0]') ?? req.query.sort ?? 'createdAt:desc';
    const sortText = Array.isArray(rawSort) ? rawSort[0] : rawSort;
    const [sortField, sortDirection] = String(sortText).split(':');
    const sortColumn = ({ createdAt: 't.created_at', updatedAt: 't.updated_at', title: 't.title', isFixed: 't.is_fixed' })[sortField] ?? 't.created_at';
    const dir = sortDirection?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    values.push(pageSize, offset);
    const { rows } = await pool.query(`${THREAD_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.is_fixed DESC, ${sortColumn} ${dir} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json(rows.map((row) => ({ ...row, id: Number(row.id), responses: (row.responses ?? []).map((r) => ({ ...r, id: Number(r.id) })) })));
  } catch (error) { next(error); }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${THREAD_SELECT} WHERE t.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: { message: 'Thread not found.' } });
    res.json({ ...rows[0], id: Number(rows[0].id), responses: (rows[0].responses ?? []).map((r) => ({ ...r, id: Number(r.id) })) });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = getPayload(req.body);
    const title = String(data.title ?? '').trim();
    if (!title || title.length > 200) return res.status(400).json({ error: { message: 'title is required and must have at most 200 characters.' } });
    const setId = relationId(data.thread_set ?? data.threadSetId ?? data.thread_set_id);
    if (setId !== null) {
      const set = await pool.query('SELECT id FROM thread_sets WHERE id = $1', [setId]);
      if (!set.rowCount) return res.status(400).json({ error: { message: 'thread_set does not exist.' } });
    }
    const { rows } = await pool.query(`INSERT INTO threads (title, is_fixed, thread_set_id, author_id) VALUES ($1, $2, $3, $4)
      RETURNING id, title, is_fixed AS "isFixed", thread_set_id, author_id, created_at AS "createdAt", updated_at AS "updatedAt", published_at AS "publishedAt"`,
      [title, data.isFixed === true, setId, req.user.id]);
    const thread = rows[0];
    const detailed = await pool.query(`${THREAD_SELECT} WHERE t.id = $1`, [thread.id]);
    res.status(201).json({ ...detailed.rows[0], id: Number(detailed.rows[0].id), responses: detailed.rows[0].responses ?? [] });
  } catch (error) { next(error); }
});

const updateThread = async (req, res, next) => {
  try {
    const current = await pool.query('SELECT id, author_id FROM threads WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: { message: 'Thread not found.' } });
    if (Number(current.rows[0].author_id) !== Number(req.user.id)) return res.status(403).json({ error: { message: 'You can only modify your own threads.' } });
    const data = getPayload(req.body);
    const updates = [];
    const values = [];
    if (data.title !== undefined) {
      const title = String(data.title).trim();
      if (!title || title.length > 200) return res.status(400).json({ error: { message: 'title must have between 1 and 200 characters.' } });
      values.push(title); updates.push(`title = $${values.length}`);
    }
    if (data.isFixed !== undefined) { values.push(Boolean(data.isFixed)); updates.push(`is_fixed = $${values.length}`); }
    if (data.thread_set !== undefined || data.threadSetId !== undefined || data.thread_set_id !== undefined) {
      const setId = relationId(data.thread_set ?? data.threadSetId ?? data.thread_set_id);
      if (setId !== null) {
        const set = await pool.query('SELECT id FROM thread_sets WHERE id = $1', [setId]);
        if (!set.rowCount) return res.status(400).json({ error: { message: 'thread_set does not exist.' } });
      }
      values.push(setId); updates.push(`thread_set_id = $${values.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: { message: 'No supported fields to update.' } });
    values.push(req.params.id);
    await pool.query(`UPDATE threads SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`, values);
    const { rows } = await pool.query(`${THREAD_SELECT} WHERE t.id = $1`, [req.params.id]);
    res.json({ ...rows[0], id: Number(rows[0].id), responses: rows[0].responses ?? [] });
  } catch (error) { next(error); }
};

router.patch('/:id', requireAuth, updateThread);
router.put('/:id', requireAuth, updateThread);

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const current = await pool.query('SELECT author_id FROM threads WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: { message: 'Thread not found.' } });
    if (Number(current.rows[0].author_id) !== Number(req.user.id)) return res.status(403).json({ error: { message: 'You can only delete your own threads.' } });
    await pool.query('DELETE FROM threads WHERE id = $1', [req.params.id]);
    res.json({ id: Number(req.params.id), deleted: true });
  } catch (error) { next(error); }
});

export default router;
