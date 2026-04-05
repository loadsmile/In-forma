import { env, requireEnv } from '../config/env.js';

export async function sendZapierEmail({ subject, html, syncType }) {
  requireEnv(['ZAPIER_WEBHOOK_URL', 'EMAIL_TO']);

  const response = await fetch(env.zapierWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: env.emailTo,
      subject,
      html,
      syncType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zapier webhook failed with status ${response.status}`);
  }

  return response;
}
