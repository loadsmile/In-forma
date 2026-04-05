import { format } from 'date-fns';
import { createPool } from '../db/pool.js';
import { upsertByDate } from '../db/upsert.js';
import { getDailyAnalysisByDate, getDailyHealthMetricsByDate } from '../db/queries/daily.js';
import { claimEmailDelivery, markEmailDeliverySent, releasePendingEmailDelivery } from '../db/queries/email-deliveries.js';
import { insertSyncRun } from '../db/queries/sync-runs.js';
import { getWeeklyDigestDays } from '../db/queries/weekly.js';
import { GARMIN_METRIC_SCHEMA_VERSION, getSyncMetricDate, syncDailySummary } from '../garmin/syncDailySummary.js';
import { renderDailyEmail } from '../email/renderDailyEmail.js';
import { renderWeeklyEmail } from '../email/renderWeeklyEmail.js';
import { sendZapierEmail } from '../email/sendZapierEmail.js';
import { analyzeDailySummary, DAILY_ANALYSIS_PROMPT_VERSION } from '../llm/analyzeDailySummary.js';
import { analyzeWeeklyDigest } from '../llm/analyzeWeeklyDigest.js';
import { buildWeeklyDigest, getWeeklyDigestDateRange } from './buildWeeklyDigest.js';

function getDailyWarningSummary(metrics) {
  const warnings = metrics.raw_payload?.fetchWarnings ?? [];

  return warnings.length > 0
    ? ` Garmin warnings: ${warnings.map((warning) => `${warning.metric}: ${warning.message}`).join('; ')}.`
    : '';
}

function buildDeliveryKey(syncType, metricDate) {
  return `${syncType}:${metricDate}`;
}

async function deliverEmailOnce(client, { deliveryKey, metricDate, syncType, email }) {
  const claimed = await claimEmailDelivery(client, {
    deliveryKey,
    syncType,
    metricDate,
  });

  if (!claimed) {
    return 'skipped';
  }

  try {
    await sendZapierEmail({
      subject: email.subject,
      html: email.html,
      syncType,
    });
    await markEmailDeliverySent(client, deliveryKey);
    return 'sent';
  } catch (error) {
    await releasePendingEmailDelivery(client, deliveryKey);
    throw error;
  }
}

async function runDailySync({ pool, startedAt, syncType, deliveryLabel, forceRefresh, metricDate }) {
  const cachedMetrics = forceRefresh
    ? null
    : await getDailyHealthMetricsByDate(pool, metricDate);
  const reusableMetrics = cachedMetrics?.raw_payload?.schemaVersion === GARMIN_METRIC_SCHEMA_VERSION
    ? cachedMetrics
    : null;
  const metrics = reusableMetrics ?? await syncDailySummary({ syncType });

  if (!reusableMetrics) {
    await upsertByDate(pool, 'daily_health_metrics', metrics);
  }

  const cachedAnalysis = forceRefresh || !reusableMetrics
    ? null
    : await getDailyAnalysisByDate(pool, metrics.metric_date);
  const reusableAnalysis = cachedAnalysis?.prompt_version === DAILY_ANALYSIS_PROMPT_VERSION
    ? cachedAnalysis
    : null;
  const analysis = reusableAnalysis ?? await analyzeDailySummary(metrics);

  if (!reusableAnalysis) {
    await upsertByDate(pool, 'daily_analysis', analysis);
  }

  const email = renderDailyEmail({
    metrics,
    analysis,
    deliveryLabel,
  });
  const deliveryStatus = await deliverEmailOnce(pool, {
    deliveryKey: buildDeliveryKey(syncType, metrics.metric_date),
    metricDate: metrics.metric_date,
    syncType,
    email,
  });

  await insertSyncRun(pool, {
    syncType,
    status: 'success',
    startedAt,
    finishedAt: new Date(),
    metricDate: metrics.metric_date,
    message: `${syncType} sync completed successfully. Metrics: ${reusableMetrics ? 'reused' : 'fetched'}. Analysis: ${reusableAnalysis ? 'reused' : 'generated'}. Email: ${deliveryStatus}.${forceRefresh ? ' Force refresh enabled.' : ''}${getDailyWarningSummary(metrics)}`,
  });
}

async function runWeeklyDigest({ pool, startedAt, syncType, deliveryLabel, metricDate }) {
  const { startMetricDate, endMetricDate } = getWeeklyDigestDateRange(metricDate);
  const days = await getWeeklyDigestDays(pool, startMetricDate, endMetricDate);

  if (days.length < 3) {
    throw new Error(`Weekly digest needs at least 3 synced days. Found ${days.length} between ${startMetricDate} and ${endMetricDate}.`);
  }

  const weeklyDigest = buildWeeklyDigest(days, metricDate);
  const analysis = await analyzeWeeklyDigest(weeklyDigest);
  const email = renderWeeklyEmail({
    weeklyDigest,
    analysis,
    deliveryLabel,
  });
  const deliveryStatus = await deliverEmailOnce(pool, {
    deliveryKey: buildDeliveryKey(syncType, endMetricDate),
    metricDate: endMetricDate,
    syncType,
    email,
  });

  await insertSyncRun(pool, {
    syncType,
    status: 'success',
    startedAt,
    finishedAt: new Date(),
    metricDate: endMetricDate,
    message: `${syncType} digest completed successfully. Days covered: ${weeklyDigest.daysCovered}. Email: ${deliveryStatus}.`,
  });
}

export async function runSync({ syncType, deliveryLabel, forceRefresh = false }) {
  const startedAt = new Date();
  const pool = createPool();
  const metricDate = format(getSyncMetricDate(syncType), 'yyyy-MM-dd');

  try {
    if (syncType === 'weekly') {
      await runWeeklyDigest({
        pool,
        startedAt,
        syncType,
        deliveryLabel,
        metricDate,
      });
    } else {
      await runDailySync({
        pool,
        startedAt,
        syncType,
        deliveryLabel,
        forceRefresh,
        metricDate,
      });
    }
  } catch (error) {
    await insertSyncRun(pool, {
      syncType,
      status: 'failed',
      startedAt,
      finishedAt: new Date(),
      metricDate,
      message: error.message,
    });

    throw error;
  } finally {
    await pool.end();
  }
}
