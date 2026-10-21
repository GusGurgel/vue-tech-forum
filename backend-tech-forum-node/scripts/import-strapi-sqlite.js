/**
 * Optional data importer for the original Strapi v4 SQLite database.
 * Run from this project's directory after `npm install` and `npm run db:migrate`:
 *   LEGACY_SQLITE_PATH=../Back_End_Tech_Forum/.tmp/data.db npm run db:import-strapi
 * It preserves user IDs and bcrypt password hashes, and imports the users, upload metadata,
 * thread sets, threads and responses. Existing Postgres rows are not overwritten.
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../src/db/pool.js';

const baseDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const sqlitePath = path.resolve(baseDir, process.env.LEGACY_SQLITE_PATH ?? '../Back_End_Tech_Forum/.tmp/data.db');
const hasTable = (db, name) => Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name));
const dateValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' || /^\d{10,}$/.test(String(value))) {
    const date = new Date(Number(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const val = (row, key, fallback = null) => row[key] === undefined ? fallback : row[key];

let source;
let client;
let inTransaction = false;
try {
  source = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  client = await pool.connect();
  const readAll = (table) => hasTable(source, table) ? source.prepare(`SELECT * FROM "${table}"`).all() : [];
  const users = readAll('up_users');
  const threadSets = readAll('thread_sets');
  const threads = readAll('threads');
  const responses = readAll('responses');
  const files = readAll('files');
  const fileRelations = readAll('files_related_morphs');
  const threadSetLinks = readAll('threads_thread_set_links');
  const threadAuthorLinks = readAll('threads_author_links');
  const responseAuthorLinks = readAll('responses_author_links');
  const responseThreadLinks = readAll('responses_thread_links');

  await client.query('BEGIN');
  inTransaction = true;

  const fileById = new Map(files.map((file) => [Number(file.id), file]));
  for (const file of files) {
    if (!file.url) continue;
    await client.query(
      `INSERT INTO uploads (id, name, url, mime, size, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [file.id, val(file, 'name', `upload-${file.id}`), file.url, val(file, 'mime', 'application/octet-stream'), val(file, 'size', 0), dateValue(file.created_at) ?? new Date(), dateValue(file.updated_at) ?? new Date()]
    );
  }

  for (const user of users) {
    const relation = fileRelations.find((r) => r.related_type === 'plugin::users-permissions.user' && Number(r.related_id) === Number(user.id) && r.field === 'image');
    const imageId = relation && fileById.has(Number(relation.file_id)) ? Number(relation.file_id) : null;
    // Strapi uses bcrypt hashes for local-password authentication; keep the hash as-is.
    await client.query(
      `INSERT INTO users (id, username, email, password, provider, confirmed, blocked, image_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [user.id, user.username, String(user.email ?? '').toLowerCase(), user.password, val(user, 'provider', 'local'), Boolean(user.confirmed), Boolean(user.blocked), imageId, dateValue(user.created_at) ?? new Date(), dateValue(user.updated_at) ?? new Date()]
    );
  }

  // Seed any legacy relation whose user record was omitted or whose image reference was null.
  const authorForThread = new Map(threadAuthorLinks.map((r) => [Number(r.thread_id), Number(r.user_id)]));
  const setForThread = new Map(threadSetLinks.map((r) => [Number(r.thread_id), Number(r.thread_set_id)]));
  for (const row of threadSets) {
    await client.query(
      `INSERT INTO thread_sets (id, name, description, created_at, updated_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [row.id, row.name || `Imported category ${row.id}`, row.description ?? '', dateValue(row.created_at) ?? new Date(), dateValue(row.updated_at) ?? new Date(), dateValue(row.published_at) ?? dateValue(row.created_at) ?? new Date()]
    );
  }
  for (const row of threads) {
    await client.query(
      `INSERT INTO threads (id, title, is_fixed, thread_set_id, author_id, created_at, updated_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [row.id, row.title || `Imported thread ${row.id}`, Boolean(row.is_fixed), setForThread.get(Number(row.id)) ?? null, authorForThread.get(Number(row.id)) ?? null, dateValue(row.created_at) ?? new Date(), dateValue(row.updated_at) ?? new Date(), dateValue(row.published_at) ?? dateValue(row.created_at) ?? new Date()]
    );
  }
  const authorForResponse = new Map(responseAuthorLinks.map((r) => [Number(r.response_id), Number(r.user_id)]));
  const threadForResponse = new Map(responseThreadLinks.map((r) => [Number(r.response_id), Number(r.thread_id)]));
  for (const row of responses) {
    await client.query(
      `INSERT INTO responses (id, content, thread_id, author_id, created_at, updated_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [row.id, row.content ?? '', threadForResponse.get(Number(row.id)) ?? null, authorForResponse.get(Number(row.id)) ?? null, dateValue(row.created_at) ?? new Date(), dateValue(row.updated_at) ?? new Date(), dateValue(row.published_at) ?? dateValue(row.created_at) ?? new Date()]
    );
  }

  for (const table of ['uploads', 'users', 'thread_sets', 'threads', 'responses']) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM ${table}), 1), 1), COALESCE((SELECT MAX(id) FROM ${table}), 0) > 0)`,
      [table]
    );
  }
  await client.query('COMMIT');
  inTransaction = false;
  console.log(`Imported legacy SQLite data from: ${sqlitePath}`);
  console.log(`Users: ${users.length}; thread sets: ${threadSets.length}; threads: ${threads.length}; responses: ${responses.length}; upload records: ${files.length}.`);
  console.log('Rows already present in PostgreSQL were left unchanged.');
} catch (error) {
  if (inTransaction && client) await client.query('ROLLBACK').catch(() => {});
  console.error('Strapi data import failed:', error.message);
  process.exitCode = 1;
} finally {
  source?.close();
  client?.release();
  await pool.end();
}
