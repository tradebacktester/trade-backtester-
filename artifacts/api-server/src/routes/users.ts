import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, backtestsTable, strategiesTable, userFollowsTable } from "@workspace/db";
import { eq, count, avg, ilike, or, and, sql } from "drizzle-orm";
import { verifyJwt } from "../lib/jwt";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"];

function extractUserId(req: Request): number | null {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyJwt(auth.slice(7), JWT_SECRET ?? "");
  return payload && typeof (payload as { id?: unknown }).id === "number"
    ? (payload as { id: number }).id
    : null;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const uid = extractUserId(req);
  if (!uid) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = uid;
  next();
}

export function generateUsername(name: string, id: number): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "trader";
  return `${base}${id}`;
}

async function buildPublicProfile(
  user: typeof usersTable.$inferSelect,
  viewerId: number | null,
) {
  const [btStats] = await db.select({ total: count() }).from(backtestsTable)
    .where(eq(backtestsTable.userId, user.id));
  const [stStats] = await db.select({ total: count() }).from(strategiesTable)
    .where(eq(strategiesTable.userId, user.id));
  const [perfStats] = await db.select({
    avgWinRate: avg(backtestsTable.winRate),
    avgReturn: avg(backtestsTable.totalReturn),
  }).from(backtestsTable)
    .where(and(eq(backtestsTable.userId, user.id), eq(backtestsTable.status, "complete")));
  const [followersRow] = await db.select({ cnt: count() }).from(userFollowsTable)
    .where(eq(userFollowsTable.followingId, user.id));
  const [followingRow] = await db.select({ cnt: count() }).from(userFollowsTable)
    .where(eq(userFollowsTable.followerId, user.id));

  let isFollowing = false;
  if (viewerId && viewerId !== user.id) {
    const [row] = await db.select({ id: userFollowsTable.id }).from(userFollowsTable)
      .where(and(
        eq(userFollowsTable.followerId, viewerId),
        eq(userFollowsTable.followingId, user.id),
      ));
    isFollowing = !!row;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username ?? null,
    bio: user.bio ?? null,
    tradingStyle: user.tradingStyle ?? null,
    joinedAt: user.createdAt.toISOString(),
    totalBacktests: Number(btStats?.total ?? 0),
    totalStrategies: Number(stStats?.total ?? 0),
    followerCount: Number(followersRow?.cnt ?? 0),
    followingCount: Number(followingRow?.cnt ?? 0),
    avgWinRate: perfStats?.avgWinRate != null ? Number(perfStats.avgWinRate) : null,
    avgReturn: perfStats?.avgReturn != null ? Number(perfStats.avgReturn) : null,
    isOwnProfile: viewerId === user.id,
    isFollowing,
  };
}

// ── GET /users/me ─────────────────────────────────────────────────────────────
// Must be declared BEFORE /users/:id so "me" isn't treated as an ID
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!user.username) {
    const generated = generateUsername(user.name, user.id);
    await db.update(usersTable).set({ username: generated }).where(eq(usersTable.id, userId));
    user.username = generated;
  }

  const [btStats] = await db.select({ total: count() }).from(backtestsTable).where(eq(backtestsTable.userId, userId));
  const [stStats] = await db.select({ total: count() }).from(strategiesTable).where(eq(strategiesTable.userId, userId));
  const [followersRow] = await db.select({ cnt: count() }).from(userFollowsTable).where(eq(userFollowsTable.followingId, userId));
  const [followingRow] = await db.select({ cnt: count() }).from(userFollowsTable).where(eq(userFollowsTable.followerId, userId));

  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio ?? null,
    tradingStyle: user.tradingStyle ?? null,
    email: user.email,
    joinedAt: user.createdAt.toISOString(),
    totalBacktests: Number(btStats?.total ?? 0),
    totalStrategies: Number(stStats?.total ?? 0),
    followerCount: Number(followersRow?.cnt ?? 0),
    followingCount: Number(followingRow?.cnt ?? 0),
    isOwnProfile: true,
  });
});

// ── GET /users/search?q= ──────────────────────────────────────────────────────
// Partial ILIKE search on name + username — powers DM search and People discovery
router.get("/users/search", async (req, res): Promise<void> => {
  const q = ((req.query["q"] as string) ?? "").trim();
  if (q.length < 1) { res.json([]); return; }

  const viewerId = extractUserId(req);

  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      bio: usersTable.bio,
      tradingStyle: usersTable.tradingStyle,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.banned, false),
        or(
          ilike(usersTable.name, `%${q}%`),
          ilike(usersTable.username, `%${q}%`),
        ),
      ),
    )
    .limit(20);

  if (users.length === 0) { res.json([]); return; }

  const ids = users.map(u => u.id);

  const followerCounts = await db
    .select({ followingId: userFollowsTable.followingId, cnt: count() })
    .from(userFollowsTable)
    .where(sql`${userFollowsTable.followingId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[])`)
    .groupBy(userFollowsTable.followingId);

  const followerMap = new Map(followerCounts.map(r => [r.followingId, Number(r.cnt)]));

  let viewerFollowing = new Set<number>();
  if (viewerId) {
    const following = await db
      .select({ followingId: userFollowsTable.followingId })
      .from(userFollowsTable)
      .where(eq(userFollowsTable.followerId, viewerId));
    viewerFollowing = new Set(following.map(r => r.followingId));
  }

  res.json(
    users
      .filter(u => u.id !== viewerId)
      .map(u => ({
        id: u.id,
        name: u.name,
        username: u.username ?? null,
        bio: u.bio ?? null,
        tradingStyle: u.tradingStyle ?? null,
        followerCount: followerMap.get(u.id) ?? 0,
        isFollowing: viewerFollowing.has(u.id),
      })),
  );
});

