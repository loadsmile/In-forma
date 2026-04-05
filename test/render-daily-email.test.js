import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PERSON_NAME = '<b>Mariana</b>';

const { renderDailyEmail } = await import('../server/email/renderDailyEmail.js');

test('renderDailyEmail escapes injected HTML content', () => {
  const email = renderDailyEmail({
    deliveryLabel: '<script>alert(1)</script>',
    metrics: {
      metric_date: '2026-04-04',
      steps: 8200,
      resting_heart_rate: 58,
      sleep_seconds: 28800,
      raw_payload: {
        sleepDetails: {
          totalSleepSeconds: 28800,
          deepSleepSeconds: 3600,
          lightSleepSeconds: 14400,
          remSleepSeconds: 7200,
          awakeSleepSeconds: 600,
          sleepScore: 81,
          awakeCount: 1,
          restlessMomentsCount: 3,
          remSleepData: true,
          sleepMovement: [],
          sleepLevels: [],
        },
        activities: [
          {
            activityName: '<img src=x onerror=alert(1)>',
            startTimeLocal: '2026-04-04T09:00:00',
            duration: 1800,
          },
        ],
      },
    },
    analysis: {
      summary: '<script>alert(1)</script>',
      recommendations: '- <b>Walk</b>',
    },
  });

  assert.equal(email.html.includes('<script>alert(1)</script>'), false);
  assert.equal(email.html.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(email.html.includes('<b>Walk</b>'), false);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
