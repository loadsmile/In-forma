import garminConnectPkg from '@gooin/garmin-connect';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env, requireEnv } from '../config/env.js';

const { GarminConnect } = garminConnectPkg;
const garminTokenDir = join(tmpdir(), 'fitness-agent-garmin-tokens');

function ensureTokenDir() {
  if (!existsSync(garminTokenDir)) {
    mkdirSync(garminTokenDir, { recursive: true });
  }
}

export async function createGarminClient() {
  requireEnv(['GARMIN_EMAIL', 'GARMIN_PASSWORD']);

  const client = new GarminConnect({
    username: env.garminEmail,
    password: env.garminPassword,
  });

  ensureTokenDir();

  try {
    await client.loadTokenByFile(garminTokenDir);
    return client;
  } catch {
    // Fall back to a fresh login if no cached Garmin tokens exist locally.
  }

  await client.login();

  try {
    await client.exportTokenToFile(garminTokenDir);
  } catch {
    // Token caching is best-effort. A successful login should still proceed.
  }

  return client;
}
