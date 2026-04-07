import { addDays, format, parseISO } from 'date-fns';
import { env } from '../config/env.js';
import { createLlmClient } from './client.js';

export const MORNING_BRIEFING_PROMPT_VERSION = 'v1';

function getMetricDate(value) {
  return value instanceof Date ? value : parseISO(value);
}

function normalizeRecommendations(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => `- ${item.replace(/^[-*•]\s*/, '').trim()}`)
      .join('\n');
  }

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function buildMorningBriefingPrompt({ briefingDate, reviewedDay, overnightRecovery }) {
  const reviewedDate = format(getMetricDate(reviewedDay.metric_date), 'yyyy-MM-dd');
  const recoveryDate = format(getMetricDate(overnightRecovery.recovery_date), 'yyyy-MM-dd');
  const todayDate = format(getMetricDate(briefingDate), 'yyyy-MM-dd');

  return [
    `You are a supportive fitness analyst helping ${env.personName}.`,
    `Profile: ${env.personHeightCm} cm, ${env.personWeightKg} kg.`,
    `Goal: ${env.personGoal}`,
    `Create a morning briefing for ${todayDate}.`,
    `The reviewed activity day is ${reviewedDate}.`,
    `The overnight recovery data is for ${recoveryDate}, representing how the user slept last night.`,
    'Keep the tone direct, useful, evidence-based, and grounded only in the provided Garmin data.',
    'The summary should explain yesterday plus how the user slept last night.',
    'The recommendations must be specifically for today.',
    'If a metric is missing, do not invent it.',
    `Reviewed day JSON: ${JSON.stringify(reviewedDay)}`,
    `Overnight recovery JSON: ${JSON.stringify(overnightRecovery)}`,
    'Return JSON with keys: summary, recommendations.',
    'The summary must be a concise paragraph.',
    'The recommendations must be an array of 3 to 5 concrete bullet strings for today.',
  ].join('\n');
}

export async function analyzeMorningBriefing({ briefingDate, reviewedDay, overnightRecovery }) {
  const client = createLlmClient();
  const response = await client.chat.completions.create({
    model: env.openRouterModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: buildMorningBriefingPrompt({ briefingDate, reviewedDay, overnightRecovery }),
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`Morning briefing response did not include a choice payload for model ${env.openRouterModel}.`);
  }

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Morning briefing response was not valid JSON.');
  }

  return {
    briefing_date: format(getMetricDate(briefingDate), 'yyyy-MM-dd'),
    reviewed_activity_date: format(getMetricDate(reviewedDay.metric_date), 'yyyy-MM-dd'),
    recovery_date: format(getMetricDate(overnightRecovery.recovery_date), 'yyyy-MM-dd'),
    model: env.openRouterModel,
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    recommendations: normalizeRecommendations(parsed.recommendations),
    prompt_version: MORNING_BRIEFING_PROMPT_VERSION,
    raw_payload: {
      today_date: format(getMetricDate(briefingDate), 'yyyy-MM-dd'),
      reviewed_day_date: format(getMetricDate(reviewedDay.metric_date), 'yyyy-MM-dd'),
      recovery_date: format(getMetricDate(overnightRecovery.recovery_date), 'yyyy-MM-dd'),
      recommendation_target_date: format(addDays(getMetricDate(reviewedDay.metric_date), 1), 'yyyy-MM-dd'),
    },
  };
}
