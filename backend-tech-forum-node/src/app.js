require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 1337);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-this-before-deploying';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

app.set('query parser', 'extended');
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN && process.env.FRONTEND_ORIGIN !== '*'
    ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim())
    : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Some versions of the existing Axios module use http://localhost:1337/api as
// their baseURL (Strapi's default). Strip that optional prefix so both /x and
// /api/x work without requiring frontend changes.
app.use((req, _res, next) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api(?=\/|$)/, '') || '/';
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '1h' }));

class ApiError extends Error {
  constructor(status, message, name = 'ApplicationError', details = {}) {
    super(message);
    this.status = status;
    this.name = name;
    this.details = details;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function fail(status, message, name, details) {
  throw new ApiError(status, message, name, details);
}

function resultData(res, data, status = 200) {
  return res.status(status).json({ data, meta: {} });
}

function listData(res, data, total, page, pageSize) {
  return res.json({
    data,
    meta: { pagination: { page, pageSize, pageCount: pageSize ? Math.ceil(total / pageSize) : 0, total } },
  });
}

function parseInput(req) {
  const body = req.body || {};
  if (Object.prototype.hasOwnProperty.call(body, 'data')) {
    if (typeof body.data === 'string') {
      try {
        return JSON.parse(body.data);
      } catch {
        fail(400, 'The "data" field must contain valid JSON.', 'ValidationError');
      }
    }
    if (body.data && typeof body.data === 'object') return body.data;
  }
  return body;
}

const fieldParser = multer().none();
function parseMultipartFields(req, res, next) {
  if (req.is('multipart/form-data')) return fieldParser(req, res, next);
  next();
}

function numericId(value) {
  if (value && typeof value === 'object') value = value.id;
  if (value === undefined || value === null || value === '') return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function readRelationFilter(req, relation) {
  const nested = req.query?.filters?.[relation]?.id?.$eq;
  const raw = req.query?.[`filters[${relation}][id][$eq]`];
  return numericId(Array.isArray(nested) ? nested[0] : (nested ?? raw));
}

function getSorts(req, allowedFields, defaults = [{ createdAt: 'desc' }]) {
  let sort = req.query?.sort ?? req.query?.['sort[]'];
  if (sort === undefined) {
    const indexed = Object.entries(req.query || {})
      .filter(([key]) => /^sort\[\d+\]$/.test(key))
      .sort(([a], [b]) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
      .map(([, value]) => value);
    sort = indexed.length ? indexed : undefined;
  }
  if (sort === undefined) return defaults;
  if (!Array.isArray(sort)) sort = [sort];
  const orderBy = [];
  for (const item of sort) {
    if (typeof item !== 'string') continue;
    const [field, directionRaw] = item.split(':');
    if (!allowedFields.includes(field)) continue;
    const direction = String(directionRaw || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    orderBy.push({ [field]: direction });
  }
  return orderBy.length ? orderBy : defaults;
}

function pageOptions(req) {
  const rawLimit = req.query?.pagination?.limit ?? req.query?.['pagination[limit]'];
  const rawPage = req.query?.pagination?.page ?? req.query?.['pagination[page]'];
  const limitValue = Number(rawLimit ?? 1000);
  const pageSize = Number.isFinite(limitValue) ? Math.max(1, Math.min(1000, Math.trunc(limitValue))) : 1000;
  const pageValue = Number(rawPage ?? 1);
  const page = Number.isFinite(pageValue) ? Math.max(1, Math.trunc(pageValue)) : 1;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function imageDto(image) {
  if (!image) return null;
  return {
    id: image.id,
    name: image.name,
    url: image.url,
    mime: image.mimeType,
    size: image.size,
  };
}

function userDto(user, { includeEmail = true } = {}) {
  if (!user) return null;
  const roleType = user.role || 'authenticated';
  return {
    id: user.id,
    username: user.username,
    ...(includeEmail ? { email: user.email } : {}),
    blocked: user.blocked,
    role: {
      id: roleType === 'admin' ? 1 : 2,
      name: roleType === 'admin' ? 'admin' : 'Authenticated',
      type: roleType,
    },
    image: imageDto(user.image),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function threadSetDto(threadSet) {
  if (!threadSet) return null;
  return {
    id: threadSet.id,
    name: threadSet.name,
    description: threadSet.description,
    createdAt: threadSet.createdAt,
    updatedAt: threadSet.updatedAt,
  };
}

function threadDto(thread) {
  if (!thread) return null;
  return {
    id: thread.id,
    title: thread.title,
    isFixed: thread.isFixed,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    thread_set: thread.threadSet ? threadSetDto(thread.threadSet) : null,
    author: thread.author ? userDto(thread.author) : null,
  };
}

function responseDto(response) {
  if (!response) return null;
  return {
    id: response.id,
    content: response.content,
    body: response.content,
    text: response.content,
    response: response.content,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    thread: response.thread ? {
      id: response.thread.id,
      title: response.thread.title,
      createdAt: response.thread.createdAt,
    } : null,
    author: response.author ? userDto(response.author) : null,
  };
}

const userInclude = { image: true };
const threadInclude = {
  threadSet: true,
  author: { include: userInclude },
};
const responseInclude = {
  thread: true,
  author: { include: userInclude },
};

async function findTokenUser(token) {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    fail(401, 'Invalid or expired authentication token.', 'UnauthorizedError');
  }
  const id = numericId(payload.id ?? payload.sub);
  if (!id) fail(401, 'Invalid authentication token.', 'UnauthorizedError');
  const user = await prisma.user.findUnique({ where: { id }, include: userInclude });
  if (!user) fail(401, 'The account associated with this token no longer exists.', 'UnauthorizedError');
  if (user.blocked) fail(403, 'This account has been blocked.', 'ForbiddenError');
  return user;
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return fail(401, 'Authentication is required for this action.', 'UnauthorizedError');
  req.user = await findTokenUser(match[1]);
  next();
});

const requireAdmin = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return fail(401, 'Authentication is required for this action.', 'UnauthorizedError');
  req.user = await findTokenUser(match[1]);
  if (req.user.role !== 'admin') return fail(403, 'Administrator permissions are required.', 'ForbiddenError');
  next();
});

function requireOwnerOrAdmin(ownerId, currentUser) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.id !== ownerId)) {
    fail(403, 'You do not have permission to perform this action.', 'ForbiddenError');
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'tech-forum-backend' }));

