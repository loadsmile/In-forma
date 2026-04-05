CREATE TABLE IF NOT EXISTS email_deliveries (
  delivery_key TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL,
  metric_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_metric_date
  ON email_deliveries(metric_date DESC);
