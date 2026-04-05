import dotenv from 'dotenv';

dotenv.config();

export const env = {
  garminEmail: process.env.GARMIN_EMAIL,
  garminPassword: process.env.GARMIN_PASSWORD,
  databaseUrl: process.env.DATABASE_URL,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel:
    process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free',
  zapierWebhookUrl: process.env.ZAPIER_WEBHOOK_URL,
  emailTo: process.env.EMAIL_TO,
  personName: process.env.PERSON_NAME ?? 'Mariana',
  personHeightCm: process.env.PERSON_HEIGHT_CM ?? '156',
  personWeightKg: process.env.PERSON_WEIGHT_KG ?? '59',
  personGoal:
    process.env.PERSON_GOAL ??
    'Build strength and improve recovery. 30-min strength sessions twice a week, 45-min treadmill walk on weekends.',
};

export function requireEnv(keys) {
  const missingKeys = keys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing environment variables: ${missingKeys.join(', ')}`);
  }
}
