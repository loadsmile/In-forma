import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function getDatabaseFingerprintPayload() {
  if (!env.databaseUrl) {
    throw new Error('Missing environment variables: DATABASE_URL');
  }

  const parsed = new URL(env.databaseUrl);

  return {
    fingerprint: fingerprint(env.databaseUrl),
    host: parsed.hostname,
    database: parsed.pathname.slice(1),
  };
}
