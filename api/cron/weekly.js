import { runSync } from '../../server/sync/runSync.js';
import { runCronJob } from '../../server/api/cron.js';

export const maxDuration = 300;

export default async function handler(request, response) {
  await runCronJob({
    request,
    response,
    job: () => runSync({
      syncType: 'weekly',
      deliveryLabel: 'Weekly fitness digest',
    }),
  });
}