// -----------------------------------------------------------------------------
// Authentication: shaped to match the Strapi-style endpoints used by the Vue UI.
// -----------------------------------------------------------------------------
app.post('/auth/local/register', asyncHandler(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (username.length < 3) fail(400, 'Username must contain at least 3 characters.', 'ValidationError');
  if (!validEmail(email)) fail(400, 'Please provide a valid email address.', 'ValidationError');
  if (password.length < 6) fail(400, 'Password must contain at least 6 characters.', 'ValidationError');

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) {
    const field = existing.email === email ? 'email' : 'username';
    fail(409, `An account with this ${field} already exists.`, 'ConflictError', { field });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: 'authenticated' },
    include: userInclude,
  });
  const token = jwt.sign({ id: user.id, sub: String(user.id) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ jwt: token, user: userDto(user) });
}));

app.post('/auth/local', asyncHandler(async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim();
  const password = String(req.body?.password || '');
  if (!identifier || !password) fail(400, 'Identifier and password are required.', 'ValidationError');

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: normalizeEmail(identifier) }, { username: identifier }] },
    include: userInclude,
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    fail(400, 'Invalid identifier or password.', 'ValidationError');
  }
  if (user.blocked) fail(403, 'This account has been blocked.', 'ForbiddenError');

  const token = jwt.sign({ id: user.id, sub: String(user.id) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ jwt: token, user: userDto(user) });
}));

