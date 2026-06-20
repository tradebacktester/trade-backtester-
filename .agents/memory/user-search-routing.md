---
name: User search routing
description: Express route ordering gotcha for /users/search vs /users/:id; rebuild required for dist-served servers
---

## Route ordering (critical)
`GET /users/search` MUST be declared BEFORE `GET /users/:id` in `artifacts/api-server/src/routes/users.ts`.
If declared after, Express matches "search" as `:id = "search"` and returns `{ error: "Invalid user id" }`.

Current correct order in users.ts:
1. GET /users/me
2. GET /users/search
3. GET /users/by-username/:username
4. GET /users/:id/followers
5. GET /users/:id/following
6. GET /users/:id
7. POST /users/:id/follow
8. DELETE /users/:id/follow
9. PATCH /users/me

## Rebuild required after changes
`Start application` workflow uses pre-built dist bundle (`artifacts/api-server/dist/index.mjs`).
Source changes are NOT picked up until `pnpm --filter @workspace/api-server run build` + `pnpm --filter @workspace/trade-backtest run build` are run and the workflow is restarted.

**Why:** `start.sh` checks timestamp of dist vs src to decide whether to rebuild, but the timestamp comparison can fail to detect changes made via agent tools. Always force-rebuild after route/schema changes.
