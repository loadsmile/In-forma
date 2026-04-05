import { format, isValid, parseISO, subDays } from 'date-fns';
import { createGarminClient } from './client.js';
import { normalizeDailyMetrics } from './normalize.js';

export const GARMIN_METRIC_SCHEMA_VERSION = 'v3';
const criticalGarminMetrics = new Set(['steps', 'heartRate', 'sleep']);

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

function createFetchWarning(metric, error) {
  return {
    metric,
    required: criticalGarminMetrics.has(metric),
    message: error instanceof Error ? error.message : String(error),
  };
}

function formatFetchWarnings(warnings) {
  return warnings.map((warning) => `${warning.metric}: ${warning.message}`);
}

async function fetchGarminMetric(metric, fetchMetric) {
  try {
    return {
      value: await fetchMetric(),
      warning: null,
    };
  } catch (error) {
    return {
      value: null,
      warning: createFetchWarning(metric, error),
    };
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

  const metricResults = [];
  metricResults.push(await fetchGarminMetric('steps', () => garminClient.getSteps(metricDate)));
  metricResults.push(await fetchGarminMetric('heartRate', () => garminClient.getHeartRate(metricDate)));
  metricResults.push(await fetchGarminMetric('sleep', () => garminClient.getSleepData(metricDate)));
  metricResults.push(await fetchGarminMetric('hydration', () => garminClient.getDailyHydration(metricDate)));
  metricResults.push(await fetchGarminMetric('weight', () => garminClient.getDailyWeightInPounds(metricDate)));
  metricResults.push(await fetchGarminMetric('hrv', () => garminClient.getHRVData(metricDate)));
  metricResults.push(await fetchGarminMetric('trainingStatus', () => garminClient.getTrainingStatus(metricDate)));
  metricResults.push(await fetchGarminMetric('trainingLoadBalance', () => garminClient.getTrainingLoadBalance(metricDate)));
  metricResults.push(await fetchGarminMetric('activities', () => garminClient.getActivities(0, 50)));
  const [stepsResult, heartRateResult, sleepResult, hydrationResult, weightResult, hrvResult, trainingStatusResult, trainingLoadBalanceResult, activitiesFetchResult] = metricResults;
  const warnings = metricResults
    .map((result) => result.warning)
    .filter(Boolean);
  const criticalWarnings = warnings.filter((warning) => warning.required);

  if (criticalWarnings.length > 0) {
    throw new Error(`Critical Garmin metrics unavailable: ${formatFetchWarnings(criticalWarnings).join('; ')}`);
  }

  const steps = stepsResult.value;
  const heartRate = heartRateResult.value;
  const sleep = sleepResult.value;
  const hydrationOunces = hydrationResult.value;
  const weightInPounds = weightResult.value;
  const hrvData = hrvResult.value;
  const trainingStatus = trainingStatusResult.value;
  const trainingLoadBalance = trainingLoadBalanceResult.value;
  const activities = Array.isArray(activitiesFetchResult.value)
    ? filterActivitiesByDate(activitiesFetchResult.value, metricDate)
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
    fetchWarnings: warnings,
    activities,
  };

  return normalizeDailyMetrics(rawPayload, metricDate);
}
