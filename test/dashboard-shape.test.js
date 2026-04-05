import assert from 'node:assert/strict';
import test from 'node:test';
import { shapeDashboardDay } from '../server/db/queries/dashboard.js';

test('shapeDashboardDay strips large raw payload arrays and keeps UI fields', () => {
  const shaped = shapeDashboardDay({
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
  assert.equal(shaped.raw_payload.hrvDetails.readingCount, undefined);
  assert.equal(shaped.raw_payload.heartRateDetails.heartRateSampleCount, undefined);
  assert.equal(shaped.raw_payload.activities[0].ignored, undefined);
  assert.equal(shaped.raw_payload.activities[0].activityName, 'Walk');
});
