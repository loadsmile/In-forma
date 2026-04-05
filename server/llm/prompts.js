import { addDays, format, parseISO } from 'date-fns';

function getMetricDate(value) {
  return value instanceof Date ? value : parseISO(value);
}

export function buildDailyAnalysisPrompt({ metrics, personName, personHeightCm, personWeightKg, personGoal }) {
  const metricDate = getMetricDate(metrics.metric_date);
  const reviewedDate = format(metricDate, 'yyyy-MM-dd');
  const nextDayDate = format(addDays(metricDate, 1), 'yyyy-MM-dd');

  return [
    `You are a supportive fitness analyst helping ${personName}.`,
    `Profile: ${personHeightCm} cm, ${personWeightKg} kg.`,
    `Goal: ${personGoal}`,
    `Review the Garmin metrics for ${reviewedDate}.`,
    `Write recommendations for ${nextDayDate}, based only on the available Garmin data.`,
    'Keep the tone direct, useful, evidence-based, and grounded in the actual metrics, sleep details, completed activities, HRV, and training load signals when they are available.',
    'If a metric is missing, do not invent it.',
    `Metrics JSON: ${JSON.stringify(metrics)}`,
    'Return JSON with keys: summary, recommendations.',
    'The summary must be a concise paragraph about the reviewed day, calling out recovery-relevant signals such as HRV, respiration, overnight heart rate, and training status when present.',
    'The recommendations must be an array of 3 to 5 concrete bullet strings for the next day.',
  ].join('\n');
}
