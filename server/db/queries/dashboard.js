export function shapeActivityDay(row) {
  const rawPayload = row.raw_payload ?? {};

  return {
    metric_date: row.metric_date,
    steps: row.steps,
    resting_heart_rate: row.resting_heart_rate,
    sleep_seconds: row.sleep_seconds,
    summary: row.summary,
    recommendations: row.recommendations,
    raw_payload: {
      schemaVersion: rawPayload.schemaVersion ?? null,
      activities: Array.isArray(rawPayload.activities)
        ? rawPayload.activities.map((activity) => ({
            activityId: activity.activityId ?? null,
            activityName: activity.activityName ?? null,
            activityType: activity.activityType ?? null,
            startTimeLocal: activity.startTimeLocal ?? null,
            duration: activity.duration ?? null,
            distance: activity.distance ?? null,
            calories: activity.calories ?? null,
            averageHR: activity.averageHR ?? null,
            steps: activity.steps ?? null,
          }))
        : [],
      sleepDetails: rawPayload.sleepDetails
        ? {
            totalSleepSeconds: rawPayload.sleepDetails.totalSleepSeconds ?? null,
            sleepScore: rawPayload.sleepDetails.sleepScore ?? null,
          }
        : null,
      trainingStatusDetails: rawPayload.trainingStatusDetails
        ? {
            weeklyTrainingLoad: rawPayload.trainingStatusDetails.weeklyTrainingLoad ?? null,
            feedbackPhrase: rawPayload.trainingStatusDetails.feedbackPhrase ?? null,
            acuteTrainingLoad: {
              acwrStatus: rawPayload.trainingStatusDetails.acuteTrainingLoad?.acwrStatus ?? null,
            },
          }
        : null,
    },
  };
}

export function shapeOvernightRecovery(row) {
  const rawPayload = row.raw_payload ?? {};

  return {
    recovery_date: row.recovery_date,
    metric_date: row.recovery_date,
    sleep_seconds: row.sleep_seconds,
    sleep_score: row.sleep_score,
    resting_heart_rate: row.resting_heart_rate,
    last_night_hrv: row.last_night_hrv,
    body_battery_change: row.body_battery_change,
    raw_payload: {
      schemaVersion: rawPayload.schemaVersion ?? null,
      sleepDetails: rawPayload.sleepDetails
        ? {
            totalSleepSeconds: rawPayload.sleepDetails.totalSleepSeconds ?? null,
            sleepStartTimestampLocal: rawPayload.sleepDetails.sleepStartTimestampLocal ?? null,
            sleepEndTimestampLocal: rawPayload.sleepDetails.sleepEndTimestampLocal ?? null,
            deepSleepSeconds: rawPayload.sleepDetails.deepSleepSeconds ?? null,
            lightSleepSeconds: rawPayload.sleepDetails.lightSleepSeconds ?? null,
            remSleepSeconds: rawPayload.sleepDetails.remSleepSeconds ?? null,
            awakeSleepSeconds: rawPayload.sleepDetails.awakeSleepSeconds ?? null,
            awakeCount: rawPayload.sleepDetails.awakeCount ?? null,
            sleepScore: rawPayload.sleepDetails.sleepScore ?? null,
            remSleepData: rawPayload.sleepDetails.remSleepData ?? null,
            restlessMomentsCount: rawPayload.sleepDetails.restlessMomentsCount ?? null,
            averageRespirationValue: rawPayload.sleepDetails.averageRespirationValue ?? null,
            lowestRespirationValue: rawPayload.sleepDetails.lowestRespirationValue ?? null,
            highestRespirationValue: rawPayload.sleepDetails.highestRespirationValue ?? null,
            bodyBatteryChange: rawPayload.sleepDetails.bodyBatteryChange ?? null,
            overnightBodyBatteryEnd: rawPayload.sleepDetails.overnightBodyBatteryEnd ?? null,
          }
        : null,
      heartRateDetails: rawPayload.heartRateDetails
        ? {
            minHeartRate: rawPayload.heartRateDetails.minHeartRate ?? null,
            maxHeartRate: rawPayload.heartRateDetails.maxHeartRate ?? null,
            lastSevenDaysAvgRestingHeartRate: rawPayload.heartRateDetails.lastSevenDaysAvgRestingHeartRate ?? null,
          }
        : null,
      hrvDetails: rawPayload.hrvDetails
        ? {
            status: rawPayload.hrvDetails.status ?? null,
            lastNightAvg: rawPayload.hrvDetails.lastNightAvg ?? null,
            weeklyAvg: rawPayload.hrvDetails.weeklyAvg ?? null,
          }
        : null,
      trainingStatusDetails: rawPayload.trainingStatusDetails
        ? {
            weeklyTrainingLoad: rawPayload.trainingStatusDetails.weeklyTrainingLoad ?? null,
            feedbackPhrase: rawPayload.trainingStatusDetails.feedbackPhrase ?? null,
            acuteTrainingLoad: {
              acwrStatus: rawPayload.trainingStatusDetails.acuteTrainingLoad?.acwrStatus ?? null,
            },
          }
        : null,
      trainingLoadBalanceDetails: rawPayload.trainingLoadBalanceDetails
        ? {
            monthlyLoadAerobicHigh: rawPayload.trainingLoadBalanceDetails.monthlyLoadAerobicHigh ?? null,
            feedbackPhrase: rawPayload.trainingLoadBalanceDetails.feedbackPhrase ?? null,
          }
        : null,
    },
  };
}

