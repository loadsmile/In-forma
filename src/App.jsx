import { format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';

function getMetricDate(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : parseISO(value);
}

function formatMetricDate(value, pattern = 'EEEE, d MMMM yyyy') {
  const date = getMetricDate(value);

  return date ? format(date, pattern) : 'No data yet';
}

function formatClockTime(value) {
  if (value == null) {
    return 'n/a';
  }

  const date = typeof value === 'number' ? new Date(value) : getMetricDate(value);

  return date && !Number.isNaN(date.getTime()) ? format(date, 'HH:mm') : 'n/a';
}

function formatTimestamp(value) {
  if (!value) {
    return 'Pending';
  }

  return format(new Date(value), 'd MMM yyyy, HH:mm');
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
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatNumber(value) {
  return value == null ? 'n/a' : new Intl.NumberFormat().format(value);
}

function isMissingMetric(value) {
  return value == null || value === 'n/a';
}

function displayMetricValue(value) {
  return isMissingMetric(value) ? '--' : value;
}

function displayMetricHint(value, availableText, missingText = 'Awaiting data') {
  return isMissingMetric(value) ? missingText : availableText;
}

function MetricDisplay({ value }) {
  return isMissingMetric(value)
    ? <span className="metric-empty-pill">--</span>
    : value;
}

function formatDistance(meters) {
  if (meters == null) {
    return null;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function getRecommendationItems(value) {
  return (value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

function getActivities(day) {
  return Array.isArray(day?.raw_payload?.activities) ? day.raw_payload.activities : [];
}

function getSleepDetails(day) {
  return day?.raw_payload?.sleepDetails ?? null;
}

function getHeartRateDetails(day) {
  return day?.raw_payload?.heartRateDetails ?? null;
}

function getHrvDetails(day) {
  return day?.raw_payload?.hrvDetails ?? null;
}

function getTrainingStatusDetails(day) {
  return day?.raw_payload?.trainingStatusDetails ?? null;
}

function getTrainingLoadBalanceDetails(day) {
  return day?.raw_payload?.trainingLoadBalanceDetails ?? null;
}

function getSleepScore(day) {
  return getSleepDetails(day)?.sleepScore ?? null;
}

function getNightlyHrv(day) {
  return getHrvDetails(day)?.lastNightAvg ?? null;
}

function buildSleepStages(day) {
  const sleepDetails = getSleepDetails(day);
  const stages = [
    { label: 'Deep', seconds: sleepDetails?.deepSleepSeconds ?? null, tone: 'deep' },
    { label: 'Light', seconds: sleepDetails?.lightSleepSeconds ?? null, tone: 'light' },
    { label: 'REM', seconds: sleepDetails?.remSleepSeconds ?? null, tone: 'rem' },
    { label: 'Awake', seconds: sleepDetails?.awakeSleepSeconds ?? null, tone: 'awake' },
  ].filter((stage) => stage.seconds != null);

  const total = stages.reduce((sum, stage) => sum + stage.seconds, 0);

  return stages.map((stage) => ({
    ...stage,
    ratio: total > 0 ? stage.seconds / total : 0,
  }));
}

function buildSleepTimelineLabels(day) {
  const sleepDetails = getSleepDetails(day);
  const start = sleepDetails?.sleepStartTimestampLocal ?? null;
  const end = sleepDetails?.sleepEndTimestampLocal ?? null;
  const midpoint = start != null && end != null ? start + Math.round((end - start) / 2) : null;

  return [formatClockTime(start), formatClockTime(midpoint), formatClockTime(end)];
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildTrendSummary(days) {
  const recentDays = days.slice(0, 3);
  const stepValues = recentDays.map((day) => day.steps).filter((value) => value != null);
  const hrvValues = recentDays.map((day) => getNightlyHrv(day)).filter((value) => value != null);
  const heartValues = recentDays.map((day) => day.resting_heart_rate).filter((value) => value != null);
  const sleepScoreValues = recentDays.map((day) => getSleepScore(day)).filter((value) => value != null);

  return {
    averageSteps: average(stepValues),
    averageNightlyHrv: average(hrvValues),
    averageRestingHeartRate: average(heartValues),
    averageSleepScore: average(sleepScoreValues),
  };
}

function createSeriesPath(points, width, height, padding) {
  const validPoints = points.filter((point) => point.y != null);

  if (validPoints.length === 0) {
    return '';
  }

  const values = validPoints.map((point) => point.y);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue || 1;

  return validPoints.map((point, index) => {
    const x = padding + point.x * (width - padding * 2);
    const normalized = (point.y - minValue) / span;
    const y = height - padding - normalized * (height - padding * 2);

    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}

function buildChartPoints(days, selector) {
  const orderedDays = [...days].reverse();
  const lastIndex = Math.max(orderedDays.length - 1, 1);

  return orderedDays.map((day, index) => ({
    label: formatMetricDate(day.metric_date, 'EEE'),
    y: selector(day),
    x: index / lastIndex,
  }));
}

function buildSeriesCoordinates(points, width, height, padding) {
  const validPoints = points.filter((point) => point.y != null);

  if (validPoints.length === 0) {
    return [];
  }

  const values = validPoints.map((point) => point.y);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue || 1;

  return validPoints.map((point) => ({
    ...point,
    cx: padding + point.x * (width - padding * 2),
    cy: height - padding - ((point.y - minValue) / span) * (height - padding * 2),
  }));
}

function buildRecoveryRows(day) {
  const heartRateDetails = getHeartRateDetails(day);
  const sleepDetails = getSleepDetails(day);
  const hrvDetails = getHrvDetails(day);
  const trainingStatusDetails = getTrainingStatusDetails(day);
  const trainingLoadBalanceDetails = getTrainingLoadBalanceDetails(day);

  return [
    {
      label: 'Nightly HRV',
      value: hrvDetails?.lastNightAvg ?? null,
      detail: displayMetricHint(hrvDetails?.lastNightAvg ?? null, hrvDetails?.status ?? 'Recovery variability'),
    },
    {
      label: '7-day HR baseline',
      value: heartRateDetails?.lastSevenDaysAvgRestingHeartRate ?? null,
      detail: heartRateDetails?.lastSevenDaysAvgRestingHeartRate == null
        ? 'Awaiting data'
        : heartRateDetails?.maxHeartRate == null || heartRateDetails?.minHeartRate == null
        ? 'Range unavailable'
        : `Day range ${heartRateDetails.minHeartRate}-${heartRateDetails.maxHeartRate}`,
    },
    {
      label: 'Respiration',
      value: sleepDetails?.averageRespirationValue ?? null,
      detail: sleepDetails?.averageRespirationValue == null
        ? 'Awaiting data'
        : sleepDetails?.lowestRespirationValue == null || sleepDetails?.highestRespirationValue == null
        ? 'No overnight range'
        : `Overnight range ${sleepDetails.lowestRespirationValue}-${sleepDetails.highestRespirationValue}`,
    },
    {
      label: 'Body battery change',
      value: sleepDetails?.bodyBatteryChange ?? null,
      detail: sleepDetails?.bodyBatteryChange == null
        ? 'Awaiting data'
        : sleepDetails?.overnightBodyBatteryEnd == null
        ? 'End value unavailable'
        : `Wake-up value ${sleepDetails.overnightBodyBatteryEnd}`,
    },
    {
      label: 'Training load',
      value: trainingStatusDetails?.weeklyTrainingLoad ?? null,
      detail: displayMetricHint(trainingStatusDetails?.weeklyTrainingLoad ?? null, trainingStatusDetails?.acuteTrainingLoad?.acwrStatus ?? 'Garmin load signal'),
    },
    {
      label: 'Load balance',
      value: trainingLoadBalanceDetails?.monthlyLoadAerobicHigh ?? null,
      detail: displayMetricHint(trainingLoadBalanceDetails?.monthlyLoadAerobicHigh ?? null, trainingLoadBalanceDetails?.feedbackPhrase ?? 'Load distribution'),
    },
  ];
}

function MiniTrendRow({ label, points, colorClass }) {
  const width = 320;
  const height = 72;
  const padding = 14;
  const coordinates = buildSeriesCoordinates(points, width, height, padding);
  const hasData = coordinates.length > 0;
  const hasTrend = coordinates.length > 1;
  const latestValue = hasData ? coordinates.at(-1).y : null;
  const latestLabel = hasData ? coordinates.at(-1).label : null;

  return (
    <div className="mini-trend-row">
      <div className="mini-trend-header">
        <div>
          <span>{label}</span>
          <strong><MetricDisplay value={latestValue} /></strong>
        </div>
        <small>{displayMetricHint(latestValue, latestLabel ? `Latest ${latestLabel}` : 'Latest reading')}</small>
      </div>

      {hasData ? (
        <>
          <svg className="mini-trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} over recent days`}>
            {hasTrend ? <path className={`mini-trend-path ${colorClass}`} d={createSeriesPath(points, width, height, padding)} /> : null}
            {coordinates.map((point) => (
              <g key={`${label}-${point.label}`}>
                <circle className={`mini-trend-dot ${colorClass}`} cx={point.cx} cy={point.cy} r="5" />
                <text className="mini-trend-value" x={point.cx} y={point.cy - 10} textAnchor="middle">{point.y}</text>
              </g>
            ))}
          </svg>
          <div className="mini-trend-labels" aria-hidden="true">
            {points.map((point) => (
              <span key={`${label}-${point.label}-label`}>{point.label}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="mini-trend-empty">Awaiting data</div>
      )}
    </div>
  );
}

function RecoveryTrendChart({ days }) {
  const orderedDays = [...days].reverse();
  const maxSteps = Math.max(...orderedDays.map((day) => day.steps ?? 0), 1);
  const averageSteps = average(orderedDays.map((day) => day.steps).filter((value) => value != null));
  const hrvPoints = buildChartPoints(days, (day) => getNightlyHrv(day));
  const heartRatePoints = buildChartPoints(days, (day) => day.resting_heart_rate ?? null);
  const sleepScorePoints = buildChartPoints(days, (day) => getSleepScore(day));

  return (
    <div className="chart-shell">
      <div className="steps-chart-header">
        <div>
          <span>Daily steps</span>
          <strong><MetricDisplay value={averageSteps == null ? null : formatNumber(averageSteps)} /></strong>
        </div>
        <small>{orderedDays.length} synced days</small>
      </div>

      <div className="chart-bars" aria-hidden="true">
        {orderedDays.map((day) => {
          const stepsHeight = Math.max(((day.steps ?? 0) / maxSteps) * 100, day.steps ? 18 : 10);

          return (
            <div key={day.metric_date} className="chart-column">
              <div className="chart-track">
                <div className="chart-bar" style={{ height: `${stepsHeight}%` }} />
              </div>
              <span className="chart-value">{day.steps ? `${Math.round((day.steps ?? 0) / 1000)}k` : '--'}</span>
              <span className="chart-label">{formatMetricDate(day.metric_date, 'EEE')}</span>
            </div>
          );
        })}
      </div>

      <div className="mini-trend-grid">
        <MiniTrendRow label="Nightly HRV" points={hrvPoints} colorClass="series-hrv" />
        <MiniTrendRow label="Resting HR" points={heartRatePoints} colorClass="series-heart" />
        <MiniTrendRow label="Sleep score" points={sleepScorePoints} colorClass="series-sleep" />
      </div>
    </div>
  );
}

function SleepStageCard({ focusDay }) {
  const sleepDetails = getSleepDetails(focusDay);
  const stages = buildSleepStages(focusDay);
  const timelineLabels = buildSleepTimelineLabels(focusDay);

  return (
    <article className="panel panel-sleep">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Sleep architecture</p>
          <h2>Overnight profile</h2>
        </div>
        <span>{formatDuration(focusDay?.sleep_seconds)}</span>
      </div>

      {stages.length > 0 ? (
        <>
          <div className="sleep-composition" aria-label="Sleep stage composition">
            {stages.map((stage) => (
              <span
                key={stage.label}
                className={`sleep-segment tone-${stage.tone}`}
                style={{ width: `${Math.max(stage.ratio * 100, 8)}%` }}
              />
            ))}
          </div>

          <div className="sleep-timeline" aria-hidden="true">
            {timelineLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="sleep-stage-grid">
            {stages.map((stage) => (
              <div key={stage.label} className="sleep-stage-chip">
                <span className={`stage-dot tone-${stage.tone}`} />
                <div>
                  <strong>{stage.label}</strong>
                  <span>{formatDuration(stage.seconds)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="muted-copy">Sleep stages were not available for the latest synced day.</p>
      )}

      <dl className="sleep-facts">
        <div>
          <dt>Restless moments</dt>
          <dd><MetricDisplay value={sleepDetails?.restlessMomentsCount ?? null} /></dd>
        </div>
        <div>
          <dt>Awake count</dt>
          <dd><MetricDisplay value={sleepDetails?.awakeCount ?? null} /></dd>
        </div>
        <div>
          <dt>Sleep score</dt>
          <dd><MetricDisplay value={sleepDetails?.sleepScore ?? null} /></dd>
        </div>
        <div>
          <dt>REM ready</dt>
          <dd>{sleepDetails?.remSleepData == null ? '--' : sleepDetails.remSleepData ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
    </article>
  );
}

function ActivityPanel({ focusDay }) {
  const activities = getActivities(focusDay);

  return (
    <article className="panel panel-activities">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Completed sessions</p>
          <h2>Previous day movement</h2>
        </div>
        <span>{activities.length} logged</span>
      </div>

      {activities.length > 0 ? (
        <ul className="activity-list">
          {activities.map((activity) => {
            const details = [
              activity.startTimeLocal ? formatMetricDate(activity.startTimeLocal, 'HH:mm') : null,
              formatDuration(activity.duration),
              formatDistance(activity.distance),
              activity.calories == null ? null : `${activity.calories} kcal`,
              activity.averageHR == null ? null : `Avg HR ${activity.averageHR}`,
            ].filter(Boolean);

            return (
              <li key={activity.activityId ?? `${activity.activityName}-${activity.startTimeLocal}`}>
                <div>
                  <strong>{activity.activityName}</strong>
                  <span>{details.join(' • ')}</span>
                </div>
                <span className="activity-type">{activity.activityType?.replaceAll('_', ' ') ?? 'Activity'}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted-copy">No completed Garmin activities were recorded for the previous day.</p>
      )}
    </article>
  );
}

function SyncPanel({ recentRuns }) {
  return (
    <article className="panel panel-sync">
      <div className="panel-heading compact">
        <div>
          <p className="panel-kicker">Pipeline pulse</p>
          <h2>Recent syncs</h2>
        </div>
      </div>

      <ul className="sync-list">
        {recentRuns.map((run) => (
          <li key={run.id}>
            <span className={`sync-status status-${run.status}`}>{run.status}</span>
            <div>
              <strong>{run.sync_type}</strong>
              <span>{formatTimestamp(run.started_at)}</span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function RecoveryPanel({ focusDay }) {
  const rows = buildRecoveryRows(focusDay);
  const trainingStatusDetails = getTrainingStatusDetails(focusDay);
  const trainingLoadBalanceDetails = getTrainingLoadBalanceDetails(focusDay);
  const hrvDetails = getHrvDetails(focusDay);

  return (
    <article className="panel panel-recovery">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Recovery signals</p>
          <h2>Readiness markers</h2>
        </div>
        <span>{hrvDetails?.status ?? 'Passive data only'}</span>
      </div>

      <div className="recovery-grid">
        {rows.map((row) => (
          <div key={row.label} className="recovery-card">
            <span>{row.label}</span>
            <strong><MetricDisplay value={row.value} /></strong>
            <small>{row.detail}</small>
          </div>
        ))}
      </div>

      <div className="recovery-notes">
        <div>
          <span>Training status</span>
          <strong>{trainingStatusDetails?.feedbackPhrase ?? 'No Garmin training-status feedback for this day.'}</strong>
        </div>
        <div>
          <span>Load balance</span>
          <strong>{trainingLoadBalanceDetails?.feedbackPhrase ?? 'No Garmin load-balance feedback for this day.'}</strong>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);

      try {
        const response = await fetch('/api/dashboard');

        if (!response.ok) {
          throw new Error(`Dashboard request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!active) {
          return;
        }

        setDashboard(data);
        setError('');
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const focusDay = dashboard?.focusDay ?? null;
  const recentDays = dashboard?.recentDays ?? [];
  const recentRuns = dashboard?.recentRuns ?? [];
  const recommendations = getRecommendationItems(focusDay?.recommendations);
  const trendSummary = buildTrendSummary(recentDays);
  const activities = getActivities(focusDay);

  if (!loading && !error && !focusDay) {
    return (
      <main className="dashboard-shell empty-shell">
        <section className="empty-state panel">
          <p className="panel-kicker">No synced days yet</p>
          <h1>Run a morning sync to generate the first recovery dashboard.</h1>
          <p className="muted-copy">The dashboard will populate after Garmin metrics and analysis are stored in the database.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero panel">
        <div className="hero-copy-block">
          <div className="brand-lockup">
            <div className="brand-badge" aria-hidden="true">
              <span className="brand-node node-primary" />
              <span className="brand-node node-secondary" />
              <span className="brand-node node-tertiary" />
              <span className="brand-stem" />
            </div>
            <div>
              <p className="panel-kicker">Daily recovery dashboard</p>
              <div className="brand-title-row">
                <span className="brand-mark">In-Forma</span>
              </div>
            </div>
          </div>
          <h1>Yesterday, decoded for tomorrow.</h1>
          <p className="hero-copy-text">
            A previous-day health view with sleep depth, HRV, training load, completed activity context, and next-day recommendations grounded in the last synced Garmin data.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-pill">
            <span className="meta-label">Reviewed day</span>
            <strong>{formatMetricDate(focusDay?.metric_date)}</strong>
          </div>
          <div className="meta-pill">
            <span className="meta-label">Status</span>
            <strong>{loading ? 'Refreshing' : error ? 'Connection issue' : 'Live'}</strong>
          </div>
          <div className="meta-pill accent-pill">
            <span className="meta-label">Activities</span>
            <strong>{activities.length}</strong>
          </div>
        </div>
      </section>

      {error ? <section className="inline-alert">{error}</section> : null}

      <section className="dashboard-grid">
        <article className="panel panel-focus">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Previous day brief</p>
              <h2>{formatMetricDate(focusDay?.metric_date, 'EEEE')}</h2>
            </div>
            <span>{focusDay?.model ?? 'Analysis pending'}</span>
          </div>

          <p className="focus-summary">{focusDay?.summary ?? 'No analysis stored yet.'}</p>

          <div className="snapshot-grid">
            <div className="snapshot-card lime-card">
              <span>Steps</span>
              <strong><MetricDisplay value={focusDay?.steps == null ? null : formatNumber(focusDay.steps)} /></strong>
              <small>{displayMetricHint(focusDay?.steps ?? null, 'Previous day total')}</small>
            </div>
            <div className="snapshot-card cream-card">
              <span>Sleep</span>
              <strong><MetricDisplay value={focusDay?.sleep_seconds == null ? null : formatDuration(focusDay.sleep_seconds)} /></strong>
              <small>{displayMetricHint(focusDay?.sleep_seconds ?? null, 'Total overnight duration')}</small>
            </div>
            <div className="snapshot-card blush-card">
              <span>Nightly HRV</span>
              <strong><MetricDisplay value={getNightlyHrv(focusDay)} /></strong>
              <small>{displayMetricHint(getNightlyHrv(focusDay), getHrvDetails(focusDay)?.status ?? 'Recovery variability')}</small>
            </div>
            <div className="snapshot-card slate-card">
              <span>Resting HR</span>
              <strong><MetricDisplay value={focusDay?.resting_heart_rate ?? null} /></strong>
              <small>{displayMetricHint(focusDay?.resting_heart_rate ?? null, 'Baseline pulse')}</small>
            </div>
            <div className="snapshot-card olive-card">
              <span>Training load</span>
              <strong><MetricDisplay value={getTrainingStatusDetails(focusDay)?.weeklyTrainingLoad ?? null} /></strong>
              <small>{displayMetricHint(getTrainingStatusDetails(focusDay)?.weeklyTrainingLoad ?? null, getTrainingStatusDetails(focusDay)?.acuteTrainingLoad?.acwrStatus ?? 'Garmin load signal')}</small>
            </div>
          </div>
        </article>

        <article className="panel panel-recommendations">
          <div className="panel-heading compact">
            <div>
              <p className="panel-kicker">Tomorrow focus</p>
              <h2>Recommendations</h2>
            </div>
          </div>

          <ul className="recommendation-list">
            {recommendations.length > 0 ? (
              recommendations.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>Recommendations will appear here after the latest analysis finishes.</li>
            )}
          </ul>
        </article>

        <article className="panel panel-trends">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">3-day rhythm</p>
              <h2>Recovery trendline</h2>
            </div>
            <span>{recentDays.length} days loaded</span>
          </div>

          <div className="trend-layout">
            <RecoveryTrendChart days={recentDays} />

            <div className="trend-summary-grid">
              <div>
                <span>Average steps</span>
                <strong><MetricDisplay value={trendSummary.averageSteps == null ? null : formatNumber(trendSummary.averageSteps)} /></strong>
                {isMissingMetric(trendSummary.averageSteps) ? <small className="metric-empty-copy">Awaiting data</small> : null}
              </div>
              <div>
                <span>Average nightly HRV</span>
                <strong><MetricDisplay value={trendSummary.averageNightlyHrv} /></strong>
                {isMissingMetric(trendSummary.averageNightlyHrv) ? <small className="metric-empty-copy">Awaiting data</small> : null}
              </div>
              <div>
                <span>Average resting HR</span>
                <strong><MetricDisplay value={trendSummary.averageRestingHeartRate} /></strong>
                {isMissingMetric(trendSummary.averageRestingHeartRate) ? <small className="metric-empty-copy">Awaiting data</small> : null}
              </div>
              <div>
                <span>Average sleep score</span>
                <strong><MetricDisplay value={trendSummary.averageSleepScore} /></strong>
                {isMissingMetric(trendSummary.averageSleepScore) ? <small className="metric-empty-copy">Awaiting data</small> : null}
              </div>
            </div>
          </div>
        </article>

        <RecoveryPanel focusDay={focusDay} />
        <SleepStageCard focusDay={focusDay} />
        <ActivityPanel focusDay={focusDay} />
        <SyncPanel recentRuns={recentRuns} />
      </section>
    </main>
  );
}
