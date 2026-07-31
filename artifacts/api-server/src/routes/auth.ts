import { Router, type IRouter } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import {
  db, usersTable, authAttemptsTable, authFailuresTable,
  passwordResetsTable, securityQuestionsTable, backupCodesTable,
  webauthnCredentialsTable,
} from "@workspace/db";
import { eq, gt, lt, count as drizzleCount, and as drizzleAnd, isNull } from "drizzle-orm";
import { signJwt } from "../lib/jwt";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const scryptAsync = promisify(scrypt);
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
async function hashPassword(password: string, salt: string): Promise<string> {
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return derived.toString("hex");
}
async function createPasswordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${await hashPassword(password, salt)}`;
}
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  try {
    const hashed = await hashPassword(password, salt);
    return timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(hashed, "hex"));
  } catch { return false; }
}

// ── Security answer hashing ───────────────────────────────────────────────────
function normaliseAnswer(a: string): string { return a.trim().toLowerCase(); }
async function hashAnswer(answer: string): Promise<string> { return createPasswordHash(normaliseAnswer(answer)); }
async function verifyAnswer(answer: string, hash: string): Promise<boolean> {
  return verifyPassword(normaliseAnswer(answer), hash);
}

// ── Backup code generation ────────────────────────────────────────────────────
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateBackupCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
function generateSixBackupCodes(): string[] {
  return Array.from({ length: 6 }, generateBackupCode);
}

// ── WebAuthn challenge store (in-memory, TTL 5 min) ───────────────────────────
interface ChallengeEntry {
  challenge: string;
  userId?: number;
  email?: string;
  expiresAt: number;
}
const challengeStore = new Map<string, ChallengeEntry>();

function pruneExpiredChallenges() {
  const now = Date.now();
  for (const [id, entry] of challengeStore) {
    if (entry.expiresAt < now) challengeStore.delete(id);
  }
}

function getOriginAndRpId(req: import("express").Request): { origin: string; rpId: string } {
  const host = req.headers["origin"] ?? req.headers["host"] ?? "localhost";
  const origin = typeof host === "string" && host.startsWith("http") ? host : `https://${host}`;
  const url = new URL(origin);
  return { origin, rpId: url.hostname };
}

// ── Signup ────────────────────────────────────────────────────────────────────
router.post("/auth/signup", async (req, res): Promise<void> => {
  if (!await checkAuthRateLimit(getAuthIp(req))) {
    res.status(429).json({ error: "Too many requests. Please try again later." }); return;
  }
  const { email, name, password, securityQuestions, skipSecurityQuestions } = req.body;
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

  // Security questions are optional when biometric is used
  const useSecurityQuestions = !skipSecurityQuestions && Array.isArray(securityQuestions) && securityQuestions.length === 3;
  if (!skipSecurityQuestions && securityQuestions) {
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
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" }); return;
  }

  const passwordHash = await createPasswordHash(password);
  const [user] = await db.insert(usersTable)
    .values({ email: email.toLowerCase(), name, passwordHash })
    .returning();
  if (!user) { res.status(500).json({ error: "Failed to create account" }); return; }

  const usernameBase = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "trader";
  const generatedUsername = `${usernameBase}${user.id}`;
  await db.update(usersTable).set({ username: generatedUsername }).where(eq(usersTable.id, user.id));

  // Store security questions if provided
  if (useSecurityQuestions && securityQuestions) {
    const [answerHash1, answerHash2, answerHash3] = await Promise.all([
      hashAnswer(securityQuestions[0].answer),
      hashAnswer(securityQuestions[1].answer),
      hashAnswer(securityQuestions[2].answer),
    ]);
    await db.insert(securityQuestionsTable).values({
      userId: user.id,
      question1: securityQuestions[0].question,
      answerHash1,
      question2: securityQuestions[1].question,
      answerHash2,
      question3: securityQuestions[2].question,
      answerHash3,
    });
  }

  // Generate and store 6 backup codes
  const plainCodes = generateSixBackupCodes();
  const codeHashes = await Promise.all(
    plainCodes.map(code => createPasswordHash(code.replace("-", "")))
  );
  await db.insert(backupCodesTable).values(
    codeHashes.map((codeHash) => ({ userId: user.id, codeHash }))
  );

  const token = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, banned: user.banned },
    token,
    backupCodes: plainCodes,
  });
});

