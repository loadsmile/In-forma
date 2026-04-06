import { format, parseISO, subDays } from 'date-fns';
import { createGarminClient } from './client.js';
import {
  buildHeartRateDetails,
  buildHrvDetails,
  buildSleepDetails,
  buildTrainingLoadBalanceDetails,
  buildTrainingStatusDetails,
} from './syncDailySummary.js';

export const OVERNIGHT_RECOVERY_SCHEMA_VERSION = 'v1';

function createFetchWarning(metric, error) {
  return {
    metric,
    required: metric === 'sleep',
    message: error instanceof Error ? error.message : String(error),
  };
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

function localDateStringFromTimestamp(timestamp) {
  if (timestamp == null) {
    return null;
  }

  return format(new Date(timestamp), 'yyyy-MM-dd');
}

function selectSleepCandidate({ recoveryDate, todaySleep, previousSleep }) {
  const recoveryDateString = format(recoveryDate, 'yyyy-MM-dd');
  const candidates = [todaySleep, previousSleep]
    .map((sleep) => ({
      sleep,
      details: buildSleepDetails(sleep),
    }))
    .filter((candidate) => candidate.sleep);

  const matchingCandidate = candidates.find((candidate) => (
    localDateStringFromTimestamp(candidate.details?.sleepEndTimestampLocal) === recoveryDateString
  ));

  return matchingCandidate ?? candidates[0] ?? null;
}

export async function syncOvernightRecovery({ recoveryDate = new Date() }) {
  const garminClient = await createGarminClient();
  const previousDate = subDays(recoveryDate, 1);

  const sleepTodayResult = await fetchGarminMetric('sleep', () => garminClient.getSleepData(recoveryDate));
  const sleepPreviousResult = await fetchGarminMetric('sleep', () => garminClient.getSleepData(previousDate));
  const heartRateResult = await fetchGarminMetric('heartRate', () => garminClient.getHeartRate(recoveryDate));
  const hrvResult = await fetchGarminMetric('hrv', () => garminClient.getHRVData(recoveryDate));
  const trainingStatusResult = await fetchGarminMetric('trainingStatus', () => garminClient.getTrainingStatus(recoveryDate));
  const trainingLoadBalanceResult = await fetchGarminMetric('trainingLoadBalance', () => garminClient.getTrainingLoadBalance(recoveryDate));

  const warnings = [
    sleepTodayResult.warning,
    sleepPreviousResult.warning,
    heartRateResult.warning,
    hrvResult.warning,
    trainingStatusResult.warning,
    trainingLoadBalanceResult.warning,
  ].filter(Boolean);

  const selectedSleepCandidate = selectSleepCandidate({
    recoveryDate,
    todaySleep: sleepTodayResult.value,
    previousSleep: sleepPreviousResult.value,
  });

  if (!selectedSleepCandidate) {
    throw new Error('Critical Garmin metrics unavailable: sleep: Unable to fetch overnight sleep for the recovery date.');
  }

  const sleepDetails = selectedSleepCandidate.details;
  const heartRateDetails = buildHeartRateDetails(heartRateResult.value);
  const hrvDetails = buildHrvDetails(hrvResult.value);
  const trainingStatusDetails = buildTrainingStatusDetails(trainingStatusResult.value);
  const trainingLoadBalanceDetails = buildTrainingLoadBalanceDetails(trainingLoadBalanceResult.value);

  return {
    recovery_date: format(recoveryDate, 'yyyy-MM-dd'),
    source: 'garmin',
    sleep_seconds: sleepDetails?.totalSleepSeconds ?? null,
    sleep_score: sleepDetails?.sleepScore ?? null,
    resting_heart_rate: sleepDetails?.restingHeartRate ?? heartRateDetails?.restingHeartRate ?? null,
    last_night_hrv: hrvDetails?.lastNightAvg ?? sleepDetails?.avgOvernightHrv ?? null,
    body_battery_change: sleepDetails?.bodyBatteryChange ?? null,
    raw_payload: {
      schemaVersion: OVERNIGHT_RECOVERY_SCHEMA_VERSION,
      sleepDetails,
      heartRateDetails,
      hrvDetails,
      trainingStatusDetails,
      trainingLoadBalanceDetails,
      fetchWarnings: warnings,
      sourceSleepDate: selectedSleepCandidate.sleep?.calendarDate ?? null,
      selectedSleepEndDate: localDateStringFromTimestamp(sleepDetails?.sleepEndTimestampLocal),
    },
  };
}
