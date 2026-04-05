import { format } from 'date-fns';

export function normalizeDailyMetrics(garminPayload, metricDate = new Date()) {
  return {
    metric_date: format(metricDate, 'yyyy-MM-dd'),
    source: 'garmin',
    steps: garminPayload?.steps ?? null,
    active_calories: garminPayload?.activeKilocalories ?? null,
    distance_meters: garminPayload?.distanceInMeters ?? null,
    resting_heart_rate: garminPayload?.restingHeartRate ?? null,
    average_stress_level: garminPayload?.averageStressLevel ?? null,
    max_body_battery: garminPayload?.bodyBatteryMostRecent ?? null,
    min_body_battery: garminPayload?.bodyBatteryLowest ?? null,
    sleep_seconds: garminPayload?.sleepingSeconds ?? null,
    hydration_ounces: garminPayload?.hydrationOunces ?? null,
    weight_kg: garminPayload?.weightKg ?? null,
    moderate_intensity_minutes: garminPayload?.moderateIntensityMinutes ?? null,
    vigorous_intensity_minutes: garminPayload?.vigorousIntensityMinutes ?? null,
    raw_payload: garminPayload ?? {},
  };
}
