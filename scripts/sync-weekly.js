import { runSync } from '../server/sync/runSync.js';

const forceRefresh = process.argv.includes('--force');

await runSync({
  syncType: 'weekly',
  deliveryLabel: 'Weekly fitness digest',
  forceRefresh,
});
