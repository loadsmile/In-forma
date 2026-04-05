import { format, isValid, parseISO, subDays } from 'date-fns';
import { createGarminClient } from './client.js';
import { normalizeDailyMetrics } from './normalize.js';

function toMetricDateString(value) {
  return format(value, 'yyyy-MM-dd');
}

export function getSyncMetricDate(syncType) {
  return syncType === 'morning' || syncType === 'weekly' ? subDays(new Date(), 1) : new Date();
}

function poundsToKilograms(value) {
  if (value == null) {
    return null;
  }

  return Number((value * 0.45359237).toFixed(2));
}

async function fetchGarminMetric(fetchMetric) {
  try {
    return await fetchMetric();
  } catch {
    return null;
  }
}

function filterActivitiesByDate(activities, metricDate) {
  const metricDateString = toMetricDateString(metricDate);

  return activities
    .filter((activity) => {
      if (!activity?.startTimeLocal) {
        return false;
      }

      const activityDate = parseISO(activity.startTimeLocal);

      return isValid(activityDate) && toMetricDateString(activityDate) === metricDateString;
    })
    .map((activity) => ({
      activityId: activity.activityId ?? null,
      activityName: activity.activityName ?? 'Unnamed activity',
      activityType: activity.activityType?.typeKey ?? null,
      startTimeLocal: activity.startTimeLocal ?? null,
      duration: activity.duration ?? null,
      distance: activity.distance ?? null,
      calories: activity.calories ?? null,
      averageHR: activity.averageHR ?? null,
      maxHR: activity.maxHR ?? null,
      steps: activity.steps ?? null,
    }));
}

function buildSleepDetails(sleep) {
  if (!sleep) {
    return null;
  }

  return {
    totalSleepSeconds: sleep.dailySleepDTO?.sleepTimeSeconds ?? null,
    napTimeSeconds: sleep.dailySleepDTO?.napTimeSeconds ?? null,
    deepSleepSeconds: sleep.dailySleepDTO?.deepSleepSeconds ?? null,
    lightSleepSeconds: sleep.dailySleepDTO?.lightSleepSeconds ?? null,
    remSleepSeconds: sleep.dailySleepDTO?.remSleepSeconds ?? null,
    awakeSleepSeconds: sleep.dailySleepDTO?.awakeSleepSeconds ?? null,
    awakeCount: sleep.dailySleepDTO?.awakeCount ?? null,
    avgSleepStress: sleep.dailySleepDTO?.avgSleepStress ?? null,
    sleepScore: sleep.dailySleepDTO?.sleepScores?.overall?.value ?? null,
    sleepScoreFeedback: sleep.dailySleepDTO?.sleepScoreFeedback ?? null,
    sleepScoreInsight: sleep.dailySleepDTO?.sleepScoreInsight ?? null,
    remSleepData: sleep.remSleepData ?? null,
    restlessMomentsCount: sleep.restlessMomentsCount ?? null,
    sleepMovement: sleep.sleepMovement ?? [],
    sleepLevels: sleep.sleepLevels ?? [],
    avgOvernightHrv: sleep.avgOvernightHrv ?? null,
    hrvStatus: sleep.hrvStatus ?? null,
    bodyBatteryChange: sleep.bodyBatteryChange ?? null,
    restingHeartRate: sleep.restingHeartRate ?? null,
  };
}

export async function syncDailySummary({ syncType }) {
  const garminClient = await createGarminClient();
  const metricDate = getSyncMetricDate(syncType);

  const steps = await fetchGarminMetric(() => garminClient.getSteps(metricDate));
  const heartRate = await fetchGarminMetric(() => garminClient.getHeartRate(metricDate));
  const sleep = await fetchGarminMetric(() => garminClient.getSleepData(metricDate));
  const hydrationOunces = await fetchGarminMetric(() => garminClient.getDailyHydration(metricDate));
  const weightInPounds = await fetchGarminMetric(() => garminClient.getDailyWeightInPounds(metricDate));
  const activitiesResult = await fetchGarminMetric(() => garminClient.getActivities(0, 50));
  const activities = Array.isArray(activitiesResult)
    ? filterActivitiesByDate(activitiesResult, metricDate)
    : [];
  const sleepDetails = buildSleepDetails(sleep);

  if (
    steps == null &&
    heartRate == null &&
    sleep == null &&
    hydrationOunces == null &&
    weightInPounds == null &&
    activities.length === 0
  ) {
    throw new Error('Unable to fetch Garmin metrics for the requested date.');
  }

  const rawPayload = {
    schemaVersion: 'v2',
    steps,
    activeKilocalories: null,
    distanceInMeters: null,
    restingHeartRate: heartRate?.restingHeartRate ?? heartRate?.dailyRestingHeartRate ?? null,
    averageStressLevel: null,
    bodyBatteryMostRecent: null,
    bodyBatteryLowest: null,
    sleepingSeconds: sleep?.dailySleepDTO?.sleepTimeSeconds ?? null,
    hydrationOunces,
    weightKg: poundsToKilograms(weightInPounds),
    moderateIntensityMinutes: null,
    vigorousIntensityMinutes: null,
    sleepDetails,
    activities,
  };

  return normalizeDailyMetrics(rawPayload, metricDate);
}
