import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.PGHOST ?? 'localhost',
        port: Number(process.env.PGPORT ?? 5432),
        database: process.env.PGDATABASE ?? 'tech_forum',
        user: process.env.PGUSER ?? 'tech_forum',
        password: process.env.PGPASSWORD ?? 'change_me',
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
      }
);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export default pool;
