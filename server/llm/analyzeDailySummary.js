import { env } from '../config/env.js';
import { createLlmClient } from './client.js';
import { buildDailyAnalysisPrompt } from './prompts.js';

export const DAILY_ANALYSIS_PROMPT_VERSION = 'v3';

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

export async function analyzeDailySummary(metrics) {
  const client = createLlmClient();
  const prompt = buildDailyAnalysisPrompt({
    metrics,
    personName: env.personName,
    personHeightCm: env.personHeightCm,
    personWeightKg: env.personWeightKg,
    personGoal: env.personGoal,
  });

  const response = await client.chat.completions.create({
    model: env.openRouterModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '{"summary":"","recommendations":[]}';
  const parsed = JSON.parse(content);

  return {
    metric_date: metrics.metric_date,
    model: env.openRouterModel,
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    recommendations: normalizeRecommendations(parsed.recommendations),
    prompt_version: DAILY_ANALYSIS_PROMPT_VERSION,
  };
}
