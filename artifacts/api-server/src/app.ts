import express, { type Express, type Response as ExpressResponse } from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import router from "./routes";
import { ensureAcademySeed } from "./routes/academy";
import { logger } from "./lib/logger";
import { createRateLimit } from "./lib/rate-limit";
import { db, alertsTable, alertNotificationsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getIndicatorSnapshot } from "./lib/indicator-snapshot";
import { evaluateAlertConditions } from "./lib/alert-evaluator";

function getEmailTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

async function sendAlertWebhook(webhookUrl: string, payload: {
  alertName: string; symbol: string; message: string; triggeredAt: string;
}): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const r: { ok: boolean; status: number } = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "TradeLab-Alerts/1.0" },
      body: JSON.stringify({ event: "alert_triggered", ...payload }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) logger.warn({ status: r.status, webhookUrl }, "Webhook returned non-2xx");
  } catch (err) {
    logger.warn({ err, webhookUrl }, "Webhook delivery failed");
  }
}

async function sendAlertEmail(toEmail: string, alertName: string, symbol: string, message: string): Promise<void> {
  const transporter = getEmailTransporter();
  if (!transporter) return;
  const from = process.env.SMTP_FROM!;
  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `TradeLab Alert: ${alertName} triggered on ${symbol}`,
    text: message,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#fff;background:#1a1a1a;padding:16px;border-radius:8px">🔔 Alert Triggered</h2>
      <p><strong>Alert:</strong> ${alertName}</p>
      <p><strong>Symbol:</strong> ${symbol}</p>
      <p><strong>Message:</strong> ${message}</p>
      <hr>
      <p style="color:#888;font-size:12px">TradeLab — <a href="${process.env.APP_URL ?? "https://tradelab.app"}">View in app</a></p>
    </div>`,
  });
}

const app: Express = express();

const alertSseClients = new Map<number, Set<ExpressResponse>>();
(app as any)._alertSseClients = alertSseClients;

function broadcastAlertNotification(userId: number, payload: object) {
  const clients = alertSseClients.get(userId);
  if (!clients) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch { /* client disconnected */ }
  }
}

async function runAlertEvaluationLoop() {
  try {
    const activeAlerts = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.isActive, true));

    if (activeAlerts.length === 0) return;

    const snapshotCache = new Map<string, ReturnType<typeof getIndicatorSnapshot>>();

    for (const alert of activeAlerts) {
      const cacheKey = `${alert.symbol}:${alert.timeframe}`;
      if (!snapshotCache.has(cacheKey)) {
        try {
          const snap = getIndicatorSnapshot(alert.symbol, alert.timeframe);
          snapshotCache.set(cacheKey, snap);
        } catch {
          continue;
        }
      }

      const snapshot = snapshotCache.get(cacheKey)!;
      const conditions = (alert.conditions ?? []) as Parameters<typeof evaluateAlertConditions>[2];
      const { triggered, message } = evaluateAlertConditions(alert.name, alert.symbol, conditions, snapshot);

      if (!triggered) continue;

      const [notification] = await db
        .insert(alertNotificationsTable)
        .values({
          alertId: alert.id,
          userId: alert.userId,
          message,
        })
        .returning();

      broadcastAlertNotification(alert.userId, {
        type: "alert_triggered",
        notification: {
          ...notification!,
          triggeredAt: notification!.triggeredAt.toISOString(),
        },
      });

      // ── Delivery channels ─────────────────────────────────────────────
      const deliveryChannels = (alert.deliveryChannels ?? []) as string[];
      const triggeredAt = new Date().toISOString();

      if (deliveryChannels.includes("email")) {
        try {
          const [userRow] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, alert.userId));
          if (userRow?.email) {
            await sendAlertEmail(userRow.email, alert.name, alert.symbol, message);
          }
        } catch (emailErr) {
          logger.warn({ emailErr }, "Failed to send alert email");
        }
      }

      if (deliveryChannels.includes("webhook") && alert.webhookUrl) {
        await sendAlertWebhook(alert.webhookUrl, {
          alertName: alert.name,
          symbol: alert.symbol,
          message,
          triggeredAt,
        });
      }

      if (alert.triggerOnce) {
        await db
          .update(alertsTable)
          .set({ isActive: false, triggerCount: alert.triggerCount + 1, lastTriggeredAt: new Date() })
          .where(and(eq(alertsTable.id, alert.id), eq(alertsTable.isActive, true)));
      } else {
        await db
          .update(alertsTable)
          .set({ triggerCount: alert.triggerCount + 1, lastTriggeredAt: new Date() })
          .where(eq(alertsTable.id, alert.id));
      }
    }
  } catch (err) {
    logger.error({ err }, "Alert evaluation loop error");
  }
}

setInterval(() => { runAlertEvaluationLoop().catch(() => {}); }, 30_000);

// Auto-seed academy courses on startup (no-op if already seeded)
ensureAcademySeed().catch(err => logger.error({ err }, "Academy auto-seed failed"));

// ── Security headers (S-12) ───────────────────────────────────────────────────
// helmet() sets X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy,
// Permissions-Policy, and more. CSP is configured to allow the same-origin Vite
// frontend and the Recharts/LW-charts inline styles.
// CSRF NOTE (S-13): This API uses Bearer JWT tokens in Authorization headers,
// not cookies, so CSRF is not applicable — browsers enforce same-origin policy
// on reading responses regardless of how a cross-site request was triggered.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(
  (helmet as unknown as (...args: unknown[]) => express.RequestHandler)({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.binance.com", "https://api.groq.com", "wss://stream.binance.com:9443"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        frameSrc: ["'none'"],
        frameAncestors: ["'self'", "https://*.replit.dev", "https://*.replit.app", "https://*.repl.co"],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  }),
);

// Gzip all responses — critical for mobile (3 MB JS → ~650 KB over the wire)
app.use(compression());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(
  (pinoHttp as unknown as (...args: unknown[]) => express.RequestHandler)({
    logger,
    serializers: {
      req(req: { id: unknown; method: string; url?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — always restricts to an explicit allow-list.
// In dev, falls back to the Replit dev domain so the proxied preview works.
// Set ALLOWED_ORIGINS as a comma-separated list to add extra origins, e.g.:
//   ALLOWED_ORIGINS=https://my-app.replit.app,https://my-custom-domain.com
const rawOrigins = process.env["ALLOWED_ORIGINS"] ?? "";
const configuredOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Always include the Replit dev domain so the in-editor preview never breaks.
const replitDevDomain = process.env["REPLIT_DEV_DOMAIN"]
  ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
  : null;
const allowedOrigins = [
  ...configuredOrigins,
  ...(replitDevDomain ? [replitDevDomain] : []),
];

app.use(
  cors({
    origin(requestOrigin, callback) {
      // Allow server-to-server requests (no Origin header) and same-origin
      if (!requestOrigin) return callback(null, true);
      // Matched against explicit allow-list
      if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
      // Allow any Replit-hosted domain (dev previews and deployed .replit.app)
      if (requestOrigin.endsWith(".replit.dev") || requestOrigin.endsWith(".replit.app"))
        return callback(null, true);
      // In development, also allow localhost variants
      if (process.env["NODE_ENV"] !== "production" &&
          (requestOrigin.startsWith("http://localhost:") || requestOrigin.startsWith("http://127.0.0.1:")))
        return callback(null, true);
      callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-token"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(createRateLimit(200));

app.use("/api", router);

// Global JSON error handler — must come after the router.
// Express 5 propagates async route errors here automatically.
// Without this, unhandled errors return an HTML page which causes
// res.json() in the browser to throw a SyntaxError, masking the real error.
app.use((err: unknown, _req: express.Request, res: ExpressResponse, _next: express.NextFunction) => {
  const status = typeof (err as { status?: number }).status === "number"
    ? (err as { status: number }).status
    : 500;
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error({ err }, "Unhandled route error");
  if (!res.headersSent) {
    res.status(status).json({ error: status < 500 ? message : "Internal server error" });
  }
});

// Serve drawing tools at /drawing-tools (vanilla JS app — no build needed)
const drawingToolsDir = path.resolve(process.cwd(), "tradingview-drawing");
if (fs.existsSync(drawingToolsDir)) {
  app.use(
    "/drawing-tools",
    express.static(drawingToolsDir, {
      setHeaders(res) { res.setHeader("Cache-Control", "no-store"); },
    }),
  );
  logger.info({ drawingToolsDir }, "Serving drawing tools");
}

// Serve .well-known directory (needed for TWA assetlinks.json from PWA Builder)
const wellKnownDir = path.resolve(process.cwd(), "public", ".well-known");
if (!fs.existsSync(wellKnownDir)) fs.mkdirSync(wellKnownDir, { recursive: true });
app.use("/.well-known", express.static(wellKnownDir, {
  setHeaders(res) { res.setHeader("Cache-Control", "no-store"); },
}));

// Serve uploaded academy images
const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir, {
  setHeaders(res, filePath) {
    if (process.env["NODE_ENV"] !== "production" || filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store");
    }
  },
}));

// Serve the pre-built Vite frontend for all non-API routes (SPA fallback).
// Set SERVE_FRONTEND=false on Railway (API-only) so this block is skipped.
const serveFrontend = process.env["SERVE_FRONTEND"] !== "false";
const frontendDist = process.env["FRONTEND_DIST"] ?? path.resolve("dist/public");
if (serveFrontend && fs.existsSync(frontendDist)) {
  // In development, disable all caching so the preview pane always loads fresh assets
  const isDev = process.env["NODE_ENV"] !== "production";
  app.use(
    express.static(frontendDist, {
      setHeaders(res, filePath) {
        if (isDev || filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );
  // SPA fallback — always send fresh index.html for unknown routes
  app.get(/.*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  logger.info({ frontendDist }, "Serving frontend static files");
} else {
  logger.warn({ frontendDist }, "Frontend dist not found — API-only mode");
}

export default app;