app.get('/users/me', requireAuth, asyncHandler(async (req, res) => {
  res.json(userDto(req.user));
}));

// The frontend expects GET /users to return a bare array, unlike collection content routes.
app.get('/users', requireAdmin, asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ createdAt: 'desc' }], include: userInclude });
  res.json(users.map((user) => userDto(user)));
}));

app.get('/users/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid user ID.', 'ValidationError');
  const target = await prisma.user.findUnique({ where: { id }, include: userInclude });
  if (!target) fail(404, 'User not found.', 'NotFoundError');
  if (req.user.role !== 'admin' && req.user.id !== id) fail(403, 'You cannot view this user.', 'ForbiddenError');
  res.json(userDto(target));
}));

app.put('/users/:id', parseMultipartFields, requireAuth, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid user ID.', 'ValidationError');
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) fail(404, 'User not found.', 'NotFoundError');
  requireOwnerOrAdmin(target.id, req.user);

  const input = parseInput(req);
  const data = {};
  if (input.username !== undefined) {
    const username = String(input.username).trim();
    if (username.length < 3) fail(400, 'Username must contain at least 3 characters.', 'ValidationError');
    const duplicate = await prisma.user.findFirst({ where: { username, NOT: { id } } });
    if (duplicate) fail(409, 'This username is already in use.', 'ConflictError');
    data.username = username;
  }
  if (input.email !== undefined && req.user.role === 'admin') {
    const email = normalizeEmail(input.email);
    if (!validEmail(email)) fail(400, 'Please provide a valid email address.', 'ValidationError');
    const duplicate = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (duplicate) fail(409, 'This email address is already in use.', 'ConflictError');
    data.email = email;
  }
  if (input.image !== undefined) {
    if (input.image === null || input.image === '') data.imageId = null;
    else {
      const imageId = numericId(input.image);
      if (!imageId) fail(400, 'Invalid image ID.', 'ValidationError');
      const image = await prisma.uploadedFile.findUnique({ where: { id: imageId } });
      if (!image) fail(404, 'Image not found.', 'NotFoundError');
      data.imageId = imageId;
    }
  }
  if (input.blocked !== undefined) {
    if (req.user.role !== 'admin') fail(403, 'Only administrators can block or unblock users.', 'ForbiddenError');
    if (target.id === req.user.id && booleanValue(input.blocked)) fail(400, 'You cannot block your own account.', 'ValidationError');
    data.blocked = booleanValue(input.blocked);
  }
  if (input.role !== undefined) {
    if (req.user.role !== 'admin') fail(403, 'Only administrators can change account roles.', 'ForbiddenError');
    if (!['admin', 'authenticated'].includes(String(input.role))) fail(400, 'Invalid role.', 'ValidationError');
    data.role = String(input.role);
  }

  const updated = await prisma.user.update({ where: { id }, data, include: userInclude });
  resultData(res, userDto(updated));
}));

// -----------------------------------------------------------------------------
// Thread sets (called "thread-sets" in the frontend).
// -----------------------------------------------------------------------------
app.get('/thread-sets', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pageOptions(req);
  const orderBy = getSorts(req, ['name', 'createdAt', 'updatedAt'], [{ name: 'asc' }]);
  const [total, records] = await Promise.all([
    prisma.threadSet.count(),
    prisma.threadSet.findMany({ orderBy, skip, take: pageSize }),
  ]);
  listData(res, records.map(threadSetDto), total, page, pageSize);
}));

app.get('/thread-sets/:id', asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid thread set ID.', 'ValidationError');
  const record = await prisma.threadSet.findUnique({ where: { id } });
  if (!record) fail(404, 'Thread set not found.', 'NotFoundError');
  resultData(res, threadSetDto(record));
}));

