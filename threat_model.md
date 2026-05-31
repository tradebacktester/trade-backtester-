# Threat Model

## Project Overview

A full-stack algorithmic trade backtesting platform. Users create indicator-based strategies (SMA, EMA, RSI, MACD, Bollinger Bands) and run backtests against deterministic simulated OHLCV price data. The platform includes a subscription system (Razorpay), an AI trading tutor (Groq), a community post board, and an admin panel.

Stack: Express 5 API (port 8080), React+Vite frontend (port 24593), PostgreSQL+Drizzle ORM, Node.js 24. Hosted on Replit. No external market data API — price data is algorithmically generated.

## Assets

- **Admin credentials** — `ADMIN_ID` and `ADMIN_PASSWORD` gate full platform control: user bans, plan management, subscription grants, community moderation, and policy edits. Compromise gives attacker complete platform control.
- **User accounts** — email + scrypt-hashed passwords. Compromise allows impersonation and access to backtest results.
- **JWT tokens** — base64-encoded payloads carrying `userId` in `Authorization: Bearer` headers. The signing secret must be protected; tokens that are only decoded (not verified) are trivially forgeable.
- **Groq / Gemini API keys** — server-side keys for LLM inference. Exposure drains quota and incurs cost with no user-level attribution.
- **Razorpay key pair** — `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`. Secret key allows initiating and querying payment orders.
- **User backtest data** — strategies, parameters, and performance results stored in PostgreSQL. No PII beyond email, but proprietary to each user.
- **Community posts** — user-generated content; content moderation is admin-controlled.

## Trust Boundaries

- **Browser → API** — The Vite dev server proxies `/api` to the Express server. All client requests are untrusted; every protected endpoint must enforce auth server-side.
- **API → PostgreSQL** — Direct Drizzle ORM connection. SQL injection at the API layer would grant full database access. Drizzle uses parameterized queries throughout.
- **API → Groq / Gemini** — Server calls LLM APIs with secret keys. Unprotected AI endpoints expose these keys to quota exhaustion by unauthenticated callers.
- **API → Razorpay** — Server creates and verifies payment orders. Signature verification on the webhook/callback side is essential.
- **Public vs Authenticated** — Strategies, backtests, subscription status, and AI chat require a valid Bearer token. Community read, policy listing, and subscription plans are public. Admin routes require an admin token derived from `ADMIN_ID`+`ADMIN_PASSWORD`.
- **User vs Admin** — Admin routes are gated by an HMAC token. The HMAC secret must be derived entirely from environment variables (not partially hardcoded in source).

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/routes/` (all `.ts` files), `artifacts/api-server/src/app.ts`
- **Highest-risk areas:** `routes/admin.ts` (admin auth, user/subscription control), `routes/ai.ts` (unauthenticated LLM proxy), `routes/subscription.ts` (payment flow, JWT decode), `routes/community.ts` (duplicate admin-auth code)
- **Public surface:** `GET /api/community`, `GET /api/policies`, `GET /api/subscription/plans`, `GET /api/klines`, `POST /api/auth/signup`, `POST /api/auth/signin`
- **Authenticated surface:** `GET/POST /api/strategies`, `GET/POST /api/backtests`, `GET /api/subscription/status`, `POST /api/ai/chat`
- **Admin surface:** `POST /api/admin/login`, all `/api/admin/*` routes
- **Dev-only:** `artifacts/mockup-sandbox/` — canvas preview server, not part of production API surface

## Threat Categories

### Spoofing

**Admin token predictability (CRITICAL before fix):** The HMAC secret was derived as `` `${ADMIN_ID}:adivasu:admin` `` — a hardcoded salt. Because `ADMIN_ID` is stored in `.replit [userenv.shared]`, anyone with repository read access could compute the admin token without knowing the password. The salt must come entirely from environment variables. **Required guarantee:** `HMAC_SECRET` MUST be derived solely from `ADMIN_ID` and `ADMIN_PASSWORD` (both env-only), with no hardcoded component in source.

**JWT not signature-verified:** `extractUserId` in `subscription.ts` base64-decodes the JWT payload without verifying the signature. A user can craft a token with any `id` and gain access to another user's subscription data. **Required guarantee:** JWT tokens MUST be verified with `crypto.verify` or a library (e.g., `jsonwebtoken`) against a server-held secret before trusting any payload field.

**Brute-force on signin:** No rate limiting on `POST /api/auth/signin`. **Required guarantee:** Auth endpoints MUST enforce per-IP rate limiting (≤10 requests/minute).

### Tampering

**Subscription feature limits client-bypass:** Feature flags like `maxBacktestsPerMonth` and `aiQueriesPerDay` are defined in plan records but enforcement at the route level is not present for backtests. **Required guarantee:** Backtest creation MUST check the user's plan limits server-side before inserting a new backtest record.

**Community post spoofing:** `userId` in community posts is accepted from the request body without auth verification. A caller can post as any `userId`. **Required guarantee:** The `userId` on community posts MUST be derived from the authenticated session, not the request body.

### Information Disclosure

**CORS wildcard:** `app.use(cors())` allows any origin. Cross-origin requests from attacker-controlled sites can make API calls on behalf of logged-in users (if cookie-based auth is ever added) and read response bodies. **Required guarantee:** CORS MUST restrict allowed origins to the application's own domain(s).

**Verbose error propagation:** Some routes propagate raw error messages from the database or Razorpay directly to the client. **Required guarantee:** API error responses MUST return generic messages for 5xx errors; raw error details MUST only appear in server logs.

**Request body size unbounded:** `express.json()` with no size limit allows large payloads that waste server memory. **Required guarantee:** Request body parsing MUST enforce a size cap (1 MB for JSON).

### Denial of Service

**Unauthenticated AI endpoint:** `POST /api/ai/chat` requires no authentication. Any unauthenticated caller can send unlimited requests, exhausting Groq API quota at the operator's expense. **Required guarantee:** The AI chat endpoint MUST require a valid user Bearer token AND enforce per-user rate limiting.

**No rate limiting on public write endpoints:** `POST /api/community` and like/report endpoints accept unauthenticated writes with no throttle. **Required guarantee:** Public write endpoints MUST enforce per-IP rate limiting to prevent spam flooding.

### Elevation of Privilege

**Duplicate admin-auth code in community.ts:** `makeAdminToken` and `verifyAdminToken` are copy-pasted into `community.ts` independent of `admin.ts`, increasing the chance of divergence. **Required guarantee:** Admin token logic MUST live in a single shared utility imported by all route files.

**`ADMIN_PASSWORD` comparison timing:** `String(id) !== ADMIN_ID || password !== ADMIN_PASSWORD` uses non-constant-time string comparison. Timing attacks against the password are theoretically possible. **Required guarantee:** Admin credential comparison MUST use `crypto.timingSafeEqual`.

**Razorpay payment verification:** The subscription verify route must use HMAC-SHA256 to validate Razorpay payment signatures before marking a subscription active. Skipping this allows fake payment confirmation.
