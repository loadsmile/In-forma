export async function upsertByKey(client, tableName, values, keyColumn = 'metric_date') {
  const columns = Object.keys(values);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter((column) => column !== keyColumn)
    .map((column) => `${column} = EXCLUDED.${column}`);

  const query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (${keyColumn}) DO UPDATE SET ${updates.join(', ')}
    RETURNING *
  `;

  return client.query(query, columns.map((column) => values[column]));
}

export async function upsertByDate(client, tableName, values) {
  return upsertByKey(client, tableName, values, 'metric_date');
}
