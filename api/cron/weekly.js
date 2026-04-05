import { runCronJob } from '../../server/api/cron.js';

export const maxDuration = 300;

export default async function handler(request, response) {
  await runCronJob({
    request,
    response,
    job: async () => {
      const { runSync } = await import('../../server/sync/runSync.js');

      await runSync({
        syncType: 'weekly',
        deliveryLabel: 'Weekly fitness digest',
      });
    },
  });
}
