import { migrate } from '../db/migrate.js';

function getBearerToken(request) {
  const header = request.headers.authorization ?? request.headers.Authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length);
}

export function authorizeCronRequest(request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('Missing environment variables: CRON_SECRET');
  }

  return getBearerToken(request) === cronSecret;
}

export async function runCronJob({ request, response, job }) {
  try {
    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (!authorizeCronRequest(request)) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await migrate();
    await job();
    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
