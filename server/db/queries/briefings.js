export async function getOvernightRecoveryByDate(client, recoveryDate) {
  const result = await client.query(
    `
      SELECT *
      FROM overnight_recovery
      WHERE recovery_date = $1
      LIMIT 1
    `,
    [recoveryDate],
  );

  return result.rows[0] ?? null;
}

export async function getDailyBriefingByDate(client, briefingDate) {
  const result = await client.query(
    `
      SELECT *
      FROM daily_briefings
      WHERE briefing_date = $1
      LIMIT 1
    `,
    [briefingDate],
  );

  return result.rows[0] ?? null;
}
