---
name: Social graph schema
description: DB schema additions for social/user discovery — columns, follows table, migration approach
---

## Schema additions to app_users
- `username TEXT UNIQUE` — auto-generated on signup as `<name_slug><id>` (always unique); null for pre-existing users until first profile access
- `bio TEXT` — free-text, max 300 chars
- `trading_style TEXT` — short label, max 60 chars

## user_follows table
- `follower_id → app_users(id) CASCADE`
- `following_id → app_users(id) CASCADE`
- `UNIQUE(follower_id, following_id)` as `user_follows_pair_idx`

## Migration approach
`drizzle-kit push --force` prompts interactively for unique constraints when table has data — fails in non-TTY shells.
**Fix:** apply via a `.cjs` script using the pg Pool from `node_modules/.pnpm/pg@8.20.0/node_modules/pg`.
Script lives at `scripts/migrate-social.cjs`.

**Why:** The `--force` flag does not suppress the "truncate?" prompt for unique indexes on non-empty tables; only a raw SQL `ADD COLUMN IF NOT EXISTS` + `ADD CONSTRAINT IF NOT EXISTS` approach works reliably.

## Username auto-generation on signup
In `auth.ts` after the INSERT .returning(), generate: `lowercase(name, strip non-alphanum) + id`.
In `users.ts` GET /users/:id and GET /users/me, lazily generate username if still null and UPDATE the row.
