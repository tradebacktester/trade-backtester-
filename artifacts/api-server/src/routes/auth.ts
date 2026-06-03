import { Router, type IRouter } from "express";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signJwt } from "../lib/jwt";

const JWT_SECRET = process.env.JWT_SECRET!;

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
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || !verifyPassword(password, user.passwordHash)) {
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
