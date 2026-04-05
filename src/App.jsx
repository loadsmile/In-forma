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

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildTrendSummary(days) {
  const recentDays = days.slice(0, 3);
  const stepValues = recentDays.map((day) => day.steps).filter((value) => value != null);
  const sleepValues = recentDays.map((day) => day.sleep_seconds).filter((value) => value != null);
  const heartValues = recentDays.map((day) => day.resting_heart_rate).filter((value) => value != null);
  const totalActivities = recentDays.reduce((sum, day) => sum + getActivities(day).length, 0);

  return {
    averageSteps: average(stepValues),
    averageSleepSeconds: average(sleepValues),
    averageRestingHeartRate: average(heartValues),
    totalActivities,
  };
}

function HealthBarChart({ days }) {
  const orderedDays = [...days].reverse();
  const maxSteps = Math.max(...orderedDays.map((day) => day.steps ?? 0), 1);

  return (
    <div className="chart-shell">
      {orderedDays.map((day) => {
        const stepsHeight = Math.max(((day.steps ?? 0) / maxSteps) * 100, day.steps ? 20 : 10);

        return (
          <div key={day.metric_date} className="chart-column">
            <div className="chart-track">
              <div className="chart-bar" style={{ height: `${stepsHeight}%` }} />
            </div>
            <span className="chart-value">{day.steps ? `${Math.round((day.steps ?? 0) / 1000)}k` : '0k'}</span>
            <span className="chart-label">{formatMetricDate(day.metric_date, 'EEE')}</span>
            <span className="chart-meta">{formatDuration(day.sleep_seconds)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SleepStageCard({ focusDay }) {
  const sleepDetails = getSleepDetails(focusDay);
  const stages = buildSleepStages(focusDay);

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
          <dd>{sleepDetails?.restlessMomentsCount ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Awake count</dt>
          <dd>{sleepDetails?.awakeCount ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Sleep score</dt>
          <dd>{sleepDetails?.sleepScore ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>REM ready</dt>
          <dd>{sleepDetails?.remSleepData == null ? 'n/a' : sleepDetails.remSleepData ? 'Yes' : 'No'}</dd>
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
          <p className="panel-kicker">Daily recovery dashboard</p>
          <h1>Yesterday, decoded for tomorrow.</h1>
          <p className="hero-copy-text">
            A previous-day health view with sleep depth, completed activity context, and next-day recommendations grounded in the last synced Garmin data.
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
              <strong>{formatNumber(focusDay?.steps)}</strong>
              <small>Previous day total</small>
            </div>
            <div className="snapshot-card cream-card">
              <span>Sleep</span>
              <strong>{formatDuration(focusDay?.sleep_seconds)}</strong>
              <small>Total overnight duration</small>
            </div>
            <div className="snapshot-card blush-card">
              <span>Resting HR</span>
              <strong>{focusDay?.resting_heart_rate ?? 'n/a'}</strong>
              <small>Baseline pulse</small>
            </div>
            <div className="snapshot-card slate-card">
              <span>Sessions</span>
              <strong>{activities.length}</strong>
              <small>Completed workouts</small>
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
              <h2>Short-term trendline</h2>
            </div>
            <span>{recentDays.length} days loaded</span>
          </div>

          <div className="trend-layout">
            <HealthBarChart days={recentDays} />

            <div className="trend-summary-grid">
              <div>
                <span>Average steps</span>
                <strong>{formatNumber(trendSummary.averageSteps)}</strong>
              </div>
              <div>
                <span>Average sleep</span>
                <strong>{formatDuration(trendSummary.averageSleepSeconds)}</strong>
              </div>
              <div>
                <span>Average resting HR</span>
                <strong>{trendSummary.averageRestingHeartRate ?? 'n/a'}</strong>
              </div>
              <div>
                <span>Total sessions</span>
                <strong>{trendSummary.totalActivities}</strong>
              </div>
            </div>
          </div>
        </article>

        <SleepStageCard focusDay={focusDay} />
        <ActivityPanel focusDay={focusDay} />
        <SyncPanel recentRuns={recentRuns} />
      </section>
    </main>
  );
}
