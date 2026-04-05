import { runSync } from '../server/sync/runSync.js';

const forceRefresh = process.argv.includes('--force');

await runSync({
  syncType: 'evening',
  deliveryLabel: 'Evening recovery recap',
  forceRefresh,
});