app.post('/thread-sets', parseMultipartFields, requireAdmin, asyncHandler(async (req, res) => {
  const input = parseInput(req);
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  if (!name || !description) fail(400, 'Name and description are required.', 'ValidationError');
  const duplicate = await prisma.threadSet.findUnique({ where: { name } });
  if (duplicate) fail(409, 'A thread set with this name already exists.', 'ConflictError');
  const record = await prisma.threadSet.create({ data: { name, description } });
  resultData(res, threadSetDto(record), 201);
}));

app.put('/thread-sets/:id', parseMultipartFields, requireAdmin, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid thread set ID.', 'ValidationError');
  const existing = await prisma.threadSet.findUnique({ where: { id } });
  if (!existing) fail(404, 'Thread set not found.', 'NotFoundError');
  const input = parseInput(req);
  const data = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) fail(400, 'Name cannot be empty.', 'ValidationError');
    const duplicate = await prisma.threadSet.findFirst({ where: { name, NOT: { id } } });
    if (duplicate) fail(409, 'A thread set with this name already exists.', 'ConflictError');
    data.name = name;
  }
  if (input.description !== undefined) {
    const description = String(input.description).trim();
    if (!description) fail(400, 'Description cannot be empty.', 'ValidationError');
    data.description = description;
  }
  const updated = await prisma.threadSet.update({ where: { id }, data });
  resultData(res, threadSetDto(updated));
}));

app.delete('/thread-sets/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid thread set ID.', 'ValidationError');
  const existing = await prisma.threadSet.findUnique({ where: { id } });
  if (!existing) fail(404, 'Thread set not found.', 'NotFoundError');
  await prisma.threadSet.delete({ where: { id } });
  res.json({ data: { id }, meta: {} });
}));

// -----------------------------------------------------------------------------
// Threads.
// -----------------------------------------------------------------------------
app.get('/threads', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pageOptions(req);
  const threadSetId = readRelationFilter(req, 'thread_set') ?? readRelationFilter(req, 'threadSet');
  const where = threadSetId ? { threadSetId } : {};
  const orderBy = getSorts(req, ['title', 'isFixed', 'createdAt', 'updatedAt'], [{ createdAt: 'desc' }]);
  const [total, records] = await Promise.all([
    prisma.thread.count({ where }),
    prisma.thread.findMany({ where, orderBy, skip, take: pageSize, include: threadInclude }),
  ]);
  listData(res, records.map(threadDto), total, page, pageSize);
}));

app.get('/threads/:id', asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid thread ID.', 'ValidationError');
  const record = await prisma.thread.findUnique({ where: { id }, include: threadInclude });
  if (!record) fail(404, 'Thread not found.', 'NotFoundError');
  resultData(res, threadDto(record));
}));

app.post('/threads', parseMultipartFields, requireAuth, asyncHandler(async (req, res) => {
  const input = parseInput(req);
  const title = String(input.title || '').trim();
  const threadSetId = numericId(input.thread_set ?? input.threadSet ?? input.threadSetId);
  if (!title) fail(400, 'Thread title is required.', 'ValidationError');
  if (!threadSetId) fail(400, 'A thread set must be selected.', 'ValidationError');
  const threadSet = await prisma.threadSet.findUnique({ where: { id: threadSetId } });
  if (!threadSet) fail(404, 'Thread set not found.', 'NotFoundError');
  const record = await prisma.thread.create({
    data: {
      title,
      threadSetId,
      authorId: req.user.id,
      isFixed: req.user.role === 'admin' ? booleanValue(input.isFixed) : false,
    },
    include: threadInclude,
  });
  resultData(res, threadDto(record), 201);
}));

