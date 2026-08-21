# In-Forma

In-Forma turns Garmin health data into a concise morning briefing, a responsive web dashboard, and a weekly fitness digest. It combines scheduled data collection, structured Postgres records, AI-assisted analysis, a small REST API, and email delivery in one JavaScript application.

The project is designed around a simple boundary: credentials and integration calls remain server-side, while the React client receives a stable, purpose-built JSON representation. Selected health data is transmitted only to the external services configured for analysis and delivery.

> [!IMPORTANT]
> In-Forma provides informational fitness summaries, not medical advice. Review AI-generated recommendations against the underlying Garmin data and your personal circumstances.

## Contents

- [What You Can Do](#what-you-can-do)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Tutorial: Generate a Briefing](#tutorial-generate-a-briefing)
- [REST API](#rest-api)
- [Use the API in JavaScript](#use-the-api-in-javascript)
- [Commands](#commands)
- [Data Model](#data-model)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [AI and Data Quality](#ai-and-data-quality)
- [Security and Privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Developer Guides](#developer-guides)

## What You Can Do

In-Forma supports three fitness reporting workflows:

- **Morning briefing:** combines yesterday's activity with the latest overnight recovery data to suggest priorities for the current day.
- **Evening review:** summarizes the current day's Garmin data from a local command.
- **Weekly digest:** aggregates a seven-calendar-day window ending yesterday and highlights trends when at least three days are available.

Across these workflows, the application:

- Fetches activity, sleep, heart-rate, HRV, hydration, weight, and training signals from Garmin.
- Normalizes changing third-party payloads into stable application records.
- Generates grounded summaries and recommendations through OpenRouter.
- Presents the latest briefing and three-day trends in a React dashboard.
- Sends HTML briefings through a Zapier webhook connected to Gmail.
- Reuses compatible source data and analyses to reduce external API calls.
- Uses date-based upserts and delivery claims to make repeated runs safe.
- Records sync outcomes for operational visibility once the database is available.

## How It Works

### Architecture

```mermaid
flowchart LR
    Garmin[Garmin Connect] --> Sync[Fetch and normalize]
    Sync --> DB[(Postgres)]
    DB --> AI[OpenRouter analysis]
    AI --> DB
    DB --> API[Dashboard REST API]
    API --> UI[React dashboard]
    AI --> Email[HTML renderer]
    Email --> Zapier[Zapier webhook]
    Zapier --> Gmail[Gmail]
    Cron[Vercel Cron] --> Sync
```

Garmin, OpenRouter, Postgres, and Zapier are server-side dependencies. The browser only calls `/api/dashboard`; it does not receive credentials, full Garmin payloads, or internal model metadata.

This separation makes the stored data reusable. A new client can consume the REST API without changing collection, and a new reporting workflow can use normalized records without coupling itself to React.

### Morning Briefing Flow

1. A protected cron endpoint or local command starts the workflow.
2. The service checks Postgres for compatible activity, analysis, and recovery records.
3. It fetches missing records from Garmin, normalizes them, and upserts them into Postgres. A local `--force` run bypasses compatible caches.
4. OpenRouter receives the profile and available metrics when a new analysis or briefing is needed, then returns structured JSON.
5. The service stores the briefing, renders it as HTML, and claims a unique delivery key.
6. Zapier receives the email payload and passes it to Gmail.
7. The dashboard reads the latest stored briefing through the REST API.

Garmin may not have finalized the current night's sleep when the morning request runs. In that case, the sync fails, a deployed cron request returns `500`, and no email is sent. Retry the workflow manually after Garmin publishes the record; the committed schedule does not guarantee a second same-day attempt.

### Evening and Weekly Flows

The evening command processes the current metric date, stores its daily analysis, and sends an evening review. It is available locally but has no production Vercel endpoint.

The weekly command queries the fixed seven-day period ending yesterday, aggregates the rows present in that period, and generates a digest. It requires at least three synced days. Weekly analysis is generated on each run and is not stored as a separate analysis row.

### Repeat Runs

- Metrics, analyses, recovery records, and briefings are keyed by date and written with upserts.
- Cached records are reused only when their schema or prompt version is compatible with the current code.
- Email delivery is claimed with a unique `<sync-type>:<metric-date>` key.
- `--force` refreshes compatible Garmin and AI caches but does not send a duplicate email.
- Sync outcomes are written to `sync_runs` after a database pool is available. Configuration, connection, or pre-sync migration failures may occur before a run can be recorded.

## Quick Start

### Prerequisites

- Node.js 20.19+ on the 20.x release line, or Node.js 22.12+
- npm
- A Garmin account with activity data
- A Supabase Postgres database or another SSL-capable Postgres database
- An OpenRouter API key
- A Zapier Catch Hook connected to a Gmail **Send Email** action
- A Vercel project if you want hosted cron automation

### 1. Install Dependencies

Use the lockfile for a reproducible installation:

```bash
npm ci
```

### 2. Configure the Environment

Create `.env` in the project root. It is ignored by Git.

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database
GARMIN_EMAIL=you@example.com
GARMIN_PASSWORD=your-garmin-password
OPENROUTER_API_KEY=your-openrouter-key
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/...
EMAIL_TO=you@example.com

# Optional model override
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Recommended profile values
PERSON_NAME=Your name
PERSON_HEIGHT_CM=170
PERSON_WEIGHT_KG=70
PERSON_GOAL=Build strength while maintaining consistent recovery.

# Required only by deployed cron endpoints
CRON_SECRET=use-a-long-random-production-secret
```

Use real secrets only in `.env` or your deployment provider. Never commit them. Set all profile values for every deployment: if omitted, the application uses the owner-specific defaults `Mariana`, `156`, `59`, and a built-in strength-and-recovery goal.

### 3. Initialize the Database

```bash
npm run db:migrate
```

Migrations run in filename order and are recorded in `schema_migrations`. Re-running the command safely skips migrations that have already been applied. Local sync commands do not apply migrations automatically.

### 4. Start the Application

Run the API and frontend in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` requests to the local API at `http://localhost:8787`.

Check that the API is reachable:

```bash
curl http://localhost:8787/api/health
```

Expected response:

```json
{"ok":true}
```

The health endpoint checks HTTP availability only. It does not test Postgres, Garmin, OpenRouter, or Zapier.

## Configuration

Defaults are defined in `server/config/env.js`. Compatible caches may avoid Garmin or OpenRouter calls; an existing delivery claim skips only the Zapier request.

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Required | Postgres connection used by migrations, syncs, and the dashboard API. |
| `GARMIN_EMAIL` | Morning and evening syncs | Garmin account email. Not used by the weekly digest. |
| `GARMIN_PASSWORD` | Morning and evening syncs | Garmin account password. Not used by the weekly digest. |
| `OPENROUTER_API_KEY` | Generated analyses | API key used by the OpenAI SDK against OpenRouter. |
| `OPENROUTER_MODEL` | Optional | OpenRouter model identifier. A default is provided. |
| `ZAPIER_WEBHOOK_URL` | New email deliveries | Zapier Catch Hook URL. |
| `EMAIL_TO` | New email deliveries | Recipient included in the Zapier payload. |
| `PERSON_NAME` | Optional; set explicitly | Name used in prompts, subjects, and headings. Defaults to `Mariana`. |
| `PERSON_HEIGHT_CM` | Optional; set explicitly | Height supplied to prompts. Defaults to `156`. |
| `PERSON_WEIGHT_KG` | Optional; set explicitly | Weight supplied to prompts. Defaults to `59`. |
| `PERSON_GOAL` | Optional; set explicitly | Goal used to contextualize recommendations. Has an owner-specific default. |
| `CRON_SECRET` | Deployed cron only | Bearer token required by `/api/cron/*`. |

### Workflow Requirements

| Workflow | Minimum configuration for an uncached run |
| --- | --- |
| Dashboard | `DATABASE_URL` |
| Database migration | `DATABASE_URL` |
| Morning or evening | Database, Garmin, OpenRouter, Zapier, and recipient variables |
| Weekly | Database, OpenRouter, Zapier, and recipient variables |
| Vercel cron | Applicable workflow variables plus `CRON_SECRET` |

### Zapier Contract

The email adapter sends a JSON request with this shape:

```json
{
  "to": "person@example.com",
  "subject": "Your morning fitness briefing",
  "html": "<html>...</html>",
  "syncType": "morning"
}
```

In Zapier, map `to`, `subject`, and `html` to the corresponding Gmail action fields. `syncType` is available for filters or routing. Any non-2xx Zapier response fails the sync and makes the delivery eligible for a later retry.

## Tutorial: Generate a Briefing

This tutorial exercises the complete pipeline. It contacts external services, stores personal data, uses OpenRouter credits when no compatible analysis is cached, and may send a real email.

1. Complete the [Quick Start](#quick-start), including database migrations.
2. Confirm the local API returns `{"ok":true}`.
3. Run the morning workflow:

   ```bash
   npm run sync:morning
   ```

4. Review the latest `sync_runs` row for the activity date, cache decisions, delivery status, and Garmin warnings.
5. Open `http://localhost:5173` and refresh the page.
6. Confirm that the briefing appears in the dashboard and the email arrives through Zapier.

The dashboard remains empty until `daily_briefings` contains a morning briefing. Running only the evening workflow does not populate that record.

To refresh compatible source data and AI analysis, run:

```bash
npm run sync:morning -- --force
```

Force mode does not bypass email deduplication. Use it sparingly because Garmin can rate-limit repeated authentication and data requests.

## REST API

All application endpoints return JSON. The Vercel functions live in `api/`; the local development equivalents are implemented by `scripts/dev-api.js` and `server/api/`.

### `GET /api/health`

Checks that the HTTP handler is reachable.

**Response: `200 OK`**

Representative response:

```json
{
  "ok": true
}
```

### `GET /api/dashboard`

Returns the latest morning briefing, its reviewed activity day, its overnight recovery record, and up to three recent activity and recovery rows.

**Response: `200 OK`**

Empty-state response before the first briefing:

```json
{
  "briefing": null,
  "reviewedDay": null,
  "overnightRecovery": null,
  "recentActivityDays": [],
  "recentRecoveryDays": []
}
```

Once populated, `briefing` has this shape:

```json
{
  "briefing_date": "2026-08-21",
  "reviewed_activity_date": "2026-08-20",
  "recovery_date": "2026-08-21",
  "summary": "A concise, data-grounded overview.",
  "recommendations": "- Prioritize recovery\n- Keep training easy"
}
```

`reviewedDay` and each item in `recentActivityDays` use this shape:

```json
{
  "metric_date": "2026-08-20",
  "steps": 9000,
  "resting_heart_rate": 57,
  "sleep_seconds": 28800,
  "summary": "Daily summary",
  "recommendations": "- Daily recommendation",
  "raw_payload": {
    "schemaVersion": "v3",
    "activities": [],
    "sleepDetails": {
      "totalSleepSeconds": 28800,
      "sleepScore": 82
    },
    "trainingStatusDetails": {
      "weeklyTrainingLoad": 420,
      "feedbackPhrase": "BALANCED",
      "acuteTrainingLoad": {
        "acwrStatus": "OPTIMAL"
      }
    }
  }
}
```

`overnightRecovery` and each item in `recentRecoveryDays` use this shape:

```json
{
  "recovery_date": "2026-08-21",
  "metric_date": "2026-08-21",
  "sleep_seconds": 28200,
  "sleep_score": 82,
  "resting_heart_rate": 54,
  "last_night_hrv": 46,
  "body_battery_change": 37,
  "raw_payload": {
    "schemaVersion": "v1",
    "sleepDetails": {
      "totalSleepSeconds": 28200,
      "sleepStartTimestampLocal": null,
      "sleepEndTimestampLocal": null,
      "deepSleepSeconds": 5400,
      "lightSleepSeconds": 15300,
      "remSleepSeconds": 6300,
      "awakeSleepSeconds": 1200,
      "awakeCount": 3,
      "sleepScore": 82,
      "remSleepData": true,
      "restlessMomentsCount": 21,
      "averageRespirationValue": 14,
      "lowestRespirationValue": 11,
      "highestRespirationValue": 18,
      "bodyBatteryChange": 37,
      "overnightBodyBatteryEnd": 71
    },
    "heartRateDetails": {
      "minHeartRate": 48,
      "maxHeartRate": 82,
      "lastSevenDaysAvgRestingHeartRate": 55
    },
    "hrvDetails": {
      "status": "BALANCED",
      "lastNightAvg": 46,
      "weeklyAvg": 44
    },
    "trainingStatusDetails": {
      "weeklyTrainingLoad": 420,
      "feedbackPhrase": "BALANCED",
      "acuteTrainingLoad": {
        "acwrStatus": "OPTIMAL"
      }
    },
    "trainingLoadBalanceDetails": {
      "monthlyLoadAerobicHigh": 310,
      "feedbackPhrase": "BALANCED"
    }
  }
}
```

All measured values may be `null` when Garmin does not provide them. Sleep timestamps are passed through from Garmin without format normalization. The API deliberately excludes large source arrays and internal model metadata.

**Response: `500 Internal Server Error`**

```json
{
  "error": "Error message"
}
```

### `GET /api/cron/morning`

Applies pending database migrations and starts the morning briefing workflow.

### `GET /api/cron/weekly`

Applies pending database migrations and starts the weekly digest workflow.

Both cron routes require:

```http
Authorization: Bearer <CRON_SECRET>
```

| Status | Meaning |
| --- | --- |
| `200` | Migrations and the requested workflow returned successfully. |
| `401` | The bearer token is missing or incorrect. |
| `405` | The request method is not `GET`. |
| `500` | Configuration, migration, integration, or sync failure. |

The local API implements `/api/health` and `/api/dashboard`; cron routes are Vercel functions and are not mounted by `npm run dev:api`.

## Use the API in JavaScript

The dashboard contract can support another website, app, or reporting surface. This browser example prints the latest summary without exposing any server-side credentials:

```js
async function loadLatestBriefing() {
  const response = await fetch('/api/dashboard');

  if (!response.ok) {
    throw new Error(`Dashboard request failed with ${response.status}`);
  }

  const { briefing } = await response.json();

  if (!briefing) {
    return 'No morning briefing is available yet.';
  }

  return briefing.summary;
}
```

A minimal React component can represent loading, error, empty, and populated states explicitly:

```jsx
import { useEffect, useState } from 'react';

export function BriefingSummary() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/dashboard', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', error });
      });

    return () => controller.abort();
  }, []);

  if (state.status === 'loading') return <p>Loading briefing...</p>;
  if (state.status === 'error') return <p>Briefing unavailable.</p>;
  if (!state.data.briefing) return <p>No briefing has been generated.</p>;

  return <p>{state.data.briefing.summary}</p>;
}
```

For a separate origin, configure an authenticated server-side proxy before production use. The local API allows cross-origin `GET` requests, but the hosted dashboard endpoint is currently unauthenticated and contains personal data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite on port `5173` and proxy `/api` to port `8787`. |
| `npm run dev:api` | Start the local REST API on port `8787`. |
| `npm run build` | Create the production frontend bundle in `dist/`. |
| `npm run preview` | Preview the static frontend bundle. It does not start or proxy the API. |
| `npm test` | Run tests with Node's built-in test runner. |
| `npm run db:migrate` | Apply pending SQL migrations and close the database pool. |
| `npm run sync:morning` | Generate today's briefing from yesterday's activity and overnight recovery. |
| `npm run sync:evening` | Generate a daily review for the current metric date. |
| `npm run sync:weekly` | Generate a digest for the seven-day range ending yesterday. |

Morning and evening commands accept `--force`:

```bash
npm run sync:morning -- --force
npm run sync:evening -- --force
```

There is no date override, dry-run mode, or skip-email flag.

## Data Model

The schema is migration-driven. Each migration executes in its own transaction, and an applied filename is never run again. Add a new migration instead of editing one that may already be deployed.

| Table | Responsibility |
| --- | --- |
| `daily_health_metrics` | Normalized daily Garmin metrics and a versioned source payload. |
| `daily_analysis` | Daily AI summary, recommendations, model, and prompt version. |
| `overnight_recovery` | Sleep and recovery signals associated with a morning date. |
| `daily_briefings` | Combined activity-and-recovery briefing for the current day. |
| `email_deliveries` | Unique delivery claims and successful send timestamps. |
| `sync_runs` | Operational history for successful and failed workflows. |
| `schema_migrations` | Filenames of applied SQL migrations. |

The schema is intentionally single-user: date columns identify records globally and there is no account identifier. Do not point multiple users at the same deployment without first adding tenant-aware keys, authorization, and migration coverage.

## Testing

Run the test suite and production build before opening a pull request:

```bash
npm test
npm run build
```

The current tests cover:

- Weekly date-range calculation and aggregation.
- Dashboard response shaping and removal of large or internal Garmin fields.
- HTML escaping in daily and morning email rendering.

Tests use Node's built-in test runner and do not call Garmin, OpenRouter, Zapier, or Postgres. The project does not currently include database integration, route authentication, component, or end-to-end tests.

## Deployment

The intended Vercel deployment contains the Vite dashboard, file-based functions under `api/`, and protected cron invocations. The dashboard and cron functions must use the same Postgres database.

Configure the Vercel project with:

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: all variables required by the deployed workflows

`vercel.json` is the source of truth for cron timing. Its UTC expressions approximate Lisbon local time by month rather than using a timezone-aware scheduler, so daylight-saving transition days can differ by one hour. There is no deployed evening schedule.

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to cron endpoints when `CRON_SECRET` is configured in the project. Each cron function allows up to 300 seconds.

### Deployment Checklist

- Configure secrets in Vercel; do not expose them through client-side variables.
- Apply the latest migrations or let an authorized cron request apply them.
- Confirm `/api/health` returns `200`.
- Protect `/api/dashboard` before exposing the project publicly.
- Trigger one morning workflow and inspect `sync_runs` and Zapier task history.
- Confirm that the dashboard and cron functions use the same database.
- Review Lisbon/UTC expectations whenever `vercel.json` changes.

GitHub Actions is not used for the current deployment.

## Project Structure

```text
.
|-- api/                       # Vercel REST and cron functions
|-- public/                    # Static frontend assets
|-- scripts/                   # Local sync, migration, and API entrypoints
|-- server/
|   |-- api/                   # Shared dashboard and cron behavior
|   |-- config/                # Environment defaults and validation
|   |-- db/                    # Pool, migrations, upserts, and queries
|   |-- email/                 # HTML rendering and Zapier delivery
|   |-- garmin/                # Garmin client, fetching, and normalization
|   |-- llm/                   # Prompts, OpenRouter client, and parsing
|   `-- sync/                  # Daily, morning, and weekly orchestration
|-- src/                       # React dashboard and styles
|-- test/                      # Node.js unit tests
|-- vercel.json                # Production cron schedules
`-- vite.config.js             # Frontend build and local API proxy
```

## AI and Data Quality

AI is an interpretation layer, not the system of record. The implementation uses several controls:

- Prompts instruct the model to use only supplied Garmin data and not invent missing metrics.
- OpenRouter requests a JSON object with a small summary-and-recommendations contract.
- Missing responses and invalid JSON fail the workflow instead of being accepted silently.
- Stored daily analyses and morning briefings include prompt versions so incompatible cached output can be regenerated.
- Normalized source metrics remain available for comparison and debugging.
- Dashboard responses omit the selected model and trim raw Garmin payloads.
- Email renderers escape model- and Garmin-provided text before inserting it into HTML.

When changing a prompt, update its version constant and test all deterministic parsing or normalization behavior. Keep a human in the loop for recommendations involving health, injury, or recovery.

## Security and Privacy

This is a personal project, not a multi-user health platform. Review these boundaries before deployment:

- `/api/dashboard` has no application-level authentication and exposes personal fitness data.
- Cron routes are the only authenticated endpoints; they use `CRON_SECRET` as a bearer token.
- Normalized health metrics are sent to OpenRouter for analysis.
- Recipient information and rendered summaries are sent to Zapier and Gmail.
- Garmin tokens are cached on a best-effort basis in the runtime's temporary directory.
- Postgres SSL is enabled, but the current client disables certificate verification.
- Row-level security is enabled by migrations, but the repository does not define access policies.
- API error responses currently include the underlying error message.

Use deployment protection or add application authentication before publishing the dashboard. Confirm the data-processing terms and retention settings of every external service for your use case.

## Troubleshooting

### `Missing environment variables: ...`

Add the named value to `.env` locally or to the Vercel project, then restart the process. Validation occurs when the relevant integration client is created.

### Garmin returns `429`

Garmin is rate-limiting authentication or data requests. Stop force-refreshing and retry later. Token reuse reduces repeated login pressure but does not remove upstream limits.

### The dashboard is empty

Run `npm run db:migrate`, then complete a morning sync. The dashboard reads `daily_briefings`, so an evening review alone does not populate it. Confirm that the API and sync use the same `DATABASE_URL`.

### `/api/health` succeeds but `/api/dashboard` fails

The health route does not query Postgres. Verify `DATABASE_URL`, SSL connectivity, and migrations, then inspect the `/api/dashboard` error response and the process output for connection failures.

### Overnight sleep is unavailable

Garmin may not have finalized the sleep record for the recovery date. The committed workflow records a failed sync, returns `500` from cron, and sends no email. Retry it manually later and avoid repeated forced requests while the upstream record is still pending.

### The weekly digest reports fewer than three days

The fixed seven-calendar-day range ending yesterday contains fewer than three distinct `daily_health_metrics` dates. The current CLI cannot backfill historical dates, so daily workflows must succeed on at least three separate days in the active window.

### A forced sync does not send another email

This is expected. Force mode refreshes compatible data and analysis caches; it does not bypass the unique email-delivery key.

### Zapier delivery fails

Confirm the Catch Hook URL, Gmail field mapping, recipient, and Zapier task history. A non-2xx webhook response fails the workflow and releases the unsent delivery claim for a later retry.

## Developer Guides

### Add a Garmin Metric

1. Fetch and null-safe the field in `server/garmin/`.
2. Add a migration if the metric needs a queryable column; otherwise keep it in `raw_payload`.
3. Map external values to a stable internal representation before persistence.
4. Update the relevant query and dashboard response shaper.
5. Define behavior for missing values before rendering the metric.
6. Add tests and increment the Garmin schema version when cached payload compatibility changes.

### Change the Dashboard Contract

Treat `server/db/queries/dashboard.js` as the API boundary:

1. Add only the fields a client needs.
2. Keep large source arrays and internal model metadata server-side.
3. Update `src/App.jsx` as the current contract consumer.
4. Add a response-shaping test that proves both retained and excluded fields.
5. Update the representative response in this README.

### Add a Scheduled Workflow

1. Add a local script entrypoint under `scripts/`.
2. Implement orchestration with shared upserts and `sync_runs` logging.
3. Close every Postgres pool in a `finally` block.
4. Render outbound email through the existing Zapier adapter.
5. Add a protected Vercel function if the workflow runs in production.
6. Add its UTC expression to `vercel.json` and document the local-time intent.
7. Test repeat execution, failures, and delivery deduplication before enabling it.

### Documentation Checklist

When behavior changes, update the documentation in the same pull request:

- Keep setup commands runnable from a clean clone.
- Mark configuration as required, conditional, or optional.
- Show request, response, empty, and error states for API changes.
- Explain external side effects such as API usage, database writes, and email delivery.
- Document cache, retry, and idempotency behavior.
- Prefer task-based examples over implementation-only descriptions.

Keep changes focused, run `npm test` and `npm run build`, and never commit `.env` or generated `dist/` files.
