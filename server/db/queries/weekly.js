export async function getWeeklyDigestDays(client, startMetricDate, endMetricDate) {
  const result = await client.query(
    `
      SELECT
        m.metric_date,
        m.steps,
        m.resting_heart_rate,
        m.sleep_seconds,
        m.raw_payload,
        a.summary,
        a.recommendations
      FROM daily_health_metrics m
      LEFT JOIN daily_analysis a ON a.metric_date = m.metric_date
      WHERE m.metric_date BETWEEN $1 AND $2
      ORDER BY m.metric_date ASC
    `,
    [startMetricDate, endMetricDate],
  );

  return result.rows;
}
