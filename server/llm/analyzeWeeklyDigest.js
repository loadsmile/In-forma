import { env } from '../config/env.js';
import { createLlmClient } from './client.js';

export const WEEKLY_ANALYSIS_PROMPT_VERSION = 'v1';

function buildWeeklyAnalysisPrompt(weeklyDigest) {
  return [
    `You are a supportive fitness analyst helping ${env.personName}.`,
    `Profile: ${env.personHeightCm} cm, ${env.personWeightKg} kg.`,
    `Goal: ${env.personGoal}`,
    `Review the Garmin metrics between ${weeklyDigest.range.startMetricDate} and ${weeklyDigest.range.endMetricDate}.`,
    'Keep the tone direct, useful, evidence-based, and grounded only in the provided weekly data.',
    'If a metric is missing, do not invent it.',
    `Weekly digest JSON: ${JSON.stringify(weeklyDigest)}`,
    'Return JSON with keys: summary, recommendations.',
    'The summary must be a concise paragraph describing the week overall.',
    'The recommendations must be an array of 3 to 5 concrete bullet strings for the next week.',
  ].join('\n');
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

export async function analyzeWeeklyDigest(weeklyDigest) {
  const client = createLlmClient();
  const response = await client.chat.completions.create({
    model: env.openRouterModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: buildWeeklyAnalysisPrompt(weeklyDigest),
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`Weekly digest response did not include a choice payload for model ${env.openRouterModel}.`);
  }

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Weekly digest response was not valid JSON.');
  }

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    recommendations: normalizeRecommendations(parsed.recommendations),
    model: env.openRouterModel,
    promptVersion: WEEKLY_ANALYSIS_PROMPT_VERSION,
  };
}
