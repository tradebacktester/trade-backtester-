---
name: DB provisioning
description: The DB may show as "not provisioned" after workflow restarts even though it exists; the fix is to re-push the schema.
---

# DB provisioning

## Rule
After workflow restarts or environment resets, the DB tables may be missing even if `checkDatabase()` reports the database exists. Symptoms: API returns 500 with `Error: Failed query: select ... from "backtests"`.

**Fix:** Run `pnpm --filter @workspace/db run push-force` to re-create the tables. This is idempotent (safe to run multiple times).

**Why:** The Replit managed PostgreSQL database persists, but the schema (tables) may not exist if this is a fresh start. The `push-force` command uses drizzle-kit to apply the schema from `lib/db/src/schema/` to the live database.

**How to apply:** If any API route returns 500 with a "Failed query" error referencing a known table name, run push-force before investigating the application code.
