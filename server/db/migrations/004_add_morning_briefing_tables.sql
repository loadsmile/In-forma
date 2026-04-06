CREATE TABLE IF NOT EXISTS overnight_recovery (
  recovery_date DATE PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'garmin',
  sleep_seconds INTEGER,
  sleep_score INTEGER,
  resting_heart_rate INTEGER,
  last_night_hrv NUMERIC,
  body_battery_change INTEGER,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_briefings (
  briefing_date DATE PRIMARY KEY,
  reviewed_activity_date DATE REFERENCES daily_health_metrics(metric_date) ON DELETE SET NULL,
  recovery_date DATE REFERENCES overnight_recovery(recovery_date) ON DELETE SET NULL,
  model TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_briefings_reviewed_activity_date
  ON daily_briefings(reviewed_activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_briefings_recovery_date
  ON daily_briefings(recovery_date DESC);
