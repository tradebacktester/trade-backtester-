---
name: AI router middleware scope
description: router.use(fn) without a path in a mounted sub-router intercepts every request that reaches it, not just the routes defined in that file.
---

## Rule
Always scope sub-router middleware to a path prefix, never bare `router.use(fn)`.

**Wrong:**
```typescript
// In ai.ts — intercepts ALL requests reaching this router
router.use(requirePlanAiAccess);
```

**Correct:**
```typescript
// Only runs for /ai/* requests
router.use("/ai", requirePlanAiAccess);
```

**Why:**
In `routes/index.ts`, all sub-routers are mounted with `router.use(subRouter)` — no path prefix. Express processes them in order. If `aiRouter` comes before `communityRouter` and has a bare `router.use(fn)`, the middleware runs for every request including `POST /community`, sending a 403 AI error before the community handler is ever reached.

**How to apply:**
Any time you add `router.use(middleware)` to a sub-router in this codebase, give it the path prefix matching that router's routes (e.g. `"/ai"`, `"/strategies"`, `"/backtests"`, `"/trading-os"`). This has been a recurring bug: trading-os.ts had bare `router.use(requireAuth)` which blocked ALL academy admin routes (returning "Authentication required" instead of hitting requireAdmin). Fixed by scoping to `router.use("/trading-os", requireAuth)`.
