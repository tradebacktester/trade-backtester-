import { randomBytes } from "crypto";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "8080";

// Auto-generate JWT_SECRET if not set (e.g. fresh Replit import without secrets configured).
// Tokens will only be valid for this session; add JWT_SECRET as a Replit secret for
// persistent logins that survive restarts.
if (!process.env["JWT_SECRET"]) {
  process.env["JWT_SECRET"] = randomBytes(64).toString("hex");
  logger.warn(
    "JWT_SECRET not configured — auto-generated a random one for this session. " +
    "Add JWT_SECRET as a Replit secret to keep users logged in across restarts.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
