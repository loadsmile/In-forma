# Fitness Agent Rules

## Tech Stack

- Runtime: Node.js 20+ with ES Modules only.
- Frontend: React with Vite, no TypeScript.
- Database: Postgres via `pg` against Supabase.
- Dates: `date-fns` only.
- LLM: OpenRouter via the `openai` SDK.
- Garmin integration: `@gooin/garmin-connect`.
- Email delivery: Zapier webhook to Gmail only.
- Do not add Resend or any other direct email provider.

## Folder Structure Overview

- `src/` React dashboard app and shared UI utilities.
- `scripts/` scheduled sync entrypoints such as morning, evening, weekly, and migrations.
- `server/` Node-side Garmin sync, analysis, email rendering, webhook delivery, and database helpers.
- `server/db/` schema, migrations, pool setup, upsert helpers, and query modules.
- `server/garmin/` Garmin fetch and normalization logic.
- `server/llm/` prompt builders and analysis clients.
- `server/email/` HTML email rendering and Zapier payload formatting.

## Coding Rules

- Always use the shared upsert helper for inserts that may repeat.
- Always use `date-fns` for date parsing, formatting, math, and timezone-adjacent handling.
- Always null-safe Garmin fields with `?? null` when mapping external data.
- Always close any `pg` pool in a `finally` block.
- Always log each sync run to the `sync_runs` table, including failures.
- Keep the codebase JavaScript-only unless the user explicitly requests TypeScript.
- Keep Zapier as the only outbound delivery mechanism.

## Environment Variables

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

## GitHub Actions Schedule

- `morning-sync`: `0 9 * * *`
- `evening-sync`: `30 19 * * *`
- `weekly-digest`: `0 17 * * 0`
