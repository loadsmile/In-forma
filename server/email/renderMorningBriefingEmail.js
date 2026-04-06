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

function renderList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
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

function formatSummary(summary) {
  return escapeHtml(summary ?? '').split('\n').filter(Boolean).join('<br />');
}

function renderMorningRecovery(overnightRecovery) {
  const sleepDetails = overnightRecovery.raw_payload?.sleepDetails;

  if (!sleepDetails) {
    return '<p style="margin:0 0 24px;line-height:1.6;color:#526274;">Last-night recovery details are not available.</p>';
  }

  return `
    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
      ${renderList([
        `Total sleep: ${formatDuration(overnightRecovery.sleep_seconds)}`,
        `Sleep score: ${overnightRecovery.sleep_score ?? 'n/a'}`,
        `Nightly HRV: ${overnightRecovery.last_night_hrv ?? 'n/a'}`,
        `Resting heart rate: ${overnightRecovery.resting_heart_rate ?? 'n/a'}`,
        `Deep sleep: ${formatDuration(sleepDetails.deepSleepSeconds)}`,
        `Light sleep: ${formatDuration(sleepDetails.lightSleepSeconds)}`,
        `REM sleep: ${formatDuration(sleepDetails.remSleepSeconds)}`,
        `Awake time: ${formatDuration(sleepDetails.awakeSleepSeconds)}`,
        `Restless moments: ${sleepDetails.restlessMomentsCount ?? 'n/a'}`,
        `Body battery change: ${overnightRecovery.body_battery_change ?? 'n/a'}`,
      ])}
    </ul>
  `;
}

function renderYesterdayActivity(reviewedDay) {
  const activities = Array.isArray(reviewedDay.raw_payload?.activities) ? reviewedDay.raw_payload.activities : [];

  const activityMarkup = activities.length > 0
    ? `
        <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
          ${activities.map((activity) => {
            const details = [
              formatMetricDateTime(activity.startTimeLocal, 'HH:mm'),
              formatDuration(activity.duration),
              formatDistance(activity.distance),
              activity.calories == null ? null : `${activity.calories} kcal`,
              activity.averageHR == null ? null : `Avg HR ${activity.averageHR}`,
            ].filter(Boolean).join(' • ');

            return `<li><strong>${escapeHtml(activity.activityName ?? 'Unnamed activity')}</strong>${details ? `<br /><span style="color:#526274;">${escapeHtml(details)}</span>` : ''}</li>`;
          }).join('')}
        </ul>
      `
    : '<p style="margin:0 0 24px;line-height:1.6;color:#526274;">No completed Garmin activities were recorded yesterday.</p>';

  return `
    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 16px;">
      ${renderList([
        `Steps: ${reviewedDay.steps ?? 'n/a'}`,
        `Resting heart rate: ${reviewedDay.resting_heart_rate ?? 'n/a'}`,
        `Training load: ${reviewedDay.raw_payload?.trainingStatusDetails?.weeklyTrainingLoad ?? 'n/a'}`,
      ])}
    </ul>
    ${activityMarkup}
  `;
}

export function renderMorningBriefingEmail({ briefing, reviewedDay, overnightRecovery, deliveryLabel }) {
  const briefingDate = format(getMetricDate(briefing.briefing_date), 'EEEE, d MMMM yyyy');
  const reviewedDate = format(getMetricDate(reviewedDay.metric_date), 'EEEE, d MMMM yyyy');
  const recommendationItems = getRecommendationItems(briefing.recommendations);
  const subject = `${env.personName}'s today briefing for ${briefingDate}`;

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
                    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;">${escapeHtml(env.personName)}'s today briefing</h1>
                    <p style="margin:0 0 24px;color:#526274;">${escapeHtml(briefingDate)}</p>
                    <h2 style="margin:0 0 12px;font-size:18px;">Today at a glance</h2>
                    <p style="margin:0 0 20px;line-height:1.6;">${formatSummary(briefing.summary)}</p>
                    <h2 style="margin:0 0 12px;font-size:18px;">How you slept last night</h2>
                    ${renderMorningRecovery(overnightRecovery)}
                    <h2 style="margin:0 0 12px;font-size:18px;">Yesterday in review</h2>
                    <p style="margin:0 0 12px;color:#526274;">Reviewed day: ${escapeHtml(reviewedDate)}</p>
                    ${renderYesterdayActivity(reviewedDay)}
                    <h2 style="margin:0 0 12px;font-size:18px;">What to do today</h2>
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
