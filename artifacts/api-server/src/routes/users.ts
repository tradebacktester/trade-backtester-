import { Router, type IRouter } from "express";
import { db, usersTable, backtestsTable, strategiesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { verifyJwt } from "../lib/jwt";

const router: IRouter = Router();

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
    if (auth && process.env.JWT_SECRET) {
      const payload = verifyJwt(auth.replace("Bearer ", "").trim(), process.env.JWT_SECRET);
      if (payload && typeof payload.id === "number") viewerUserId = payload.id;
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

export default router;
