ALTER TABLE daily_health_metrics
ADD COLUMN IF NOT EXISTS hydration_ounces NUMERIC,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;