app.put('/threads/:id', parseMultipartFields, requireAuth, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid thread ID.', 'ValidationError');
  const existing = await prisma.thread.findUnique({ where: { id }, include: threadInclude });
  if (!existing) fail(404, 'Thread not found.', 'NotFoundError');
  requireOwnerOrAdmin(existing.authorId, req.user);
  const input = parseInput(req);
  const data = {};
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) fail(400, 'Thread title cannot be empty.', 'ValidationError');
    data.title = title;
  }
  if (input.thread_set !== undefined || input.threadSet !== undefined || input.threadSetId !== undefined) {
    const threadSetId = numericId(input.thread_set ?? input.threadSet ?? input.threadSetId);
    if (!threadSetId) fail(400, 'Invalid thread set ID.', 'ValidationError');
    const threadSet = await prisma.threadSet.findUnique({ where: { id: threadSetId } });
    if (!threadSet) fail(404, 'Thread set not found.', 'NotFoundError');
    data.threadSetId = threadSetId;
  }
  if (input.isFixed !== undefined) {
    if (req.user.role !== 'admin') fail(403, 'Only administrators can change the fixed status.', 'ForbiddenError');
    data.isFixed = booleanValue(input.isFixed);
  }
  const updated = await prisma.thread.update({ where: { id }, data, include: threadInclude });
  resultData(res, threadDto(updated));
}));

app.delete('/threads/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid thread ID.', 'ValidationError');
  const existing = await prisma.thread.findUnique({ where: { id } });
  if (!existing) fail(404, 'Thread not found.', 'NotFoundError');
  requireOwnerOrAdmin(existing.authorId, req.user);
  await prisma.thread.delete({ where: { id } });
  res.json({ data: { id }, meta: {} });
}));

// -----------------------------------------------------------------------------
// Responses (forum replies). Accepts content, body, or text to ease frontend use.
// -----------------------------------------------------------------------------
app.get('/responses', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = pageOptions(req);
  const threadId = readRelationFilter(req, 'thread');
  const where = threadId ? { threadId } : {};
  const orderBy = getSorts(req, ['createdAt', 'updatedAt'], [{ createdAt: 'asc' }]);
  const [total, records] = await Promise.all([
    prisma.response.count({ where }),
    prisma.response.findMany({ where, orderBy, skip, take: pageSize, include: responseInclude }),
  ]);
  listData(res, records.map(responseDto), total, page, pageSize);
}));

app.get('/responses/:id', asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid response ID.', 'ValidationError');
  const record = await prisma.response.findUnique({ where: { id }, include: responseInclude });
  if (!record) fail(404, 'Response not found.', 'NotFoundError');
  resultData(res, responseDto(record));
}));

app.post('/responses', parseMultipartFields, requireAuth, asyncHandler(async (req, res) => {
  const input = parseInput(req);
  const content = String(input.content ?? input.body ?? input.text ?? input.response ?? input.description ?? '').trim();
  const threadId = numericId(input.thread ?? input.thread_id ?? input.threadId);
  if (!content) fail(400, 'Response content is required.', 'ValidationError');
  if (!threadId) fail(400, 'A thread must be selected.', 'ValidationError');
  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) fail(404, 'Thread not found.', 'NotFoundError');
  const record = await prisma.response.create({
    data: { content, threadId, authorId: req.user.id },
    include: responseInclude,
  });
  resultData(res, responseDto(record), 201);
}));

app.put('/responses/:id', parseMultipartFields, requireAuth, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid response ID.', 'ValidationError');
  const existing = await prisma.response.findUnique({ where: { id } });
  if (!existing) fail(404, 'Response not found.', 'NotFoundError');
  requireOwnerOrAdmin(existing.authorId, req.user);
  const input = parseInput(req);
  const data = {};
  const newContent = input.content ?? input.body ?? input.text ?? input.response ?? input.description;
  if (newContent !== undefined) {
    const content = String(newContent).trim();
    if (!content) fail(400, 'Response content cannot be empty.', 'ValidationError');
    data.content = content;
  }
  const updated = await prisma.response.update({ where: { id }, data, include: responseInclude });
  resultData(res, responseDto(updated));
}));

