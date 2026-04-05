import { runSync } from '../server/sync/runSync.js';

const forceRefresh = process.argv.includes('--force');

await runSync({
  syncType: 'morning',
  deliveryLabel: '10:00 WEST morning email',
  forceRefresh,
});
