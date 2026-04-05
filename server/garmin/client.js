import garminConnectPkg from '@gooin/garmin-connect';
import { env, requireEnv } from '../config/env.js';

const { GarminConnect } = garminConnectPkg;

export async function createGarminClient() {
  requireEnv(['GARMIN_EMAIL', 'GARMIN_PASSWORD']);

  const client = new GarminConnect({
    username: env.garminEmail,
    password: env.garminPassword,
  });

  await client.login();
  return client;
}
