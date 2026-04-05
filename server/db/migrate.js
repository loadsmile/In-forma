import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function migrate() {
  const pool = createPool();

  try {
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = (await readdir(migrationsDir))
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        file_name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const appliedMigrationsResult = await pool.query(`
      SELECT file_name
      FROM schema_migrations
    `);
    const appliedMigrations = new Set(appliedMigrationsResult.rows.map((row) => row.file_name));

    for (const migrationFile of migrationFiles) {
      if (appliedMigrations.has(migrationFile)) {
        continue;
      }

      const migrationPath = join(migrationsDir, migrationFile);
      const sql = await readFile(migrationPath, 'utf8');
      await pool.query('BEGIN');

      try {
        await pool.query(sql);
        await pool.query(
          `
            INSERT INTO schema_migrations (file_name)
            VALUES ($1)
          `,
          [migrationFile],
        );
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }

      console.info(`Migration completed: ${migrationFile}`);
    }
  } finally {
    await pool.end();
  }
}
