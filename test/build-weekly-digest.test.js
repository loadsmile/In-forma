import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyDigest } from '../server/sync/buildWeeklyDigest.js';

test('buildWeeklyDigest aggregates seven-day metrics correctly', () => {
  const digest = buildWeeklyDigest([
    {
      metric_date: '2026-04-01',
      steps: 4000,
      resting_heart_rate: 60,
      sleep_seconds: 25200,
      summary: 'Day 1',
      raw_payload: { sleepDetails: { sleepScore: 75 }, hrvDetails: { lastNightAvg: 41 }, activities: [{}, {}] },
    },
    {
      metric_date: '2026-04-02',
      steps: 6000,
      resting_heart_rate: 58,
      sleep_seconds: 27000,
      summary: 'Day 2',
      raw_payload: { sleepDetails: { sleepScore: 80 }, hrvDetails: { lastNightAvg: 45 }, activities: [{}] },
    },
    {
      metric_date: '2026-04-03',
      steps: 8000,
      resting_heart_rate: 56,
      sleep_seconds: 28800,
      summary: 'Day 3',
      raw_payload: { sleepDetails: { sleepScore: 85 }, hrvDetails: { lastNightAvg: 49 }, activities: [] },
    },
  ], '2026-04-03');

  assert.equal(digest.range.startMetricDate, '2026-03-28');
  assert.equal(digest.range.endMetricDate, '2026-04-03');
  assert.equal(digest.daysCovered, 3);
  assert.equal(digest.aggregates.totalSteps, 18000);
  assert.equal(digest.aggregates.averageSteps, 6000);
  assert.equal(digest.aggregates.averageRestingHeartRate, 58);
  assert.equal(digest.aggregates.averageSleepScore, 80);
  assert.equal(digest.aggregates.averageNightlyHrv, 45);
  assert.equal(digest.aggregates.totalActivities, 3);
  assert.deepEqual(digest.aggregates.bestStepDay, {
    metricDate: '2026-04-03',
    steps: 8000,
  });
});