// ── Get security questions for an email ──────────────────────────────────────
router.post("/auth/security-questions", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" }); return;
  }
  const [user] = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.json({ questions: ["", "", ""], hasWebauthn: false }); return;
  }
  const [sq] = await db.select()
    .from(securityQuestionsTable)
    .where(eq(securityQuestionsTable.userId, user.id));
  const webauthnCreds = await db.select({ id: webauthnCredentialsTable.id })
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, user.id))
    .limit(1);
  if (!sq) {
    res.json({ questions: ["", "", ""], hasWebauthn: webauthnCreds.length > 0 }); return;
  }
  res.json({
    questions: [sq.question1, sq.question2, sq.question3],
    hasWebauthn: webauthnCreds.length > 0,
  });
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
  const [ok1, ok2, ok3] = await Promise.all([
    verifyAnswer(answers[0], sq.answerHash1),
    verifyAnswer(answers[1], sq.answerHash2),
    verifyAnswer(answers[2], sq.answerHash3),
  ]);
  const ok = ok1 && ok2 && ok3;
  if (!ok) {
    await recordAuthFailure(getAuthIp(req));
    res.status(400).json({ error: "Incorrect answers. Please try again." }); return;
  }
  await db.update(passwordResetsTable)
    .set({ usedAt: new Date() })
    .where(drizzleAnd(eq(passwordResetsTable.userId, user.id), isNull(passwordResetsTable.usedAt)));
  const resetToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.insert(passwordResetsTable).values({ userId: user.id, token: resetToken, expiresAt });
  res.json({ resetToken });
});

// ── Reset password ────────────────────────────────────────────────────────────
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
  const passwordHash = await createPasswordHash(password);
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
    const verifyResults = await Promise.all(codes.map(c => verifyPassword(normalised, c.codeHash)));
    const matched = codes[verifyResults.findIndex(v => v)];
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
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    await recordAuthFailure(ip);
    res.status(401).json({ error: "Invalid email or password" }); return;
  }
  if (user.banned) {
    res.status(403).json({ error: `Your account has been suspended${user.bannedReason ? `: ${user.bannedReason}` : ""}` }); return;
  }
  const token = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ user: { id: user.id, email: user.email, name: user.name, banned: user.banned }, token });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WebAuthn / Biometric endpoints
// ═══════════════════════════════════════════════════════════════════════════════

// ── Generate registration challenge ──────────────────────────────────────────
router.post("/auth/webauthn/register-challenge", async (req, res): Promise<void> => {
  const { userId, email, name } = req.body as { userId: number; email: string; name: string };
  if (!userId || !email) {
    res.status(400).json({ error: "userId and email are required" }); return;
  }
  pruneExpiredChallenges();
  const { rpId } = getOriginAndRpId(req);

  // Get existing credentials to exclude
  const existing = await db.select({ credentialId: webauthnCredentialsTable.credentialId })
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, userId));

  const options = await generateRegistrationOptions({
    rpName: "Trade Lab",
    rpID: rpId,
    userName: email,
    userID: new TextEncoder().encode(userId.toString()),
    userDisplayName: name ?? email,
    timeout: 60000,
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "preferred",
      residentKey: "discouraged",
    },
    excludeCredentials: existing.map(c => ({ id: c.credentialId })),
    supportedAlgorithmIDs: [-7, -257],
  });

  const challengeId = randomBytes(16).toString("hex");
  challengeStore.set(challengeId, {
    challenge: options.challenge,
    userId,
    expiresAt: Date.now() + 5 * 60_000,
  });

  res.json({ challengeId, options });
});

