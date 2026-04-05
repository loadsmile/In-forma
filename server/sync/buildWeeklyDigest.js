import { format, parseISO, subDays } from 'date-fns';

function getMetricDate(value) {
  return value instanceof Date ? value : parseISO(value);
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function total(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

function formatMetricDate(value) {
  return format(getMetricDate(value), 'yyyy-MM-dd');
}

export function getWeeklyDigestDateRange(endMetricDate) {
  const endDate = getMetricDate(endMetricDate);
  const startDate = subDays(endDate, 6);

  return {
    startDate,
    endDate,
    startMetricDate: format(startDate, 'yyyy-MM-dd'),
    endMetricDate: format(endDate, 'yyyy-MM-dd'),
  };
}

export function buildWeeklyDigest(days, endMetricDate) {
  const { startMetricDate, endMetricDate: endDateString } = getWeeklyDigestDateRange(endMetricDate);
  const orderedDays = [...days].sort((left, right) => new Date(left.metric_date) - new Date(right.metric_date));
  const stepValues = orderedDays.map((day) => day.steps).filter((value) => value != null);
  const sleepValues = orderedDays.map((day) => day.sleep_seconds).filter((value) => value != null);
  const heartValues = orderedDays.map((day) => day.resting_heart_rate).filter((value) => value != null);
  const sleepScoreValues = orderedDays
    .map((day) => day.raw_payload?.sleepDetails?.sleepScore)
    .filter((value) => value != null);
  const nightlyHrvValues = orderedDays
    .map((day) => day.raw_payload?.hrvDetails?.lastNightAvg)
    .filter((value) => value != null);
  const activitiesCount = total(orderedDays.map((day) => Array.isArray(day.raw_payload?.activities) ? day.raw_payload.activities.length : 0));
  const bestStepDay = orderedDays
    .filter((day) => day.steps != null)
    .sort((left, right) => (right.steps ?? 0) - (left.steps ?? 0))[0] ?? null;

  return {
    range: {
      startMetricDate,
      endMetricDate: endDateString,
    },
    daysCovered: orderedDays.length,
    aggregates: {
      totalSteps: total(stepValues),
      averageSteps: average(stepValues),
      averageSleepSeconds: average(sleepValues),
      averageRestingHeartRate: average(heartValues),
      averageSleepScore: average(sleepScoreValues),
      averageNightlyHrv: average(nightlyHrvValues),
      totalActivities: activitiesCount,
      bestStepDay: bestStepDay
        ? {
            metricDate: formatMetricDate(bestStepDay.metric_date),
            steps: bestStepDay.steps,
          }
        : null,
    },
    dailyBreakdown: orderedDays.map((day) => ({
      metricDate: formatMetricDate(day.metric_date),
      steps: day.steps ?? null,
      sleepSeconds: day.sleep_seconds ?? null,
      restingHeartRate: day.resting_heart_rate ?? null,
      sleepScore: day.raw_payload?.sleepDetails?.sleepScore ?? null,
      nightlyHrv: day.raw_payload?.hrvDetails?.lastNightAvg ?? null,
      activityCount: Array.isArray(day.raw_payload?.activities) ? day.raw_payload.activities.length : 0,
      summary: day.summary ?? '',
    })),
  };
}
