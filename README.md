# In-Forma

Personal Garmin-to-email fitness agent with a Vite dashboard, Supabase/Postgres storage, GitHub Actions sync automation, and Vercel hosting for the dashboard.

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

## GitHub Actions Automation

Workflows:

- `morning-sync`
- `evening-sync`
- `weekly-digest`

Actions secrets required:

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

Notes:

- Workflows run migrations before syncs.
- Sync emails are deduplicated per `sync_type + metric_date`.
- Workflow concurrency is enabled to reduce duplicate overlapping runs.
- Morning/evening jobs use daily sync data.
- Weekly digest uses the most recent 7-day window from the database and currently requires at least 3 synced days in that window.

## Vercel Dashboard

The Vercel deployment hosts only the dashboard.

Required Vercel environment variables:

- `DATABASE_URL`

Current routes:

- `/`
- `/api/health`
- `/api/dashboard`

Deployment notes:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- The dashboard uses the same Supabase/Postgres database as the sync jobs.

## Operational Notes

- Garmin login can return `429` if forced refreshes are repeated too often.
- Local Garmin token reuse is enabled to reduce repeated login pressure on your machine.
- The dashboard API intentionally returns a shaped subset of Garmin payload data instead of the full raw arrays.
- Weekly digest is a distinct flow from daily syncs and uses weekly aggregation plus a weekly email template.
