import { Router, type IRouter } from "express";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import {
  db, usersTable, authAttemptsTable, authFailuresTable,
  passwordResetsTable, securityQuestionsTable, backupCodesTable,
} from "@workspace/db";
import { eq, gt, lt, count as drizzleCount, and as drizzleAnd, isNull } from "drizzle-orm";
import { signJwt } from "../lib/jwt";

const JWT_SECRET = process.env.JWT_SECRET!;

// ── DB-based rate limiting (10 req/min per IP) ────────────────────────────────
async function checkAuthRateLimit(ip: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const [{ cnt }] = await db
    .select({ cnt: drizzleCount(authAttemptsTable.id) })
    .from(authAttemptsTable)
    .where(drizzleAnd(eq(authAttemptsTable.ip, ip), gt(authAttemptsTable.createdAt, oneMinuteAgo)));
  if (cnt >= 10) return false;
  await db.insert(authAttemptsTable).values({ ip });
  const fiveMinutesAgo = new Date(Date.now() - 300_000);
  await db.delete(authAttemptsTable).where(lt(authAttemptsTable.createdAt, fiveMinutesAgo));
  return true;
}

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

// ── Password hashing ──────────────────────────────────────────────────────────
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
  } catch { return false; }
}

// ── Security answer hashing (same scheme, normalised to lowercase) ────────────
function normaliseAnswer(a: string): string { return a.trim().toLowerCase(); }
function hashAnswer(answer: string): string { return createPasswordHash(normaliseAnswer(answer)); }
function verifyAnswer(answer: string, hash: string): boolean {
  return verifyPassword(normaliseAnswer(answer), hash);
}

// ── Backup code generation ────────────────────────────────────────────────────
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O I 0 1
function generateBackupCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
function generateSixBackupCodes(): string[] {
  return Array.from({ length: 6 }, generateBackupCode);
}

// ── Signup ────────────────────────────────────────────────────────────────────
router.post("/auth/signup", async (req, res): Promise<void> => {
  if (!await checkAuthRateLimit(getAuthIp(req))) {
    res.status(429).json({ error: "Too many requests. Please try again later." }); return;
  }
  const { email, name, password, securityQuestions } = req.body;
  if (!email || !name || !password) {
    res.status(400).json({ error: "Email, name, and password are required" }); return;
  }
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Please enter a valid email address" }); return;
  }
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 100) {
    res.status(400).json({ error: "Name must be between 1 and 100 characters" }); return;
  }
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    res.status(400).json({ error: "Password must be 6–128 characters" }); return;
  }

  // Validate security questions
  if (!Array.isArray(securityQuestions) || securityQuestions.length !== 3) {
    res.status(400).json({ error: "3 security questions with answers are required" }); return;
  }
  for (const q of securityQuestions) {
    if (!q.question || typeof q.question !== "string" || q.question.trim().length === 0) {
      res.status(400).json({ error: "Each security question must have a question selected" }); return;
    }
    if (!q.answer || typeof q.answer !== "string" || q.answer.trim().length < 2) {
      res.status(400).json({ error: "Each security answer must be at least 2 characters" }); return;
    }
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" }); return;
  }

  const passwordHash = createPasswordHash(password);
  const [user] = await db.insert(usersTable)
    .values({ email: email.toLowerCase(), name, passwordHash })
    .returning();
  if (!user) { res.status(500).json({ error: "Failed to create account" }); return; }

  // Store security questions
  await db.insert(securityQuestionsTable).values({
    userId: user.id,
    question1: securityQuestions[0].question,
    answerHash1: hashAnswer(securityQuestions[0].answer),
    question2: securityQuestions[1].question,
    answerHash2: hashAnswer(securityQuestions[1].answer),
    question3: securityQuestions[2].question,
    answerHash3: hashAnswer(securityQuestions[2].answer),
  });

  // Generate and store 6 backup codes
  const plainCodes = generateSixBackupCodes();
  await db.insert(backupCodesTable).values(
    plainCodes.map(code => ({ userId: user.id, codeHash: createPasswordHash(code.replace("-", "")) }))
  );

  const token = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, banned: user.banned },
    token,
    backupCodes: plainCodes,
  });
});

// ── Get security questions for an email (for forgot-password flow) ────────────
router.post("/auth/security-questions", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" }); return;
  }
  const [user] = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    // Don't reveal whether email exists — return generic placeholder questions
    res.json({ questions: ["", "", ""] }); return;
  }
  const [sq] = await db.select()
    .from(securityQuestionsTable)
    .where(eq(securityQuestionsTable.userId, user.id));
  if (!sq) {
    res.json({ questions: ["", "", ""] }); return;
  }
  res.json({ questions: [sq.question1, sq.question2, sq.question3] });
});

