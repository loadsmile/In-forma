import { Pool } from 'pg';
import { env, requireEnv } from '../config/env.js';

export function createPool() {
  requireEnv(['DATABASE_URL']);

  return new Pool({
    connectionString: env.databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}
