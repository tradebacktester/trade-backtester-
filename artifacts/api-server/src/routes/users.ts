import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, backtestsTable, strategiesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { verifyJwt } from "../lib/jwt";

const router: IRouter = Router();

const JWT_SECRET = process.env["JWT_SECRET"];

function extractUserId(req: Request): number | null {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyJwt(auth.slice(7), JWT_SECRET ?? "");
  return payload && typeof (payload as any).id === "number" ? (payload as any).id : null;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const uid = extractUserId(req);
  if (!uid) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = uid;
  next();
}

// GET /users/:id — public profile (name, joined date, backtest/strategy counts)
router.get("/users/:id", async (req, res): Promise<void> => {
  const userId = parseInt(req.params["id"] as string, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt, banned: usersTable.banned })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.banned) { res.status(404).json({ error: "User not found" }); return; }

  const [btStats] = await db
    .select({ total: count() })
    .from(backtestsTable)
    .where(eq(backtestsTable.userId, userId));

  const [stStats] = await db
    .select({ total: count() })
    .from(strategiesTable)
    .where(eq(strategiesTable.userId, userId));

  // Determine caller's userId (optional auth — show extra info if viewing own profile)
  let viewerUserId: number | null = null;
  try {
    const auth = req.headers["authorization"];
    if (auth && JWT_SECRET) {
      const payload = verifyJwt(auth.replace("Bearer ", "").trim(), JWT_SECRET);
      if (payload && typeof (payload as any).id === "number") viewerUserId = (payload as any).id;
    }
  } catch { /* ignore */ }

  res.json({
    id: user.id,
    name: user.name,
    joinedAt: user.createdAt.toISOString(),
    totalBacktests: Number(btStats?.total ?? 0),
    totalStrategies: Number(stStats?.total ?? 0),
    isOwnProfile: viewerUserId === user.id,
  });
});

// PATCH /users/me — update the current user's display name
router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { name } = req.body as { name?: string };

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const trimmed = name.trim();
  if (trimmed.length < 2) {
    res.status(400).json({ error: "Name must be at least 2 characters" });
    return;
  }
  if (trimmed.length > 60) {
    res.status(400).json({ error: "Name must be at most 60 characters" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ name: trimmed })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ id: updated.id, name: updated.name, email: updated.email });
});

// GET /users/me — return the current user's own profile
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [btStats] = await db.select({ total: count() }).from(backtestsTable).where(eq(backtestsTable.userId, userId));
  const [stStats] = await db.select({ total: count() }).from(strategiesTable).where(eq(strategiesTable.userId, userId));

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    joinedAt: user.createdAt.toISOString(),
    totalBacktests: Number(btStats?.total ?? 0),
    totalStrategies: Number(stStats?.total ?? 0),
  });
});

export default router;
