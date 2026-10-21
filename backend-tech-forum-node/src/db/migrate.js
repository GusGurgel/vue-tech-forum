import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pool from './pool.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

try {
  const schema = await readFile(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database schema is up to date.');
} catch (error) {
  console.error('Could not migrate the PostgreSQL database:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
