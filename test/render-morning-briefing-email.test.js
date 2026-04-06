import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PERSON_NAME = '<b>Mariana</b>';

const { renderMorningBriefingEmail } = await import('../server/email/renderMorningBriefingEmail.js');

test('renderMorningBriefingEmail escapes injected HTML content', () => {
  const email = renderMorningBriefingEmail({
    deliveryLabel: '<script>alert(1)</script>',
    briefing: {
      briefing_date: '2026-04-05',
      summary: '<script>alert(1)</script>',
      recommendations: '- <b>Train</b>',
    },
    reviewedDay: {
      metric_date: '2026-04-04',
      steps: 8000,
      resting_heart_rate: 58,
      raw_payload: {
        trainingStatusDetails: { weeklyTrainingLoad: 320 },
        activities: [
          {
            activityName: '<img src=x onerror=alert(1)>',
            startTimeLocal: '2026-04-04T09:00:00',
            duration: 1800,
          },
        ],
      },
    },
    overnightRecovery: {
      recovery_date: '2026-04-05',
      sleep_seconds: 28800,
      sleep_score: 82,
      resting_heart_rate: 54,
      last_night_hrv: 46,
      body_battery_change: 37,
      raw_payload: {
        sleepDetails: {
          deepSleepSeconds: 3600,
          lightSleepSeconds: 14400,
          remSleepSeconds: 7200,
          awakeSleepSeconds: 600,
          restlessMomentsCount: 3,
        },
      },
    },
  });

  assert.equal(email.html.includes('<script>alert(1)</script>'), false);
  assert.equal(email.html.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(email.html.includes('<b>Train</b>'), false);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
