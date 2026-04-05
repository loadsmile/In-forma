import OpenAI from 'openai';
import { env, requireEnv } from '../config/env.js';

export function createLlmClient() {
  requireEnv(['OPENROUTER_API_KEY']);

  return new OpenAI({
    apiKey: env.openRouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
