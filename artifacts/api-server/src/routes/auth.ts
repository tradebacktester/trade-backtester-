import { Router, type IRouter } from "express";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { db, usersTable, authAttemptsTable, authFailuresTable } from "@workspace/db";
import { eq, gt, lt, count as drizzleCount, and as drizzleAnd } from "drizzle-orm";
import { signJwt } from "../lib/jwt";

const JWT_SECRET = process.env.JWT_SECRET!;

// ── DB-based rate limiting (10 req/min per IP) — survives server restarts ────
async function checkAuthRateLimit(ip: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const [{ cnt }] = await db
    .select({ cnt: drizzleCount(authAttemptsTable.id) })
    .from(authAttemptsTable)
    .where(drizzleAnd(eq(authAttemptsTable.ip, ip), gt(authAttemptsTable.createdAt, oneMinuteAgo)));
  if (cnt >= 10) return false;
  await db.insert(authAttemptsTable).values({ ip });
  // Prune records older than 5 minutes to prevent unbounded table growth
  const fiveMinutesAgo = new Date(Date.now() - 300_000);
  await db.delete(authAttemptsTable).where(lt(authAttemptsTable.createdAt, fiveMinutesAgo));
  return true;
}

// ── Account lockout after 10 failed signin attempts in 15 min (S-19) ─────────
async function recordAuthFailure(ip: string): Promise<void> {
  await db.insert(authFailuresTable).values({ ip });
  const pruneOlderThan = new Date(Date.now() - 30 * 60_000);
  await db.delete(authFailuresTable).where(lt(authFailuresTable.createdAt, pruneOlderThan));
}

async function isLockedOut(ip: string): Promise<boolean> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000);
  const [{ cnt }] = await db
    .select({ cnt: drizzleCount(authFailuresTable.id) })
    .from(authFailuresTable)
    .where(drizzleAnd(eq(authFailuresTable.ip, ip), gt(authFailuresTable.createdAt, fifteenMinutesAgo)));
  return cnt >= 10;
}
function getAuthIp(req: import("express").Request): string {
  return (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";
}

const router: IRouter = Router();

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function createPasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashPassword(password, salt)}`;
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  try {
    const hashed = hashPassword(password, salt);
    return timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(hashed, "hex"));
  } catch {
    return false;
  }
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  if (!await checkAuthRateLimit(getAuthIp(req))) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    res.status(400).json({ error: "Email, name, and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }
  const passwordHash = createPasswordHash(password);
  const [user] = await db.insert(usersTable).values({ email: email.toLowerCase(), name, passwordHash }).returning();
  const token = signJwt({ id: user!.id, email: user!.email }, JWT_SECRET);
  res.status(201).json({ user: { id: user!.id, email: user!.email, name: user!.name, banned: user!.banned }, token });
});

router.post("/auth/signin", async (req, res): Promise<void> => {
  const ip = getAuthIp(req);

  // S-19: Block IPs with ≥10 failed attempts in the last 15 minutes
  if (await isLockedOut(ip)) {
    res.status(429).json({ error: "Too many failed login attempts. Please try again in 15 minutes." });
    return;
  }

  if (!await checkAuthRateLimit(ip)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // Record the failure for lockout tracking
    await recordAuthFailure(ip);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (user.banned) {
    res.status(403).json({ error: `Your account has been suspended${user.bannedReason ? `: ${user.bannedReason}` : ""}` });
    return;
  }
  const token = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ user: { id: user.id, email: user.email, name: user.name, banned: user.banned }, token });
});

export default router;
