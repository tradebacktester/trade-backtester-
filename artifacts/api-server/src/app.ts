import express, { type Express, type Response } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { createRateLimit } from "./lib/rate-limit";
import { db, alertsTable, alertNotificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getIndicatorSnapshot } from "./lib/indicator-snapshot";
import { evaluateAlertConditions } from "./lib/alert-evaluator";

const app: Express = express();

const alertSseClients = new Map<number, Set<Response>>();
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

// Gzip all responses — critical for mobile (3 MB JS → ~650 KB over the wire)
app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
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
      // Matched against explicit allow-list only — never open wildcard
      if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
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
