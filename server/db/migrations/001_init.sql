CREATE TABLE IF NOT EXISTS daily_health_metrics (
  metric_date DATE PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'garmin',
  steps INTEGER,
  active_calories INTEGER,
  distance_meters NUMERIC,
  resting_heart_rate INTEGER,
  average_stress_level INTEGER,
  max_body_battery INTEGER,
  min_body_battery INTEGER,
  sleep_seconds INTEGER,
  hydration_ounces NUMERIC,
  weight_kg NUMERIC,
  moderate_intensity_minutes INTEGER,
  vigorous_intensity_minutes INTEGER,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_analysis (
  metric_date DATE PRIMARY KEY REFERENCES daily_health_metrics(metric_date) ON DELETE CASCADE,
  model TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  metric_date DATE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at DESC);
