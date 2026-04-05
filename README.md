# In-Forma

Personal Garmin-to-email fitness agent with a Vite dashboard, Supabase/Postgres storage, Vercel Cron automation, and Vercel hosting for the dashboard.

## Local Development

Install dependencies:

```bash
npm install
```

Run migrations:

```bash
npm run db:migrate
```

Start the local API:

```bash
npm run dev:api
```

Start the frontend:

```bash
npm run dev
```

Useful local commands:

```bash
npm run sync:morning
npm run sync:morning -- --force
npm run sync:evening
npm run sync:weekly
npm test
```

## Required Environment Variables

Core runtime:

- `DATABASE_URL`
- `GARMIN_EMAIL`
- `GARMIN_PASSWORD`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `ZAPIER_WEBHOOK_URL`
- `EMAIL_TO`

Profile:

- `PERSON_NAME`
- `PERSON_HEIGHT_CM`
- `PERSON_WEIGHT_KG`
- `PERSON_GOAL`

Scheduler protection:

- `CRON_SECRET`

## Vercel Cron Automation

Production cron endpoints:

- `/api/cron/morning`
- `/api/cron/weekly`

Required Vercel environment variables for cron + dashboard:

- `GARMIN_EMAIL`
- `GARMIN_PASSWORD`
- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `ZAPIER_WEBHOOK_URL`
- `EMAIL_TO`
- `PERSON_NAME`
- `PERSON_HEIGHT_CM`
- `PERSON_WEIGHT_KG`
- `PERSON_GOAL`
- `CRON_SECRET`

Notes:

- Each cron request runs migrations before the sync starts.
- Sync emails are deduplicated per `sync_type + metric_date`.
- Morning uses the previous day.
- Weekly digest uses the most recent 7-day window from the database and currently requires at least 3 synced days in that window.
- Cron endpoints require `Authorization: Bearer <CRON_SECRET>`.
- `vercel.json` currently defines the Lisbon-approximate UTC schedules.

## Vercel Dashboard

The Vercel deployment hosts the dashboard and the cron endpoints.

Required Vercel environment variables:

- `DATABASE_URL`
- `CRON_SECRET`

Current routes:

- `/`
- `/api/health`
- `/api/dashboard`
- `/api/cron/morning`
- `/api/cron/weekly`

Deployment notes:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- The dashboard and cron jobs use the same Supabase/Postgres database.
- Set `CRON_SECRET` in Vercel so scheduled calls cannot be triggered publicly.

## Operational Notes

- Garmin login can return `429` if forced refreshes are repeated too often.
- Local Garmin token reuse is enabled to reduce repeated login pressure on your machine.
- The dashboard API intentionally returns a shaped subset of Garmin payload data instead of the full raw arrays.
- Weekly digest is a distinct flow from daily syncs and uses weekly aggregation plus a weekly email template.
- GitHub Actions workflow files have been removed from the repo so repository-triggered Actions runs stop.