app.delete('/responses/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid response ID.', 'ValidationError');
  const existing = await prisma.response.findUnique({ where: { id }, include: { thread: true } });
  if (!existing) fail(404, 'Response not found.', 'NotFoundError');
  // The author of a thread must be able to remove its whole discussion: the
  // current Vue flow deletes replies one by one before issuing DELETE /threads/:id.
  const mayDelete = req.user.role === 'admin' || req.user.id === existing.authorId || req.user.id === existing.thread.authorId;
  if (!mayDelete) fail(403, 'You do not have permission to delete this response.', 'ForbiddenError');
  await prisma.response.delete({ where: { id } });
  res.json({ data: { id }, meta: {} });
}));

// -----------------------------------------------------------------------------
// Image uploads.
// -----------------------------------------------------------------------------
const imageStorage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      callback(null, UPLOAD_DIR);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, file, callback) => {
    const originalExtension = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const extension = allowedExtensions.includes(originalExtension) ? originalExtension : '';
    callback(null, `${Date.now()}-${require('node:crypto').randomBytes(8).toString('hex')}${extension}`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (!allowedTypes.has(file.mimetype)) return callback(new ApiError(400, 'Only JPG, PNG, WEBP, or GIF images are allowed.', 'ValidationError'));
    callback(null, true);
  },
});

app.post('/upload', requireAuth, imageUpload.array('files', 5), asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) fail(400, 'Choose at least one image to upload.', 'ValidationError');
  const records = [];
  try {
    for (const file of files) {
      const record = await prisma.uploadedFile.create({
        data: {
          name: file.originalname || file.filename,
          filename: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          url: `${PUBLIC_URL}/uploads/${encodeURIComponent(file.filename)}`,
        },
      });
      records.push(imageDto(record));
    }
  } catch (error) {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
    throw error;
  }
  res.status(201).json(records);
}));

app.delete('/upload/files/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = numericId(req.params.id);
  if (!id) fail(400, 'Invalid file ID.', 'ValidationError');
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) fail(404, 'Uploaded file not found.', 'NotFoundError');
  const connectedUsers = await prisma.user.count({ where: { imageId: id } });
  if (connectedUsers && req.user.role !== 'admin') {
    // Users can remove their own profile image, but not an image assigned to another account.
    const foreignOwner = await prisma.user.findFirst({ where: { imageId: id, NOT: { id: req.user.id } } });
    if (foreignOwner) fail(403, 'You cannot delete an image used by another account.', 'ForbiddenError');
  }
  await prisma.uploadedFile.delete({ where: { id } });
  await fs.unlink(path.join(UPLOAD_DIR, file.filename)).catch(() => {});
  res.json({ id, name: file.name, url: file.url, mime: file.mimeType, size: file.size });
}));

// Route not found in Strapi-like error format, consumed by useApplicationError on the frontend.
app.use((_req, _res, next) => next(new ApiError(404, 'The requested endpoint was not found.', 'NotFoundError')));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: { status, name: 'UploadError', message: error.message, details: {} } });
  }
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: { status: error.status, name: error.name, message: error.message, details: error.details || {} },
    });
  }
  // Prisma unique-constraint failures can happen under concurrent requests, so keep a friendly API shape.
  if (error?.code === 'P2002') {
    return res.status(409).json({ error: { status: 409, name: 'ConflictError', message: 'A record with one of these values already exists.', details: { target: error.meta?.target } } });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ error: { status: 404, name: 'NotFoundError', message: 'The requested record was not found.', details: {} } });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: { status: 400, name: 'ValidationError', message: 'The request body contains invalid JSON.', details: {} } });
  }
  console.error(error);
  return res.status(500).json({ error: { status: 500, name: 'InternalServerError', message: 'An unexpected server error occurred.', details: {} } });
});

app.locals.prisma = prisma;
module.exports = { app, prisma };