// ── Verify security answers → issue password-reset token ─────────────────────
router.post("/auth/verify-security", async (req, res): Promise<void> => {
  if (!await checkAuthRateLimit(getAuthIp(req))) {
    res.status(429).json({ error: "Too many requests. Please try again later." }); return;
  }
  const { email, answers } = req.body;
  if (!email || !Array.isArray(answers) || answers.length !== 3) {
    res.status(400).json({ error: "Email and 3 answers are required" }); return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(400).json({ error: "Incorrect answers. Please try again." }); return;
  }
  const [sq] = await db.select().from(securityQuestionsTable)
    .where(eq(securityQuestionsTable.userId, user.id));
  if (!sq) {
    res.status(400).json({ error: "No security questions set for this account." }); return;
  }
  const ok = verifyAnswer(answers[0], sq.answerHash1)
    && verifyAnswer(answers[1], sq.answerHash2)
    && verifyAnswer(answers[2], sq.answerHash3);
  if (!ok) {
    await recordAuthFailure(getAuthIp(req));
    res.status(400).json({ error: "Incorrect answers. Please try again." }); return;
  }
  // Invalidate old unused tokens
  await db.update(passwordResetsTable)
    .set({ usedAt: new Date() })
    .where(drizzleAnd(eq(passwordResetsTable.userId, user.id), isNull(passwordResetsTable.usedAt)));
  const resetToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 minutes
  await db.insert(passwordResetsTable).values({ userId: user.id, token: resetToken, expiresAt });
  res.json({ resetToken });
});

// ── Reset password (works for both email-link and security-question flows) ────
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400).json({ error: "Token and new password are required" }); return;
  }
  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" }); return;
  }
  const [reset] = await db.select().from(passwordResetsTable).where(eq(passwordResetsTable.token, token));
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset link" }); return;
  }
  const passwordHash = createPasswordHash(password);
  const [user] = await db.update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, reset.userId))
    .returning();
  if (!user) { res.status(400).json({ error: "User account not found" }); return; }
  await db.update(passwordResetsTable).set({ usedAt: new Date() }).where(eq(passwordResetsTable.id, reset.id));
  const jwtToken = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ user: { id: user.id, email: user.email, name: user.name, banned: user.banned }, token: jwtToken });
});

// ── Signin (password OR backup code) ─────────────────────────────────────────
router.post("/auth/signin", async (req, res): Promise<void> => {
  const ip = getAuthIp(req);
  if (await isLockedOut(ip)) {
    res.status(429).json({ error: "Too many failed login attempts. Please try again in 15 minutes." }); return;
  }
  if (!await checkAuthRateLimit(ip)) {
    res.status(429).json({ error: "Too many requests. Please try again later." }); return;
  }
  const { email, password, backupCode } = req.body;
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  // ── Backup code path ──
  if (backupCode) {
    if (!user) { await recordAuthFailure(ip); res.status(401).json({ error: "Invalid email or backup code" }); return; }
    const normalised = String(backupCode).replace(/[-\s]/g, "").toUpperCase();
    const codes = await db.select().from(backupCodesTable)
      .where(drizzleAnd(eq(backupCodesTable.userId, user.id), eq(backupCodesTable.used, false)));
    const matched = codes.find(c => verifyPassword(normalised, c.codeHash));
    if (!matched) { await recordAuthFailure(ip); res.status(401).json({ error: "Invalid or already-used backup code" }); return; }
    await db.update(backupCodesTable).set({ used: true }).where(eq(backupCodesTable.id, matched.id));
    if (user.banned) {
      res.status(403).json({ error: `Your account has been suspended${user.bannedReason ? `: ${user.bannedReason}` : ""}` }); return;
    }
    const token = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ user: { id: user.id, email: user.email, name: user.name, banned: user.banned }, token });
    return;
  }

  // ── Password path ──
  if (!password) { res.status(400).json({ error: "Password or backup code is required" }); return; }
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await recordAuthFailure(ip);
    res.status(401).json({ error: "Invalid email or password" }); return;
  }
  if (user.banned) {
    res.status(403).json({ error: `Your account has been suspended${user.bannedReason ? `: ${user.bannedReason}` : ""}` }); return;
  }
  const token = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ user: { id: user.id, email: user.email, name: user.name, banned: user.banned }, token });
});

export default router;
