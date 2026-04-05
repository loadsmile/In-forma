import { getDashboardData } from '../server/api/dashboardRoute.js';

export default async function handler(_request, response) {
  try {
    const payload = await getDashboardData();

    response.status(200).json(payload);
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
}
