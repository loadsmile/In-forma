import { format, parseISO } from 'date-fns';
import { env } from '../config/env.js';

function getMetricDate(value) {
  return value instanceof Date ? value : parseISO(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDuration(seconds) {
  if (seconds == null) {
    return 'n/a';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

function formatDistance(meters) {
  if (meters == null) {
    return null;
  }

  return `${(meters / 1000).toFixed(2)} km`;
}

function formatMetricDateTime(value, pattern) {
  if (!value) {
    return null;
  }

  return format(getMetricDate(value), pattern);
}

function formatSummary(summary) {
  return escapeHtml(summary ?? '').split('\n').filter(Boolean).join('<br />');
}

function getRecommendationItems(value) {
  const items = (value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  return items.length > 0 ? items : ['No recommendations available.'];
}

function renderList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderSupportedMetrics(metrics) {
  return renderList([
    `Steps: ${metrics.steps ?? 'n/a'}`,
    `Resting heart rate: ${metrics.resting_heart_rate ?? 'n/a'}`,
    `Sleep duration: ${formatDuration(metrics.sleep_seconds)}`,
  ]);
}

function renderRecoverySignals(metrics) {
  const heartRateDetails = metrics.raw_payload?.heartRateDetails;
  const sleepDetails = metrics.raw_payload?.sleepDetails;
  const hrvDetails = metrics.raw_payload?.hrvDetails;
  const trainingStatusDetails = metrics.raw_payload?.trainingStatusDetails;
  const trainingLoadBalanceDetails = metrics.raw_payload?.trainingLoadBalanceDetails;
  const items = [
    hrvDetails?.lastNightAvg == null ? null : `Nightly HRV average: ${hrvDetails.lastNightAvg}`,
    hrvDetails?.weeklyAvg == null ? null : `7-day HRV average: ${hrvDetails.weeklyAvg}`,
    hrvDetails?.status ? `HRV status: ${hrvDetails.status}` : null,
    sleepDetails?.averageRespirationValue == null ? null : `Average overnight respiration: ${sleepDetails.averageRespirationValue}`,
    sleepDetails?.lowestRespirationValue == null || sleepDetails?.highestRespirationValue == null
      ? null
      : `Respiration range: ${sleepDetails.lowestRespirationValue}-${sleepDetails.highestRespirationValue}`,
    sleepDetails?.overnightHeartRateAverage == null ? null : `Average overnight heart rate: ${sleepDetails.overnightHeartRateAverage}`,
    sleepDetails?.bodyBatteryChange == null ? null : `Overnight body battery change: ${sleepDetails.bodyBatteryChange}`,
    heartRateDetails?.lastSevenDaysAvgRestingHeartRate == null
      ? null
      : `7-day resting heart rate average: ${heartRateDetails.lastSevenDaysAvgRestingHeartRate}`,
    trainingStatusDetails?.weeklyTrainingLoad == null ? null : `Weekly training load: ${trainingStatusDetails.weeklyTrainingLoad}`,
    trainingStatusDetails?.acuteTrainingLoad?.acwrStatus ? `Acute load status: ${trainingStatusDetails.acuteTrainingLoad.acwrStatus}` : null,
    trainingStatusDetails?.feedbackPhrase ?? null,
    trainingLoadBalanceDetails?.feedbackPhrase ?? null,
  ].filter(Boolean);

  if (items.length === 0) {
    return '<p style="margin:0 0 24px;line-height:1.6;color:#526274;">Recovery-specific Garmin signals were not available for this day.</p>';
  }

  return `
    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
      ${renderList(items)}
    </ul>
  `;
}

function renderSleepDetails(metrics) {
  const sleepDetails = metrics.raw_payload?.sleepDetails;

  if (!sleepDetails) {
    return '<p style="margin:0 0 24px;line-height:1.6;color:#526274;">Detailed sleep data is not available for this day.</p>';
  }

  return `
    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
      ${renderList([
        `Total sleep: ${formatDuration(sleepDetails.totalSleepSeconds ?? metrics.sleep_seconds)}`,
        `Deep sleep: ${formatDuration(sleepDetails.deepSleepSeconds)}`,
        `Light sleep: ${formatDuration(sleepDetails.lightSleepSeconds)}`,
        `REM sleep: ${formatDuration(sleepDetails.remSleepSeconds)}`,
        `Awake time: ${formatDuration(sleepDetails.awakeSleepSeconds)}`,
        `Sleep score: ${sleepDetails.sleepScore ?? 'n/a'}`,
        `Awake count: ${sleepDetails.awakeCount ?? 'n/a'}`,
        `Restless moments: ${sleepDetails.restlessMomentsCount ?? 'n/a'}`,
        `REM data available: ${sleepDetails.remSleepData == null ? 'n/a' : sleepDetails.remSleepData ? 'Yes' : 'No'}`,
        `Sleep movement samples: ${sleepDetails.sleepMovement?.length ?? 0}`,
        `Sleep stage samples: ${sleepDetails.sleepLevels?.length ?? 0}`,
      ])}
    </ul>
  `;
}

function renderActivities(metrics) {
  const activities = Array.isArray(metrics.raw_payload?.activities) ? metrics.raw_payload.activities : [];

  if (activities.length === 0) {
    return '<p style="margin:0 0 24px;line-height:1.6;color:#526274;">No completed Garmin activities were recorded for this day.</p>';
  }

  const items = activities.map((activity) => {
    const details = [
      formatMetricDateTime(activity.startTimeLocal, 'HH:mm'),
      formatDuration(activity.duration),
      formatDistance(activity.distance),
      activity.calories == null ? null : `${activity.calories} kcal`,
      activity.averageHR == null ? null : `Avg HR ${activity.averageHR}`,
      activity.steps == null ? null : `${activity.steps} steps`,
    ].filter(Boolean).join(' • ');

    return `<li><strong>${escapeHtml(activity.activityName ?? 'Unnamed activity')}</strong>${details ? `<br /><span style="color:#526274;">${escapeHtml(details)}</span>` : ''}</li>`;
  }).join('');

  return `
    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
      ${items}
    </ul>
  `;
}

export function renderDailyEmail({ metrics, analysis, deliveryLabel }) {
  const formattedDate = format(getMetricDate(metrics.metric_date), 'EEEE, d MMMM yyyy');
  const subject = `${env.personName}'s fitness update for ${formattedDate}`;
  const recommendationItems = getRecommendationItems(analysis.recommendations);

  const html = `
    <html>
      <body style="margin:0;padding:24px;background:#f3f7fb;font-family:Arial,sans-serif;color:#102033;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;padding:32px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#426bff;">${escapeHtml(deliveryLabel)}</p>
                    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;">${escapeHtml(env.personName)}'s daily fitness check-in</h1>
                    <p style="margin:0 0 24px;color:#526274;">${formattedDate}</p>
                    <h2 style="margin:0 0 12px;font-size:18px;">Summary</h2>
                    <p style="margin:0 0 20px;line-height:1.6;">${formatSummary(analysis.summary)}</p>
                    <h2 style="margin:0 0 12px;font-size:18px;">Sleep details</h2>
                    ${renderSleepDetails(metrics)}
                    <h2 style="margin:0 0 12px;font-size:18px;">Completed activities</h2>
                    ${renderActivities(metrics)}
                    <h2 style="margin:0 0 12px;font-size:18px;">Supported daily metrics</h2>
                    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
                      ${renderSupportedMetrics(metrics)}
                    </ul>
                    <h2 style="margin:0 0 12px;font-size:18px;">Recovery signals</h2>
                    ${renderRecoverySignals(metrics)}
                    <h2 style="margin:0 0 12px;font-size:18px;">Recommendations for tomorrow</h2>
                    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
                      ${renderList(recommendationItems)}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return {
    subject,
    html,
  };
}
