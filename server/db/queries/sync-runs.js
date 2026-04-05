export async function insertSyncRun(client, syncRun) {
  const query = `
    INSERT INTO sync_runs (
      sync_type,
      status,
      started_at,
      finished_at,
      metric_date,
      message
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const values = [
    syncRun.syncType,
    syncRun.status,
    syncRun.startedAt,
    syncRun.finishedAt,
    syncRun.metricDate,
    syncRun.message,
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

export async function listRecentSyncRuns(client, limit = 10) {
  const result = await client.query(
    `
      SELECT *
      FROM sync_runs
      ORDER BY started_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}
