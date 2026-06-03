---
name: JWT_SECRET persistence
description: JWT_SECRET set via setEnvVars gets cleared between agent sessions; must be re-set at session start if the API server fails to start.
---

**Rule:** If the API server crashes on startup with "JWT_SECRET environment variable is required", re-set the env var with setEnvVars and restart the workflow.

**Why:** setEnvVars persists the value within a session but can be cleared between separate agent sessions. The API server startup guard (added to artifacts/api-server/src/index.ts) will throw if JWT_SECRET is missing, which is intentional — it prevents the server from running without auth.

**How to apply:**
```javascript
const { randomBytes } = await import('crypto');
const secret = randomBytes(32).toString('hex');
await setEnvVars({ values: { JWT_SECRET: secret }, environment: "shared" });
// Then restart the workflow
```

**Long-term fix:** Ask the user to set JWT_SECRET as a Replit Secret via the Secrets panel — that would persist it permanently across all sessions.
