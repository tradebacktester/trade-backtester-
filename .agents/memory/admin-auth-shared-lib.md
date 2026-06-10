---
name: Admin auth shared lib
description: Shared admin HMAC token logic with hourly expiry — location and pattern.
---

Admin token generation and verification lives in `artifacts/api-server/src/lib/admin-auth.ts` and is imported by both `routes/admin.ts` and `routes/community.ts`.

The rule: all admin token logic MUST import from this single shared file — never duplicate locally.

**Why:** Duplicate `makeAdminToken`/`verifyAdminToken` in community.ts diverged from admin.ts (no time component, different salt risk). Centralizing ensures consistency.

**How to apply:** Tokens embed an hourly time window (`Math.floor(Date.now() / 3_600_000)`). `verifyAdminToken` accepts current hour AND previous hour for grace-period coverage. Tokens are effectively valid 1–2 hours from creation. If a new route needs admin auth, import from `../lib/admin-auth`, never reimplement.
