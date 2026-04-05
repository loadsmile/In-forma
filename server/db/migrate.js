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

    for (const migrationFile of migrationFiles) {
      const migrationPath = join(migrationsDir, migrationFile);
      const sql = await readFile(migrationPath, 'utf8');
      await pool.query(sql);
      console.info(`Migration completed: ${migrationFile}`);
    }
  } finally {
    await pool.end();
  }
}