// ── GET /users/by-username/:username ──────────────────────────────────────────
// Profile lookup by username slug (for /u/:username route)
router.get("/users/by-username/:username", async (req, res): Promise<void> => {
  const username = (req.params["username"] as string ?? "").toLowerCase().trim();
  if (!username) { res.status(400).json({ error: "Username required" }); return; }

  const [user] = await db.select().from(usersTable)
    .where(and(eq(usersTable.username, username), eq(usersTable.banned, false)));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const viewerId = extractUserId(req);
  res.json(await buildPublicProfile(user, viewerId));
});

// ── GET /users/:id/followers ──────────────────────────────────────────────────
router.get("/users/:id/followers", async (req, res): Promise<void> => {
  const userId = parseInt(req.params["id"] as string, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select({ id: usersTable.id, name: usersTable.name, username: usersTable.username })
    .from(userFollowsTable)
    .innerJoin(usersTable, eq(userFollowsTable.followerId, usersTable.id))
    .where(and(eq(userFollowsTable.followingId, userId), eq(usersTable.banned, false)))
    .limit(100);

  res.json(rows);
});

// ── GET /users/:id/following ──────────────────────────────────────────────────
router.get("/users/:id/following", async (req, res): Promise<void> => {
  const userId = parseInt(req.params["id"] as string, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select({ id: usersTable.id, name: usersTable.name, username: usersTable.username })
    .from(userFollowsTable)
    .innerJoin(usersTable, eq(userFollowsTable.followingId, usersTable.id))
    .where(and(eq(userFollowsTable.followerId, userId), eq(usersTable.banned, false)))
    .limit(100);

  res.json(rows);
});

// ── GET /users/:id ────────────────────────────────────────────────────────────
router.get("/users/:id", async (req, res): Promise<void> => {
  const userId = parseInt(req.params["id"] as string, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const [user] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.banned, false)));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!user.username) {
    const generated = generateUsername(user.name, user.id);
    await db.update(usersTable).set({ username: generated }).where(eq(usersTable.id, userId));
    user.username = generated;
  }

  const viewerId = extractUserId(req);
  res.json(await buildPublicProfile(user, viewerId));
});

// ── POST /users/:id/follow ────────────────────────────────────────────────────
router.post("/users/:id/follow", requireAuth, async (req, res): Promise<void> => {
  const viewerId = res.locals["userId"] as number;
  const targetId = parseInt(req.params["id"] as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (targetId === viewerId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }

  const [target] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, targetId), eq(usersTable.banned, false)));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(userFollowsTable)
    .values({ followerId: viewerId, followingId: targetId })
    .onConflictDoNothing();

  res.json({ following: true });
});

// ── DELETE /users/:id/follow ──────────────────────────────────────────────────
router.delete("/users/:id/follow", requireAuth, async (req, res): Promise<void> => {
  const viewerId = res.locals["userId"] as number;
  const targetId = parseInt(req.params["id"] as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(userFollowsTable)
    .where(and(
      eq(userFollowsTable.followerId, viewerId),
      eq(userFollowsTable.followingId, targetId),
    ));

  res.json({ following: false });
});

// ── PATCH /users/me ───────────────────────────────────────────────────────────
router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { name, username, bio, tradingStyle } = req.body as {
    name?: string;
    username?: string;
    bio?: string;
    tradingStyle?: string;
  };

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    const t = name.trim();
    if (t.length < 2) { res.status(400).json({ error: "Name must be at least 2 characters" }); return; }
    if (t.length > 60) { res.status(400).json({ error: "Name must be at most 60 characters" }); return; }
    updates["name"] = t;
  }

  if (username !== undefined) {
    const t = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (t.length < 2) { res.status(400).json({ error: "Username must be at least 2 characters" }); return; }
    if (t.length > 30) { res.status(400).json({ error: "Username must be at most 30 characters" }); return; }
    const [conflict] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.username, t), sql`${usersTable.id} != ${userId}`));
    if (conflict) { res.status(409).json({ error: "Username is already taken" }); return; }
    updates["username"] = t;
  }

  if (bio !== undefined) updates["bio"] = bio.trim().slice(0, 300) || null;
  if (tradingStyle !== undefined) updates["tradingStyle"] = tradingStyle.trim().slice(0, 60) || null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" }); return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates as Partial<typeof usersTable.$inferInsert>)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    id: updated.id,
    name: updated.name,
    username: updated.username ?? null,
    bio: updated.bio ?? null,
    tradingStyle: updated.tradingStyle ?? null,
    email: updated.email,
  });
});

export default router;
