export async function getDashboardOverview(client) {
  const [recentDays, latestRuns] = await Promise.all([
    client.query(
      `
        SELECT
          m.metric_date,
          m.steps,
          m.resting_heart_rate,
          m.sleep_seconds,
          m.raw_payload,
          a.model,
          a.summary,
          a.recommendations,
          a.prompt_version
        FROM daily_health_metrics m
        LEFT JOIN daily_analysis a ON a.metric_date = m.metric_date
        ORDER BY m.metric_date DESC
        LIMIT 3
      `,
    ),
    client.query(
      `
        SELECT *
        FROM sync_runs
        ORDER BY started_at DESC
        LIMIT 5
      `,
    ),
  ]);

  return {
    focusDay: recentDays.rows[0] ?? null,
    recentDays: recentDays.rows,
    recentRuns: latestRuns.rows,
  };
}
