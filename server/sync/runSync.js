import { format } from 'date-fns';
import { createPool } from '../db/pool.js';
import { upsertByDate } from '../db/upsert.js';
import { getDailyAnalysisByDate, getDailyHealthMetricsByDate } from '../db/queries/daily.js';
import { insertSyncRun } from '../db/queries/sync-runs.js';
import { GARMIN_METRIC_SCHEMA_VERSION, getSyncMetricDate, syncDailySummary } from '../garmin/syncDailySummary.js';
import { analyzeDailySummary, DAILY_ANALYSIS_PROMPT_VERSION } from '../llm/analyzeDailySummary.js';
import { renderDailyEmail } from '../email/renderDailyEmail.js';
import { sendZapierEmail } from '../email/sendZapierEmail.js';

export async function runSync({ syncType, deliveryLabel, forceRefresh = false }) {
  const startedAt = new Date();
  const pool = createPool();
  const metricDate = format(getSyncMetricDate(syncType), 'yyyy-MM-dd');

  try {
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

    await sendZapierEmail({
      subject: email.subject,
      html: email.html,
      syncType,
    });

    await insertSyncRun(pool, {
      syncType,
      status: 'success',
      startedAt,
      finishedAt: new Date(),
      metricDate: metrics.metric_date,
      message: `${syncType} sync completed successfully. Metrics: ${reusableMetrics ? 'reused' : 'fetched'}. Analysis: ${reusableAnalysis ? 'reused' : 'generated'}.${forceRefresh ? ' Force refresh enabled.' : ''}`,
    });
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
