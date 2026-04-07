import { getDatabaseFingerprintPayload } from '../../server/api/databaseFingerprint.js';
import { runCronJob } from '../../server/api/cron.js';

export default async function handler(request, response) {
  await runCronJob({
    request,
    response,
    job: async () => {
      response.status(200).json(getDatabaseFingerprintPayload());
    },
  });
}