// ── Verify registration response and store credential ─────────────────────────
router.post("/auth/webauthn/register-verify", async (req, res): Promise<void> => {
  const { challengeId, credential } = req.body;
  if (!challengeId || !credential) {
    res.status(400).json({ error: "challengeId and credential are required" }); return;
  }
  const entry = challengeStore.get(challengeId);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(400).json({ error: "Challenge expired or invalid" }); return;
  }
  challengeStore.delete(challengeId);

  const { origin, rpId } = getOriginAndRpId(req);
  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: entry.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Biometric registration failed" }); return;
    }

    const { credential: cred } = verification.registrationInfo;
    const credentialId = Buffer.from(cred.id).toString("base64url");
    const publicKey = Buffer.from(cred.publicKey).toString("base64url");
    const transports = credential.response?.transports ?? [];

    // Remove any existing credentials for this user (one per user)
    if (entry.userId) {
      await db.delete(webauthnCredentialsTable)
        .where(eq(webauthnCredentialsTable.userId, entry.userId));
      await db.insert(webauthnCredentialsTable).values({
        userId: entry.userId,
        credentialId,
        publicKey,
        counter: cred.counter,
        transports: JSON.stringify(transports),
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Biometric verification failed" }); return;
  }
});

// ── Generate authentication challenge (for password recovery) ─────────────────
router.post("/auth/webauthn/auth-challenge", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" }); return;
  }
  pruneExpiredChallenges();

  const [user] = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    // Don't reveal if user exists
    res.json({ hasCredential: false }); return;
  }

  const credentials = await db.select()
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, user.id));

  if (credentials.length === 0) {
    res.json({ hasCredential: false }); return;
  }

  const { rpId } = getOriginAndRpId(req);
  const options = await generateAuthenticationOptions({
    rpID: rpId,
    timeout: 60000,
    allowCredentials: credentials.map(c => ({
      id: c.credentialId,
      transports: c.transports ? (JSON.parse(c.transports) as string[]) : [],
    })),
    userVerification: "preferred",
  });

  const challengeId = randomBytes(16).toString("hex");
  challengeStore.set(challengeId, {
    challenge: options.challenge,
    userId: user.id,
    email: email.toLowerCase(),
    expiresAt: Date.now() + 5 * 60_000,
  });

  res.json({ hasCredential: true, challengeId, options });
});

// ── Verify authentication assertion → issue reset token ───────────────────────
router.post("/auth/webauthn/auth-verify", async (req, res): Promise<void> => {
  if (!await checkAuthRateLimit(getAuthIp(req))) {
    res.status(429).json({ error: "Too many requests. Please try again later." }); return;
  }
  const { challengeId, credential } = req.body;
  if (!challengeId || !credential) {
    res.status(400).json({ error: "challengeId and credential are required" }); return;
  }
  const entry = challengeStore.get(challengeId);
  if (!entry || entry.expiresAt < Date.now() || !entry.userId) {
    res.status(400).json({ error: "Challenge expired or invalid" }); return;
  }
  challengeStore.delete(challengeId);

  const { origin, rpId } = getOriginAndRpId(req);
  const credentialId = credential.id as string;

  const [storedCred] = await db.select()
    .from(webauthnCredentialsTable)
    .where(drizzleAnd(
      eq(webauthnCredentialsTable.userId, entry.userId),
      eq(webauthnCredentialsTable.credentialId, credentialId),
    ))
    .limit(1);

  if (!storedCred) {
    await recordAuthFailure(getAuthIp(req));
    res.status(400).json({ error: "Unknown biometric credential" }); return;
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: entry.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: storedCred.credentialId,
        publicKey: Buffer.from(storedCred.publicKey, "base64url"),
        counter: storedCred.counter,
        transports: storedCred.transports
          ? (JSON.parse(storedCred.transports) as ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[])
          : [],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      await recordAuthFailure(getAuthIp(req));
      res.status(400).json({ error: "Biometric verification failed" }); return;
    }

    // Update counter
    await db.update(webauthnCredentialsTable)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(webauthnCredentialsTable.id, storedCred.id));

    // Issue password reset token
    await db.update(passwordResetsTable)
      .set({ usedAt: new Date() })
      .where(drizzleAnd(eq(passwordResetsTable.userId, entry.userId), isNull(passwordResetsTable.usedAt)));
    const resetToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await db.insert(passwordResetsTable).values({ userId: entry.userId, token: resetToken, expiresAt });

    res.json({ resetToken });
  } catch {
    await recordAuthFailure(getAuthIp(req));
    res.status(400).json({ error: "Biometric verification failed" }); return;
  }
});

export default router;
