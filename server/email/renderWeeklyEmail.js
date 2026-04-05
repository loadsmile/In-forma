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

function renderDailyBreakdown(days) {
  return days.map((day) => `
    <li>
      <strong>${escapeHtml(format(getMetricDate(day.metricDate), 'EEE, d MMM'))}</strong><br />
      <span style="color:#526274;">
        Steps ${escapeHtml(day.steps ?? 'n/a')} • Sleep ${escapeHtml(formatDuration(day.sleepSeconds))} • Resting HR ${escapeHtml(day.restingHeartRate ?? 'n/a')} • Sleep score ${escapeHtml(day.sleepScore ?? 'n/a')} • Nightly HRV ${escapeHtml(day.nightlyHrv ?? 'n/a')} • Activities ${escapeHtml(day.activityCount)}
      </span>
    </li>
  `).join('');
}

export function renderWeeklyEmail({ weeklyDigest, analysis, deliveryLabel }) {
  const subject = `${env.personName}'s weekly fitness digest`;
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
                    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;">${escapeHtml(env.personName)}'s weekly fitness digest</h1>
                    <p style="margin:0 0 24px;color:#526274;">${escapeHtml(weeklyDigest.range.startMetricDate)} to ${escapeHtml(weeklyDigest.range.endMetricDate)}</p>
                    <h2 style="margin:0 0 12px;font-size:18px;">Weekly summary</h2>
                    <p style="margin:0 0 20px;line-height:1.6;">${escapeHtml(analysis.summary).replaceAll('\n', '<br />')}</p>
                    <h2 style="margin:0 0 12px;font-size:18px;">Week at a glance</h2>
                    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
                      ${renderList([
                        `Days covered: ${weeklyDigest.daysCovered}`,
                        `Total steps: ${weeklyDigest.aggregates.totalSteps ?? 'n/a'}`,
                        `Average steps: ${weeklyDigest.aggregates.averageSteps ?? 'n/a'}`,
                        `Average sleep: ${formatDuration(weeklyDigest.aggregates.averageSleepSeconds)}`,
                        `Average resting HR: ${weeklyDigest.aggregates.averageRestingHeartRate ?? 'n/a'}`,
                        `Average sleep score: ${weeklyDigest.aggregates.averageSleepScore ?? 'n/a'}`,
                        `Average nightly HRV: ${weeklyDigest.aggregates.averageNightlyHrv ?? 'n/a'}`,
                        `Total activities: ${weeklyDigest.aggregates.totalActivities}`,
                        weeklyDigest.aggregates.bestStepDay ? `Best steps day: ${weeklyDigest.aggregates.bestStepDay.metricDate} (${weeklyDigest.aggregates.bestStepDay.steps} steps)` : 'Best steps day: n/a',
                      ])}
                    </ul>
                    <h2 style="margin:0 0 12px;font-size:18px;">Daily breakdown</h2>
                    <ul style="padding-left:18px;line-height:1.8;color:#243447;margin:0 0 24px;">
                      ${renderDailyBreakdown(weeklyDigest.dailyBreakdown)}
                    </ul>
                    <h2 style="margin:0 0 12px;font-size:18px;">Recommendations for next week</h2>
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
