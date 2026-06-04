---
name: AI usage table
description: DB-backed daily AI quota tracking via ai_usage table; replaces in-memory Map that reset on server restart.
---

## Rule
AI daily query counts are stored in `ai_usage` (userId int, date varchar(10) YYYY-MM-DD, count int). Use upsert: insert on first query of the day, update on subsequent ones.

**Why:**
The original in-memory `aiDailyCount` Map reset to zero on every server restart, effectively giving all users unlimited AI queries during active development or deploys.

**How to apply:**
`checkAiPlanLimit()` in `ai.ts` does the DB check after the plan-level `dailyLimit` is resolved. Free users (dailyLimit=0) are blocked before reaching the DB counter — the table only records usage for paid plan users who have a finite quota.

The table is indexed on (userId, date) via `ai_usage_user_date_idx` for fast per-user per-day lookups.
