export async function getDailyHealthMetricsByDate(client, metricDate) {
  const result = await client.query(
    `
      SELECT *
      FROM daily_health_metrics
      WHERE metric_date = $1
      LIMIT 1
    `,
    [metricDate],
  );

  return result.rows[0] ?? null;
}

export async function getDailyAnalysisByDate(client, metricDate) {
  const result = await client.query(
    `
      SELECT *
      FROM daily_analysis
      WHERE metric_date = $1
      LIMIT 1
    `,
    [metricDate],
  );

  return result.rows[0] ?? null;
}
