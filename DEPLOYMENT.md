# Deploying Trade Lab — Vercel (frontend) + Railway (backend)

## Architecture

```
Browser → Vercel (React SPA) → Railway (Express API) → Railway PostgreSQL
```

The Express backend serves only `/api/*` routes. The React frontend is a
static build deployed to Vercel. All fetch calls use `VITE_API_URL` to target
the Railway backend.

---

## 1 · Deploy the Backend to Railway

1. Create a new Railway project at <https://railway.app>
2. **Add a PostgreSQL plugin** — Railway auto-sets `DATABASE_URL`
3. **Deploy from GitHub** — point Railway at your repo, set the root directory
   to `/` and the build command to:
   ```
   bash scripts/build.sh
   ```
   Start command:
   ```
   FRONTEND_DIST=none PORT=$PORT node --enable-source-maps artifacts/api-server/dist/index.mjs
   ```
4. **Set environment variables** (use `artifacts/api-server/.env.example` as reference):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Auto-set by Railway Postgres plugin |
   | `JWT_SECRET` | Random 64-byte hex string |
   | `GROQ_API_KEY` | Your Groq key |
   | `ADMIN_ID` | Your admin ID |
   | `ADMIN_PASSWORD` | Your admin password |
   | `ADMIN_ID_2` | Second admin ID |
   | `ADMIN_PASSWORD_2` | Second admin password |
   | `ALLOWED_ORIGINS` | Your Vercel domain (add after step below) |
   | `NODE_ENV` | `production` |

5. Note your Railway public domain (e.g. `https://trade-lab-api.up.railway.app`)

---

## 2 · Deploy the Frontend to Vercel

1. Import your repo at <https://vercel.com>
2. Set **Framework Preset** → Vite
3. Set **Root Directory** → `artifacts/trade-backtest`
4. Set **Build Command** → `pnpm run build`
5. Set **Output Directory** → `dist/public`
6. **Add environment variable**:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | Your Railway backend URL (e.g. `https://trade-lab-api.up.railway.app`) |

7. Deploy — note your Vercel domain (e.g. `https://trade-lab.vercel.app`)

---

## 3 · Wire CORS

Go back to Railway → your service → Variables, and update:

```
ALLOWED_ORIGINS=https://trade-lab.vercel.app,https://your-custom-domain.com
```

Redeploy the Railway service for the change to take effect.

---

## 4 · Run Database Migrations on Railway

After the first deploy, run schema migrations via Railway's shell:

```bash
pnpm --filter @workspace/db run push
```

Or use Railway's one-off command runner.

---

## Environment Variable Reference

| Variable | Required | Where |
|---|---|---|
| `DATABASE_URL` | ✅ | Railway |
| `JWT_SECRET` | ✅ | Railway |
| `GROQ_API_KEY` | ✅ | Railway |
| `ADMIN_ID` | ✅ | Railway |
| `ADMIN_PASSWORD` | ✅ | Railway |
| `ADMIN_ID_2` | ✅ | Railway |
| `ADMIN_PASSWORD_2` | ✅ | Railway |
| `ALLOWED_ORIGINS` | ✅ production | Railway |
| `RAZORPAY_KEY_ID` | ⚠️ payments only | Railway |
| `RAZORPAY_KEY_SECRET` | ⚠️ payments only | Railway |
| `VITE_API_URL` | ✅ | Vercel |