export function shapeBriefing(row) {
  if (!row) {
    return null;
  }

  return {
    briefing_date: row.briefing_date,
    reviewed_activity_date: row.reviewed_activity_date,
    recovery_date: row.recovery_date,
    summary: row.summary,
    recommendations: row.recommendations,
  };
}

export async function getDashboardOverview(client) {
  const briefingResult = await client.query(
    `
      SELECT briefing_date, reviewed_activity_date, recovery_date, summary, recommendations
      FROM daily_briefings
      ORDER BY briefing_date DESC
      LIMIT 1
    `,
  );
  const briefing = briefingResult.rows[0] ?? null;

  if (!briefing) {
    return {
      briefing: null,
      reviewedDay: null,
      overnightRecovery: null,
      recentActivityDays: [],
      recentRecoveryDays: [],
    };
  }

  const [reviewedDayResult, overnightRecoveryResult, recentActivityDaysResult, recentRecoveryDaysResult] = await Promise.all([
    client.query(
      `
        SELECT
          m.metric_date,
          m.steps,
          m.resting_heart_rate,
          m.sleep_seconds,
          m.raw_payload,
          a.summary,
          a.recommendations
        FROM daily_health_metrics m
        LEFT JOIN daily_analysis a ON a.metric_date = m.metric_date
        WHERE m.metric_date = $1
        LIMIT 1
      `,
      [briefing.reviewed_activity_date],
    ),
    client.query(
      `
        SELECT *
        FROM overnight_recovery
        WHERE recovery_date = $1
        LIMIT 1
      `,
      [briefing.recovery_date],
    ),
    client.query(
      `
        SELECT
          m.metric_date,
          m.steps,
          m.resting_heart_rate,
          m.sleep_seconds,
          m.raw_payload,
          a.summary,
          a.recommendations
        FROM daily_health_metrics m
        LEFT JOIN daily_analysis a ON a.metric_date = m.metric_date
        ORDER BY m.metric_date DESC
        LIMIT 3
      `,
    ),
    client.query(
      `
        SELECT *
        FROM overnight_recovery
        ORDER BY recovery_date DESC
        LIMIT 3
      `,
    ),
  ]);

  return {
    briefing: shapeBriefing(briefing),
    reviewedDay: reviewedDayResult.rows[0] ? shapeActivityDay(reviewedDayResult.rows[0]) : null,
    overnightRecovery: overnightRecoveryResult.rows[0] ? shapeOvernightRecovery(overnightRecoveryResult.rows[0]) : null,
    recentActivityDays: recentActivityDaysResult.rows.map(shapeActivityDay),
    recentRecoveryDays: recentRecoveryDaysResult.rows.map(shapeOvernightRecovery),
  };
}
