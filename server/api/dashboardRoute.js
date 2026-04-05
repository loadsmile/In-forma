import { createPool } from '../db/pool.js';
import { getDashboardOverview } from '../db/queries/dashboard.js';

export async function getDashboardData() {
  const pool = createPool();

  try {
    return await getDashboardOverview(pool);
  } finally {
    await pool.end();
  }
}
