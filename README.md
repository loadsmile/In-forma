# In-Forma

In-Forma turns Garmin activity and recovery data into a concise morning briefing, a responsive web dashboard, and a weekly fitness digest. It combines a React client with a small REST API, a Postgres data layer, scheduled Garmin syncs, AI-assisted analysis through OpenRouter, and email delivery through Zapier.

The application is designed around a simple principle: collect the source data once, preserve it, and expose only the information each experience needs.

> [!IMPORTANT]
> In-Forma provides informational fitness summaries, not medical advice. AI-generated recommendations should be reviewed against the underlying Garmin data and personal circumstances.

## Contents

- [What It Does](#what-it-does)
- [Architecture](#architecture)
- [Data Flows](#data-flows)
- [Technology](#technology)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [REST API](#rest-api)
- [Commands](#commands)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [AI and Data Quality](#ai-and-data-quality)
- [Troubleshooting](#troubleshooting)
- [Extending the Project](#extending-the-project)

## What It Does

- Fetches daily activity, sleep, heart-rate, HRV, body-battery, and training signals from Garmin.
- Normalizes changing third-party payloads into stable application records.
- Generates evidence-based daily briefings and weekly summaries from the available metrics.
- Presents the latest briefing, recommendations, activities, sleep stages, and short-term trends in a React dashboard.
- Delivers HTML email briefings through a Zapier webhook connected to Gmail.
- Reuses current data and analysis when possible, while supporting explicit refreshes.
- Records successful and failed syncs for operational visibility.
- Prevents duplicate emails for the same sync type and metric date.

## Architecture

The dashboard is deliberately decoupled from data collection. Garmin, OpenRouter, and Zapier are server-side dependencies; the React application consumes a shaped JSON representation through `/api/dashboard` and does not need to understand those integrations.

```mermaid
flowchart LR
    Garmin[Garmin Connect] --> Sync[Sync and normalization]
    Sync --> DB[(Supabase Postgres)]
    DB --> Analysis[OpenRouter analysis]
    Analysis --> DB
    DB --> API[Dashboard REST API]
    API --> UI[React dashboard]
    Analysis --> Email[HTML email renderer]
    Email --> Zapier[Zapier webhook]
    Zapier --> Gmail[Gmail]
    Cron[Vercel Cron] --> Sync
```

This boundary provides two useful extension points:

- A different client can consume the dashboard API without changing the Garmin sync pipeline.
- A different delivery experience can use stored metrics and analyses without coupling itself to the React UI.

## Data Flows

### Morning Briefing

1. The scheduler starts a protected morning sync.
2. The service loads yesterday's activity metrics and the latest overnight recovery data from Garmin.
3. Normalized records are upserted into Postgres. Compatible cached records are reused unless `--force` is supplied locally.
4. OpenRouter receives the fitness profile and available metrics, then returns a JSON summary and three to five recommendations for today.
5. The briefing is stored, rendered as HTML, and sent to Zapier once.
6. The dashboard reads the latest briefing and a shaped three-day data window from the REST API.

Garmin may not have finalized the current night's sleep when the morning run starts. In that case, the sync fails with a critical sleep-data error and can be retried after Garmin publishes the record.

### Evening Review

The local evening command reviews the current metric date, stores its normalized metrics and analysis, and sends an evening recap. There is no production evening cron endpoint at present.

### Weekly Digest

The weekly workflow loads the most recent seven-day window from Postgres, calculates aggregates, asks OpenRouter for a grounded summary, and sends the result through Zapier. At least three synced days must exist in the window.

### Idempotency and Caching

- Metric records use date-based upserts, so a repeated sync updates rather than duplicates a day.
- Cached Garmin data is reused only when its schema version matches the current normalizer.
- Cached daily and morning analyses are reused only when their prompt versions match the current implementation.
- Email delivery uses a unique `<sync-type>:<metric-date>` key. `--force` refreshes data and analysis, but does not bypass email deduplication.
- Every sync attempt writes a success or failure entry to `sync_runs`.

## Technology

| Layer | Implementation |
| --- | --- |
| Runtime | Node.js 20+, ES modules |
| Frontend | React 19 and Vite 7 |
| API | Node HTTP server locally; Vercel Functions in production |
| Database | Supabase Postgres through `pg` |
| Garmin integration | `@gooin/garmin-connect` |
| AI analysis | OpenRouter through the OpenAI JavaScript SDK |
| Dates | `date-fns` |
| Email | Zapier webhook to Gmail |
| Scheduling and hosting | Vercel Cron and Vercel |
| Tests | Node.js test runner |

## Quick Start

### Prerequisites

- Node.js 20 or newer
- npm
- A Garmin account with activity data
- A Supabase Postgres database or another compatible Postgres database
- An OpenRouter API key
- A Zapier Catch Hook connected to a Gmail Send Email action

### 1. Install Dependencies

Use the lockfile for a reproducible installation:

```bash
npm ci
```

### 2. Configure the Environment

Create a `.env` file in the project root. The file is ignored by Git.

```dotenv
GARMIN_EMAIL=you@example.com
GARMIN_PASSWORD=your-garmin-password
DATABASE_URL=postgresql://user:password@host:5432/database

OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/...
EMAIL_TO=you@example.com

PERSON_NAME=Your name
PERSON_HEIGHT_CM=170
PERSON_WEIGHT_KG=70
PERSON_GOAL=Build strength while maintaining consistent recovery.

CRON_SECRET=use-a-long-random-production-secret
```

Do not commit real credentials. See [Configuration](#configuration) for which values each workflow requires.

### 3. Initialize the Database

```bash
npm run db:migrate
```

Migrations run in filename order and are tracked in `schema_migrations`; rerunning the command is safe.

### 4. Start the Application

Run the API and frontend in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` requests to the local API on `http://localhost:8787`.

Verify the API before running an external sync:

```bash
curl http://localhost:8787/api/health
```

Expected response:

```json
{"ok":true}
```

### 5. Generate the First Briefing

```bash
npm run sync:morning
```

This command reads Garmin data, calls OpenRouter, writes to Postgres, and may send an email. Refresh the dashboard after it completes. If Garmin has not published the latest sleep data, retry later rather than forcing repeated requests.

## Configuration

| Variable | Required for | Description |
| --- | --- | --- |
| `DATABASE_URL` | Database, API, all syncs | Postgres connection string. SSL is enabled by the database client. |
| `GARMIN_EMAIL` | Daily and morning syncs | Garmin account email. |
| `GARMIN_PASSWORD` | Daily and morning syncs | Garmin account password. |
| `OPENROUTER_API_KEY` | All analyses | API key used by the OpenAI SDK against OpenRouter. |
| `OPENROUTER_MODEL` | Optional | OpenRouter model identifier. A default free model is configured in `server/config/env.js`. |
| `ZAPIER_WEBHOOK_URL` | Email delivery | Zapier Catch Hook URL. |
| `EMAIL_TO` | Email delivery | Recipient passed to the Zapier workflow. |
| `PERSON_NAME` | Optional profile context | Name used by analysis prompts. |
| `PERSON_HEIGHT_CM` | Optional profile context | Height in centimeters. |
| `PERSON_WEIGHT_KG` | Optional profile context | Weight in kilograms. |
| `PERSON_GOAL` | Optional profile context | Plain-language fitness goal used to contextualize recommendations. |
| `CRON_SECRET` | Production cron endpoints | Bearer token required by `/api/cron/*`. |

The Zapier webhook receives this JSON contract:

```json
{
  "to": "person@example.com",
  "subject": "Your briefing subject",
  "html": "<html>...</html>",
  "syncType": "morning"
}
```

Map `to`, `subject`, and `html` to the corresponding Gmail action fields. `syncType` is available for routing or filtering in more advanced Zaps.

## REST API

All endpoints return JSON. The local implementation permits cross-origin `GET` requests; Vercel serves the equivalent functions from `api/`.

### `GET /api/health`

Confirms that the HTTP function is reachable. It does not test Garmin, OpenRouter, Zapier, or the database.

```json
{
  "ok": true
}
```

### `GET /api/dashboard`

Returns the latest morning briefing, its associated activity and recovery records, and up to three recent activity and recovery records. The response is deliberately shaped to exclude large raw Garmin arrays and internal model metadata.

Representative abbreviated response:

```json
{
  "briefing": {
    "briefing_date": "2026-04-05",
    "reviewed_activity_date": "2026-04-04",
    "recovery_date": "2026-04-05",
    "summary": "A concise, data-grounded overview.",
    "recommendations": "- Recommendation one\n- Recommendation two"
  },
  "reviewedDay": {
    "metric_date": "2026-04-04",
    "steps": 9000,
    "resting_heart_rate": 57,
    "sleep_seconds": 28800,
    "summary": "Daily summary",
    "recommendations": "- Daily recommendation",
    "raw_payload": {
      "schemaVersion": "v3",
      "activities": [],
      "sleepDetails": {},
      "trainingStatusDetails": {}
    }
  },
  "overnightRecovery": {
    "recovery_date": "2026-04-05",
    "metric_date": "2026-04-05",
    "sleep_seconds": 28200,
    "sleep_score": 82,
    "resting_heart_rate": 54,
    "last_night_hrv": 46,
    "body_battery_change": 37,
    "raw_payload": {}
  },
  "recentActivityDays": [],
  "recentRecoveryDays": []
}
```

Before the first morning briefing, the endpoint returns `null` for the three current records and empty recent-data arrays. Database errors return `500` with `{ "error": "..." }`.

> [!WARNING]
> `/api/dashboard` does not currently require authentication and may expose personal fitness data. Use Vercel deployment protection or add application-level authentication before making a deployment publicly accessible.

### `GET /api/cron/morning`

Runs migrations and starts the morning briefing workflow.

### `GET /api/cron/weekly`

Runs migrations and starts the weekly digest workflow.

Both cron endpoints require this header:

```http
Authorization: Bearer <CRON_SECRET>
```

Cron responses follow the same status contract:

| Status | Meaning |
| --- | --- |
| `200` | Migrations and the requested sync completed. |
| `401` | Bearer token is missing or incorrect. |
| `405` | The request method is not `GET`. |
| `500` | Configuration, migration, integration, or sync failure. The response includes an error message. |

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend on port `5173`. |
| `npm run dev:api` | Start the local REST API on port `8787`. |
| `npm run build` | Create the production frontend bundle in `dist/`. |
| `npm run preview` | Preview the production bundle locally. |
| `npm test` | Run the Node.js test suite. |
| `npm run db:migrate` | Apply pending SQL migrations. |
| `npm run sync:morning` | Generate today's briefing from yesterday's activity and last night's recovery. |
| `npm run sync:evening` | Generate a daily review for the current metric date. |
| `npm run sync:weekly` | Generate a digest from the latest seven-day database window. |

Add `-- --force` to a daily command to bypass compatible metric and analysis caches:

```bash
npm run sync:morning -- --force
npm run sync:evening -- --force
```

Use force refreshes sparingly. Garmin can rate-limit repeated login or data requests, and email deduplication still applies.

## Testing

Run the unit tests and production build before opening a pull request:

```bash
npm test
npm run build
```

The current tests cover:

- Weekly range calculation and metric aggregation.
- Dashboard response shaping and removal of large or internal Garmin fields.
- Daily and morning HTML email rendering.

Tests use Node's built-in test runner and do not call Garmin, OpenRouter, Zapier, or Postgres.

## Deployment

The Vercel project hosts both the Vite dashboard and serverless API functions. Configure all environment variables in Vercel, use the Vite framework preset, run `npm run build`, and publish `dist/`.

The schedules in `vercel.json` are UTC approximations for Lisbon local time and account for seasonal clock changes by month grouping:

| Workflow | UTC schedule | Purpose |
| --- | --- | --- |
| Morning, April-October | `09:00` daily | Generate the morning briefing. |
| Morning, January-March and November-December | `10:00` daily | Generate the winter-time morning briefing. |
| Weekly, April-October | Sunday at `17:00` | Generate the weekly digest. |
| Weekly, January-March and November-December | Sunday at `18:00` | Winter-time weekly digest. |

Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron endpoints when the same secret is configured in the project. Each serverless cron handler allows up to 300 seconds.

Deployment checklist:

- Apply the latest migrations or allow the first cron invocation to apply them.
- Configure every integration secret in the Vercel environment.
- Confirm `/api/health` returns `200`.
- Protect the dashboard before exposing personal data.
- Trigger one morning sync and verify `sync_runs`, the dashboard, and the Zapier task history.
- Confirm the project timezone expectations whenever cron schedules change.

## Project Structure

```text
.
|-- api/                       # Vercel REST and cron functions
|-- scripts/                   # Local sync, migration, and API entrypoints
|-- server/
|   |-- api/                   # Shared API and cron behavior
|   |-- config/                # Environment access and validation
|   |-- db/                    # Pool, migrations, upserts, and queries
|   |-- email/                 # HTML rendering and Zapier delivery
|   |-- garmin/                # Garmin client, fetching, and normalization
|   |-- llm/                   # Prompts, OpenRouter client, and response parsing
|   `-- sync/                  # Daily, morning, and weekly orchestration
|-- src/                       # React dashboard and styles
|-- test/                      # Node.js unit tests
|-- vercel.json                # Production cron schedules
`-- vite.config.js             # Frontend build and local API proxy
```

The database schema is migration-driven. Its main records are:

| Table | Responsibility |
| --- | --- |
| `daily_health_metrics` | Normalized daily Garmin metrics plus the versioned source payload. |
| `daily_analysis` | Daily AI summary and recommendations. |
| `overnight_recovery` | Sleep and recovery signals for a morning date. |
| `daily_briefings` | Combined activity-and-recovery briefing for the current day. |
| `email_deliveries` | Unique delivery claims and sent timestamps. |
| `sync_runs` | Operational history for successful and failed workflows. |
| `schema_migrations` | Applied migration filenames. |

## AI and Data Quality

AI is an interpretation layer, not the system of record. The implementation applies several controls:

- Prompts instruct the model to use only supplied Garmin data and not invent missing metrics.
- OpenRouter requests JSON output with a small, documented `summary` and `recommendations` contract.
- Responses are parsed and normalized before storage; an absent response or invalid JSON fails the sync instead of being silently accepted.
- Prompt versions are stored with analyses so stale output is regenerated when prompt behavior changes.
- Source metrics and sync outcomes remain available for comparison and debugging.
- The dashboard omits the selected model and trims raw Garmin payloads to UI-required fields.
- Recommendations remain advisory and should be evaluated by a person, especially when health, injury, or recovery concerns are involved.

When changing a prompt, update its version constant and add tests around any deterministic parsing or normalization behavior.

## Troubleshooting

### `Missing environment variables: ...`

Add the named value to `.env` locally or to the Vercel project environment. Restart local processes after changing `.env`.

### Garmin returns `429`

Garmin is rate-limiting requests. Stop forced refreshes and retry later. Local token reuse reduces login pressure, but it does not remove upstream limits.

### The morning briefing is still empty

Check the latest `sync_runs` message. If Garmin reports that critical sleep data is unavailable, it has not finalized the overnight record; run the morning sync later. Also confirm that migrations completed and that `/api/dashboard` can reach the same database used by the sync.

### The weekly digest reports fewer than three days

Run daily or morning syncs until at least three dates exist within the requested seven-day range. The weekly workflow intentionally refuses to generate a weak summary from less data.

### A forced sync does not send another email

This is expected. Force mode refreshes source data and analysis, while `email_deliveries` still prevents duplicate delivery for the same sync type and date.

### The dashboard returns `500`

Verify `DATABASE_URL`, run `npm run db:migrate`, and inspect the API log. `/api/health` only proves that the function is reachable; it does not validate the database connection.

### Zapier delivery fails

Confirm the Catch Hook URL, inspect Zapier task history, and verify the Gmail action maps the `to`, `subject`, and `html` fields. Non-2xx webhook responses fail the sync and release the pending delivery claim so a later run can retry.

## Extending the Project

### Add a Garmin Metric

1. Fetch and null-safe the field in `server/garmin/`.
2. Add a migration if the metric needs a queryable column; otherwise preserve it in the versioned `raw_payload`.
3. Update the relevant query and dashboard response shaper.
4. Render the field in React or email only after defining its missing-data behavior.
5. Update tests and increment the Garmin schema version when cached payload compatibility changes.

### Change the Dashboard Contract

Treat `server/db/queries/dashboard.js` as the API boundary. Keep external payloads small and stable, update `src/App.jsx` as the consumer, and add a response-shaping test that proves both retained and excluded fields.

### Add a Scheduled Workflow

1. Add a script entrypoint for local execution.
2. Implement orchestration with sync-run logging, shared upserts, and pool cleanup.
3. Add a protected Vercel function if the workflow runs in production.
4. Add the UTC schedule to `vercel.json` and document its local-time intent.
5. Test repeat execution, failure logging, and delivery deduplication before enabling the schedule.

Keep changes focused, run `npm test` and `npm run build`, and never commit `.env` or generated `dist/` files.
