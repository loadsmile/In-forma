import assert from 'node:assert/strict';
import test from 'node:test';
import { shapeActivityDay, shapeOvernightRecovery } from '../server/db/queries/dashboard.js';

test('shapeActivityDay strips large raw payload arrays and keeps UI fields', () => {
  const shaped = shapeActivityDay({
    metric_date: '2026-04-04',
    steps: 9000,
    resting_heart_rate: 57,
    sleep_seconds: 28800,
    model: 'model',
    summary: 'summary',
    recommendations: '- item',
    prompt_version: 'v3',
    raw_payload: {
      schemaVersion: 'v3',
      sleepDetails: {
        sleepScore: 82,
        sleepMovement: [{ noisy: true }],
        sleepLevels: [{ noisy: true }],
        deepSleepSeconds: 3600,
      },
      hrvDetails: { lastNightAvg: 46, weeklyAvg: 44, readingCount: 50 },
      heartRateDetails: { minHeartRate: 50, maxHeartRate: 140, lastSevenDaysAvgRestingHeartRate: 58, heartRateSampleCount: 99 },
      trainingStatusDetails: { weeklyTrainingLoad: 320, acuteTrainingLoad: { acwrStatus: 'balanced', acwrPercent: 100 } },
      trainingLoadBalanceDetails: { monthlyLoadAerobicHigh: 200, feedbackPhrase: 'steady' },
      activities: [{ activityName: 'Walk', startTimeLocal: '2026-04-04T08:00:00', calories: 100, ignored: 'x' }],
    },
  });

  assert.equal(shaped.raw_payload.sleepDetails.sleepMovement, undefined);
  assert.equal(shaped.raw_payload.sleepDetails.sleepLevels, undefined);
  assert.equal(shaped.raw_payload.hrvDetails, undefined);
  assert.equal(shaped.raw_payload.heartRateDetails, undefined);
  assert.equal(shaped.raw_payload.activities[0].ignored, undefined);
  assert.equal(shaped.raw_payload.activities[0].activityName, 'Walk');
});

test('shapeOvernightRecovery strips large raw payload arrays and keeps recovery fields', () => {
  const shaped = shapeOvernightRecovery({
    recovery_date: '2026-04-05',
    sleep_seconds: 28800,
    sleep_score: 82,
    resting_heart_rate: 54,
    last_night_hrv: 46,
    body_battery_change: 37,
    raw_payload: {
      schemaVersion: 'v1',
      sleepDetails: {
        sleepScore: 82,
        sleepMovement: [{ noisy: true }],
        sleepLevels: [{ noisy: true }],
        deepSleepSeconds: 3600,
        bodyBatteryChange: 37,
      },
      hrvDetails: { lastNightAvg: 46, weeklyAvg: 44, readingCount: 50 },
      heartRateDetails: { minHeartRate: 50, maxHeartRate: 140, lastSevenDaysAvgRestingHeartRate: 58, heartRateSampleCount: 99 },
      trainingStatusDetails: { weeklyTrainingLoad: 320, acuteTrainingLoad: { acwrStatus: 'balanced', acwrPercent: 100 } },
      trainingLoadBalanceDetails: { monthlyLoadAerobicHigh: 200, feedbackPhrase: 'steady' },
    },
  });

  assert.equal(shaped.metric_date, '2026-04-05');
  assert.equal(shaped.raw_payload.sleepDetails.sleepMovement, undefined);
  assert.equal(shaped.raw_payload.sleepDetails.sleepLevels, undefined);
  assert.equal(shaped.raw_payload.hrvDetails.readingCount, undefined);
  assert.equal(shaped.raw_payload.heartRateDetails.heartRateSampleCount, undefined);
  assert.equal(shaped.raw_payload.trainingStatusDetails.acuteTrainingLoad.acwrPercent, undefined);
});
