export async function upsertByDate(client, tableName, values) {
  const columns = Object.keys(values);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter((column) => column !== 'metric_date')
    .map((column) => `${column} = EXCLUDED.${column}`);

  const query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (metric_date) DO UPDATE SET ${updates.join(', ')}
    RETURNING *
  `;

  return client.query(query, columns.map((column) => values[column]));
}
