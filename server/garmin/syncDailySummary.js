import { format, isValid, parseISO, subDays } from 'date-fns';
import { createGarminClient } from './client.js';
import { normalizeDailyMetrics } from './normalize.js';

export const GARMIN_METRIC_SCHEMA_VERSION = 'v3';

function toMetricDateString(value) {
  return format(value, 'yyyy-MM-dd');
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function range(values) {
  if (values.length === 0) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function latestRecord(recordMap) {
  if (!recordMap || typeof recordMap !== 'object') {
    return null;
  }

  return Object.values(recordMap).find(Boolean) ?? null;
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

  const respirationValues = (sleep.wellnessEpochRespirationDataDTOList ?? [])
    .map((entry) => entry?.respirationValue)
    .filter((value) => typeof value === 'number');
  const overnightHeartRateValues = (sleep.sleepHeartRate ?? [])
    .map((entry) => entry?.value)
    .filter((value) => typeof value === 'number');
  const bodyBatteryValues = (sleep.sleepBodyBattery ?? [])
    .map((entry) => entry?.value)
    .filter((value) => typeof value === 'number');
  const respirationRange = range(respirationValues);
  const overnightHeartRateRange = range(overnightHeartRateValues);
  const bodyBatteryRange = range(bodyBatteryValues);

  return {
    totalSleepSeconds: sleep.dailySleepDTO?.sleepTimeSeconds ?? null,
    napTimeSeconds: sleep.dailySleepDTO?.napTimeSeconds ?? null,
    sleepStartTimestampLocal: sleep.dailySleepDTO?.sleepStartTimestampLocal ?? null,
    sleepEndTimestampLocal: sleep.dailySleepDTO?.sleepEndTimestampLocal ?? null,
    deepSleepSeconds: sleep.dailySleepDTO?.deepSleepSeconds ?? null,
    lightSleepSeconds: sleep.dailySleepDTO?.lightSleepSeconds ?? null,
    remSleepSeconds: sleep.dailySleepDTO?.remSleepSeconds ?? null,
    awakeSleepSeconds: sleep.dailySleepDTO?.awakeSleepSeconds ?? null,
    awakeCount: sleep.dailySleepDTO?.awakeCount ?? null,
    avgSleepStress: sleep.dailySleepDTO?.avgSleepStress ?? null,
    sleepScore: sleep.dailySleepDTO?.sleepScores?.overall?.value ?? null,
    sleepScoreFeedback: sleep.dailySleepDTO?.sleepScoreFeedback ?? null,
    sleepScoreInsight: sleep.dailySleepDTO?.sleepScoreInsight ?? null,
    averageRespirationValue: sleep.dailySleepDTO?.averageRespirationValue ?? null,
    lowestRespirationValue: sleep.dailySleepDTO?.lowestRespirationValue ?? respirationRange.min,
    highestRespirationValue: sleep.dailySleepDTO?.highestRespirationValue ?? respirationRange.max,
    remSleepData: sleep.remSleepData ?? null,
    restlessMomentsCount: sleep.restlessMomentsCount ?? null,
    sleepMovement: sleep.sleepMovement ?? [],
    sleepLevels: sleep.sleepLevels ?? [],
    respirationSampleCount: respirationValues.length,
    overnightHeartRateAverage: average(overnightHeartRateValues),
    overnightHeartRateMin: overnightHeartRateRange.min,
    overnightHeartRateMax: overnightHeartRateRange.max,
    overnightHeartRateSampleCount: overnightHeartRateValues.length,
    overnightBodyBatteryStart: bodyBatteryValues[0] ?? null,
    overnightBodyBatteryEnd: bodyBatteryValues.at(-1) ?? null,
    overnightBodyBatteryMin: bodyBatteryRange.min,
    overnightBodyBatteryMax: bodyBatteryRange.max,
    overnightBodyBatterySampleCount: bodyBatteryValues.length,
    avgOvernightHrv: sleep.avgOvernightHrv ?? null,
    hrvStatus: sleep.hrvStatus ?? null,
    bodyBatteryChange: sleep.bodyBatteryChange ?? null,
    restingHeartRate: sleep.restingHeartRate ?? null,
  };
}

function buildHeartRateDetails(heartRate) {
  if (!heartRate) {
    return null;
  }

  const heartRateSampleCount = (heartRate.heartRateValues ?? [])
    .reduce((count, entries) => count + (Array.isArray(entries) ? entries.length : 0), 0);

  return {
    minHeartRate: heartRate.minHeartRate ?? null,
    maxHeartRate: heartRate.maxHeartRate ?? null,
    restingHeartRate: heartRate.restingHeartRate ?? heartRate.dailyRestingHeartRate ?? null,
    lastSevenDaysAvgRestingHeartRate: heartRate.lastSevenDaysAvgRestingHeartRate ?? null,
    heartRateSampleCount,
  };
}

function buildHrvDetails(hrvData) {
  const summary = hrvData?.hrvSummary;

  if (!summary) {
    return null;
  }

  return {
    status: summary.status ?? null,
    feedbackPhrase: summary.feedbackPhrase ?? null,
    lastNightAvg: summary.lastNightAvg ?? null,
    weeklyAvg: summary.weeklyAvg ?? null,
    lastNight5MinHigh: summary.lastNight5MinHigh ?? null,
    baseline: summary.baseline ?? null,
    readingCount: Array.isArray(hrvData.hrvReadings) ? hrvData.hrvReadings.length : 0,
  };
}

function buildTrainingStatusDetails(trainingStatusResponse) {
  const latestStatus = latestRecord(trainingStatusResponse?.latestTrainingStatusData);

  if (!latestStatus) {
    return null;
  }

  return {
    calendarDate: latestStatus.calendarDate ?? null,
    sport: latestStatus.sport ?? null,
    subSport: latestStatus.subSport ?? null,
    trainingStatus: latestStatus.trainingStatus ?? null,
    weeklyTrainingLoad: latestStatus.weeklyTrainingLoad ?? null,
    loadLevelTrend: latestStatus.loadLevelTrend ?? null,
    fitnessTrend: latestStatus.fitnessTrend ?? null,
    trainingPaused: latestStatus.trainingPaused ?? null,
    feedbackPhrase: latestStatus.trainingStatusFeedbackPhrase ?? null,
    acuteTrainingLoad: {
      dailyTrainingLoadAcute: latestStatus.acuteTrainingLoadDTO?.dailyTrainingLoadAcute ?? null,
      dailyTrainingLoadChronic: latestStatus.acuteTrainingLoadDTO?.dailyTrainingLoadChronic ?? null,
      acwrPercent: latestStatus.acuteTrainingLoadDTO?.acwrPercent ?? null,
      acwrStatus: latestStatus.acuteTrainingLoadDTO?.acwrStatus ?? null,
      acwrStatusFeedback: latestStatus.acuteTrainingLoadDTO?.acwrStatusFeedback ?? null,
    },
  };
}

function buildTrainingLoadBalanceDetails(trainingLoadBalanceResponse) {
  const latestBalance = latestRecord(trainingLoadBalanceResponse?.metricsTrainingLoadBalanceDTOMap);

  if (!latestBalance) {
    return null;
  }

  return {
    calendarDate: latestBalance.calendarDate ?? null,
    monthlyLoadAerobicLow: latestBalance.monthlyLoadAerobicLow ?? null,
    monthlyLoadAerobicHigh: latestBalance.monthlyLoadAerobicHigh ?? null,
    monthlyLoadAnaerobic: latestBalance.monthlyLoadAnaerobic ?? null,
    monthlyLoadAerobicLowTargetMin: latestBalance.monthlyLoadAerobicLowTargetMin ?? null,
    monthlyLoadAerobicLowTargetMax: latestBalance.monthlyLoadAerobicLowTargetMax ?? null,
    monthlyLoadAerobicHighTargetMin: latestBalance.monthlyLoadAerobicHighTargetMin ?? null,
    monthlyLoadAerobicHighTargetMax: latestBalance.monthlyLoadAerobicHighTargetMax ?? null,
    monthlyLoadAnaerobicTargetMin: latestBalance.monthlyLoadAnaerobicTargetMin ?? null,
    monthlyLoadAnaerobicTargetMax: latestBalance.monthlyLoadAnaerobicTargetMax ?? null,
    feedbackPhrase: latestBalance.trainingBalanceFeedbackPhrase ?? null,
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
  const hrvData = await fetchGarminMetric(() => garminClient.getHRVData(metricDate));
  const trainingStatus = await fetchGarminMetric(() => garminClient.getTrainingStatus(metricDate));
  const trainingLoadBalance = await fetchGarminMetric(() => garminClient.getTrainingLoadBalance(metricDate));
  const activitiesResult = await fetchGarminMetric(() => garminClient.getActivities(0, 50));
  const activities = Array.isArray(activitiesResult)
    ? filterActivitiesByDate(activitiesResult, metricDate)
    : [];
  const sleepDetails = buildSleepDetails(sleep);
  const heartRateDetails = buildHeartRateDetails(heartRate);
  const hrvDetails = buildHrvDetails(hrvData);
  const trainingStatusDetails = buildTrainingStatusDetails(trainingStatus);
  const trainingLoadBalanceDetails = buildTrainingLoadBalanceDetails(trainingLoadBalance);

  if (
    steps == null &&
    heartRate == null &&
    sleep == null &&
    hydrationOunces == null &&
    weightInPounds == null &&
    hrvData == null &&
    trainingStatus == null &&
    trainingLoadBalance == null &&
    activities.length === 0
  ) {
    throw new Error('Unable to fetch Garmin metrics for the requested date.');
  }

  const rawPayload = {
    schemaVersion: GARMIN_METRIC_SCHEMA_VERSION,
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
    heartRateDetails,
    sleepDetails,
    hrvDetails,
    trainingStatusDetails,
    trainingLoadBalanceDetails,
    activities,
  };

  return normalizeDailyMetrics(rawPayload, metricDate);
}
