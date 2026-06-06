import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { createRateLimit } from "./lib/rate-limit";

const app: Express = express();

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

// CORS — in production restrict to explicitly allowed origins.
// Set ALLOWED_ORIGINS as a comma-separated list of allowed origins in your
// Railway / Replit environment, e.g.:
//   ALLOWED_ORIGINS=https://my-app.vercel.app,https://my-custom-domain.com
// Leave unset (or set to "*") only for local development.
const rawOrigins = process.env["ALLOWED_ORIGINS"] ?? "";
const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(requestOrigin, callback) {
      // Allow server-to-server requests (no Origin header) and same-origin
      if (!requestOrigin) return callback(null, true);
      // No restriction configured → open (dev / Replit only)
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
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

// Serve the pre-built Vite frontend for all non-API routes (SPA fallback)
const frontendDist = process.env["FRONTEND_DIST"] ?? path.resolve("dist/public");
if (fs.existsSync(frontendDist)) {
  // Hashed assets (index-abc123.js) can be cached long-term; index.html must never be cached
  app.use(
    express.static(frontendDist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
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
