import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './db/pool.js';
import { optionalAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import threadSetRoutes from './routes/thread-sets.js';
import threadRoutes from './routes/threads.js';
import responseRoutes from './routes/responses.js';
import uploadRoutes from './routes/uploads.js';

const app = express();
const port = Number(process.env.PORT ?? 1337);
const host = process.env.HOST ?? '0.0.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set('query parser', 'extended');
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origins = String(process.env.CORS_ORIGIN ?? '*').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: origins.includes('*') ? '*' : origins, credentials: !origins.includes('*') }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads'), { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'tech-forum-backend', database: 'connected' });
  } catch (error) { next(error); }
});

app.use('/api/auth', optionalAuth, authRoutes);
app.use('/api/users', optionalAuth, userRoutes);
app.use('/api/thread-sets', optionalAuth, threadSetRoutes);
app.use('/api/threads', optionalAuth, threadRoutes);
app.use('/api/responses', optionalAuth, responseRoutes);
app.use('/api/upload', optionalAuth, uploadRoutes);

app.use((_req, res) => res.status(404).json({ error: { message: 'Route not found.' } }));
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Request body is too large.' } });
  if (error?.code === 'UNSUPPORTED_IMAGE_TYPE') return res.status(415).json({ error: { message: error.message } });
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: { message: `Image is larger than ${process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 5} MB.` } });
  if (error?.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: { message: 'Unexpected upload field. Use "files".' } });
  if (error?.code === '23503') return res.status(400).json({ error: { message: 'A referenced resource does not exist.' } });
  console.error(error);
  res.status(500).json({ error: { message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : (error.message || 'Internal server error.') } });
});

const server = app.listen(port, host, () => console.log(`Tech Forum API listening at http://${host}:${port}`));

async function shutdown(signal) {
  console.log(`${signal} received; closing HTTP and database connections.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
