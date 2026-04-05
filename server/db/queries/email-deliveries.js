export async function claimEmailDelivery(client, { deliveryKey, syncType, metricDate }) {
  const result = await client.query(
    `
      INSERT INTO email_deliveries (delivery_key, sync_type, metric_date)
      VALUES ($1, $2, $3)
      ON CONFLICT (delivery_key) DO NOTHING
      RETURNING delivery_key
    `,
    [deliveryKey, syncType, metricDate],
  );

  return result.rowCount > 0;
}

export async function markEmailDeliverySent(client, deliveryKey) {
  await client.query(
    `
      UPDATE email_deliveries
      SET sent_at = NOW()
      WHERE delivery_key = $1
    `,
    [deliveryKey],
  );
}

export async function releasePendingEmailDelivery(client, deliveryKey) {
  await client.query(
    `
      DELETE FROM email_deliveries
      WHERE delivery_key = $1
        AND sent_at IS NULL
    `,
    [deliveryKey],
  );
}
