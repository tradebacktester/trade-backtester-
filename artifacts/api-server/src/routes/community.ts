import { Router, type IRouter } from "express";
import { db, communityPostsTable, communityPostLikesTable, communityReportsTable, communityMessagesTable, directMessagesTable, subscriptionsTable, subscriptionPlansTable, usersTable, backtestsTable, strategiesTable } from "@workspace/db";
import { eq, desc, and, gt, or, sql, isNull, inArray } from "drizzle-orm";
import { verifyJwt } from "../lib/jwt";
import { verifyAdminToken } from "../lib/admin-auth";

const router: IRouter = Router();

// ── HTML sanitization ────────────────────────────────────────────────────────
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

// ── Profanity filter ────────────────────────────────────────────────────────
const BANNED_WORDS = [
  "fuck", "shit", "ass", "bitch", "bastard", "cunt", "dick", "pussy",
  "cock", "whore", "slut", "nigger", "faggot", "retard", "idiot",
  "moron", "kill", "die", "rape", "murder", "suicide", "terrorist",
  "nazi", "hitler", "racist", "porn", "sex", "nude", "naked",
];

function containsBannedWords(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

type BacktestSummary = {
  id: number;
  symbol: string;
  strategyName: string;
  totalReturn: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  totalTrades: number | null;
};

function serializePost(
  p: typeof communityPostsTable.$inferSelect,
  replyCount = 0,
  backtestSummary: BacktestSummary | null = null,
) {
  return {
    id: p.id,
    userId: p.userId,
    authorName: p.authorName,
    content: p.content,
    imageUrl: p.imageUrl,
    likes: p.likes,
    parentId: p.parentId ?? null,
    backtestId: p.backtestId ?? null,
    backtestSummary,
    replyCount,
    createdAt: p.createdAt.toISOString(),
  };
}

// ── Public routes ───────────────────────────────────────────────────────────

// GET /community — list top-level posts with reply counts and backtest previews
router.get("/community", async (req, res): Promise<void> => {
  const PAGE_SIZE = 20;
  const limit = Math.min(Math.max(parseInt(String(req.query["limit"] ?? PAGE_SIZE), 10) || PAGE_SIZE, 1), 50);
  const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"), 10) || 0, 0);

  const posts = await db
    .select()
    .from(communityPostsTable)
    .where(and(eq(communityPostsTable.isDeleted, false), isNull(communityPostsTable.parentId)))
    .orderBy(desc(communityPostsTable.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = posts.length > limit;
  const pagePosts = posts.slice(0, limit);
  const postIds = pagePosts.map(p => p.id);

  const replyCountMap = new Map<number, number>();
  if (postIds.length > 0) {
    const counts = await db
      .select({ parentId: communityPostsTable.parentId, cnt: sql<number>`cast(count(*) as int)` })
      .from(communityPostsTable)
      .where(and(eq(communityPostsTable.isDeleted, false), inArray(communityPostsTable.parentId, postIds)))
      .groupBy(communityPostsTable.parentId);
    for (const row of counts) { if (row.parentId) replyCountMap.set(row.parentId, row.cnt); }
  }

  const backtestSummaryMap = new Map<number, BacktestSummary>();
  const btIds = pagePosts.filter(p => p.backtestId).map(p => p.backtestId!);
  if (btIds.length > 0) {
    const btRows = await db
      .select({
        id: backtestsTable.id, symbol: backtestsTable.symbol,
        strategyName: strategiesTable.name,
        totalReturn: backtestsTable.totalReturn, sharpeRatio: backtestsTable.sharpeRatio,
        maxDrawdown: backtestsTable.maxDrawdown, winRate: backtestsTable.winRate,
        totalTrades: backtestsTable.totalTrades,
      })
      .from(backtestsTable)
      .leftJoin(strategiesTable, eq(backtestsTable.strategyId, strategiesTable.id))
      .where(inArray(backtestsTable.id, btIds));
    for (const r of btRows) {
      backtestSummaryMap.set(r.id, {
        id: r.id, symbol: r.symbol, strategyName: r.strategyName ?? "Unknown Strategy",
        totalReturn: r.totalReturn ? Number(r.totalReturn) : null,
        sharpeRatio: r.sharpeRatio ? Number(r.sharpeRatio) : null,
        maxDrawdown: r.maxDrawdown ? Number(r.maxDrawdown) : null,
        winRate: r.winRate ? Number(r.winRate) : null,
        totalTrades: r.totalTrades,
      });
    }
  }

  res.json({
    posts: pagePosts.map(p => serializePost(
      p,
      replyCountMap.get(p.id) ?? 0,
      p.backtestId ? (backtestSummaryMap.get(p.backtestId) ?? null) : null,
    )),
    hasMore, offset, limit,
  });
});

// GET /community/:id/replies — fetch replies for a post
router.get("/community/:id/replies", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const replies = await db.select().from(communityPostsTable)
    .where(and(eq(communityPostsTable.isDeleted, false), eq(communityPostsTable.parentId, id)))
    .orderBy(communityPostsTable.createdAt)
    .limit(50);

  res.json({ replies: replies.map(r => serializePost(r)) });
});

// POST /community — create a post (authentication required)
router.post("/community", async (req, res): Promise<void> => {
  // CRIT-008: Require auth — prevents authorName spoofing and fully anonymous spam
  const authHeader = req.headers["authorization"];
  if (!authHeader || !process.env.JWT_SECRET) {
    res.status(401).json({ error: "You must be signed in to post." });
    return;
  }
  const authToken = authHeader.replace("Bearer ", "").trim();
  const payload = verifyJwt(authToken, process.env.JWT_SECRET);
  if (!payload || typeof payload.id !== "number") {
    res.status(401).json({ error: "You must be signed in to post." });
    return;
  }
  const userId: number = payload.id;

  // CRIT-008: Derive authorName server-side from verified identity — never trust client
  const rawName = typeof payload.email === "string"
    ? payload.email.split("@")[0]!.replace(/[.+_-]+/g, " ").trim()
    : "";
  const authorName = rawName.length >= 2 ? rawName : "User";

  // DB-based per-user rate limit: max 5 posts per minute
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const [{ recentCount }] = await db
    .select({ recentCount: sql<number>`cast(count(*) as int)` })
    .from(communityPostsTable)
    .where(
      and(
        eq(communityPostsTable.userId, userId),
        gt(communityPostsTable.createdAt, oneMinuteAgo),
      ),
    );
  if (recentCount >= 5) {
    res.status(429).json({ error: "Too many posts. Please wait before posting again." });
    return;
  }

  const { content, imageUrl, parentId: rawParentId, backtestId: rawBacktestId } = req.body as {
    content?: string;
    imageUrl?: string;
    parentId?: number;
    backtestId?: number;
  };

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "Post content must be at least 3 characters." });
    return;
  }
  const sanitized = stripHtml(content).trim();
  if (sanitized.length < 3) {
    res.status(400).json({ error: "Post content must be at least 3 characters." });
    return;
  }
  if (sanitized.length > 1200) {
    res.status(400).json({ error: "Post content must be under 1200 characters." });
    return;
  }

  const badWord = containsBannedWords(sanitized);
  if (badWord) {
    res.status(400).json({ error: "Your post contains language that is not allowed on this platform." });
    return;
  }

  if (imageUrl && typeof imageUrl === "string") {
    if (imageUrl.startsWith("data:image/")) {
      // base64 image — enforce a ~4 MB size limit
      if (imageUrl.length > 5_500_000) {
        res.status(400).json({ error: "Image must be under 4 MB." });
        return;
      }
    } else {
      try {
        const u = new URL(imageUrl);
        if (!["http:", "https:"].includes(u.protocol)) {
          res.status(400).json({ error: "Image URL must start with http or https." });
          return;
        }
      } catch {
        res.status(400).json({ error: "Invalid image." });
        return;
      }
    }
  }

  let resolvedParentId: number | null = null;
  if (rawParentId && typeof rawParentId === "number") {
    const [parentPost] = await db
      .select({ id: communityPostsTable.id, parentId: communityPostsTable.parentId })
      .from(communityPostsTable)
      .where(and(eq(communityPostsTable.id, rawParentId), eq(communityPostsTable.isDeleted, false)));
    if (!parentPost) { res.status(404).json({ error: "Parent post not found." }); return; }
    if (parentPost.parentId) { res.status(400).json({ error: "Cannot reply to a reply." }); return; }
    resolvedParentId = parentPost.id;
  }

  let resolvedBacktestId: number | null = null;
  let backtestSummary: BacktestSummary | null = null;
  if (rawBacktestId && typeof rawBacktestId === "number") {
    const [btRow] = await db
      .select({
        id: backtestsTable.id, symbol: backtestsTable.symbol, strategyName: strategiesTable.name,
        totalReturn: backtestsTable.totalReturn, sharpeRatio: backtestsTable.sharpeRatio,
        maxDrawdown: backtestsTable.maxDrawdown, winRate: backtestsTable.winRate,
        totalTrades: backtestsTable.totalTrades,
      })
      .from(backtestsTable)
      .leftJoin(strategiesTable, eq(backtestsTable.strategyId, strategiesTable.id))
      .where(and(eq(backtestsTable.id, rawBacktestId), eq(backtestsTable.userId, userId)));
    if (!btRow) { res.status(404).json({ error: "Backtest not found or not yours." }); return; }
    resolvedBacktestId = btRow.id;
    backtestSummary = {
      id: btRow.id, symbol: btRow.symbol, strategyName: btRow.strategyName ?? "Unknown Strategy",
      totalReturn: btRow.totalReturn ? Number(btRow.totalReturn) : null,
      sharpeRatio: btRow.sharpeRatio ? Number(btRow.sharpeRatio) : null,
      maxDrawdown: btRow.maxDrawdown ? Number(btRow.maxDrawdown) : null,
      winRate: btRow.winRate ? Number(btRow.winRate) : null,
      totalTrades: btRow.totalTrades,
    };
  }

  const [post] = await db.insert(communityPostsTable).values({
    userId: userId ?? null,
    parentId: resolvedParentId,
    backtestId: resolvedBacktestId,
    authorName: authorName.trim(),
    content: sanitized,
    imageUrl: imageUrl?.trim() || null,
  }).returning();

  res.status(201).json(serializePost(post!, 0, backtestSummary));
});

// POST /community/:id/like — toggle like with per-user deduplication (CRIT-001)
router.post("/community/:id/like", async (req, res): Promise<void> => {
  const likeAuth = req.headers["authorization"];
  if (!likeAuth || !process.env.JWT_SECRET) {
    res.status(401).json({ error: "You must be signed in to like posts." });
    return;
  }
  const likePayload = verifyJwt(likeAuth.replace("Bearer ", "").trim(), process.env.JWT_SECRET);
  if (!likePayload || typeof likePayload.id !== "number") {
    res.status(401).json({ error: "You must be signed in to like posts." });
    return;
  }
  const likerId = likePayload.id;

  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [post] = await db.select().from(communityPostsTable)
    .where(and(eq(communityPostsTable.id, id), eq(communityPostsTable.isDeleted, false)));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const action = (req.body as { action?: "like" | "unlike" } | undefined)?.action;

  if (action === "unlike") {
    // Remove the like record and atomically decrement the count
    const deleted = await db.delete(communityPostLikesTable)
      .where(and(eq(communityPostLikesTable.postId, id), eq(communityPostLikesTable.userId, likerId)))
      .returning();
    if (deleted.length > 0) {
      await db.update(communityPostsTable)
        .set({ likes: sql`GREATEST(0, ${communityPostsTable.likes} - 1)` })
        .where(eq(communityPostsTable.id, id));
    }
  } else {
    // Insert like record — ON CONFLICT DO NOTHING prevents duplicate likes
    const inserted = await db.insert(communityPostLikesTable)
      .values({ postId: id, userId: likerId })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) {
      // Only increment if this was a new like
      await db.update(communityPostsTable)
        .set({ likes: sql`${communityPostsTable.likes} + 1` })
        .where(eq(communityPostsTable.id, id));
    }
  }

  const [updated] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, id));
  res.json(serializePost(updated!));
});

// POST /community/:id/report — report a post (authentication required)
router.post("/community/:id/report", async (req, res): Promise<void> => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !process.env.JWT_SECRET) {
    res.status(401).json({ error: "You must be signed in to report posts." });
    return;
  }
  const authToken = authHeader.replace("Bearer ", "").trim();
  const payload = verifyJwt(authToken, process.env.JWT_SECRET);
  if (!payload || typeof payload.id !== "number") {
    res.status(401).json({ error: "You must be signed in to report posts." });
    return;
  }
  const reporterName = typeof payload.email === "string"
    ? payload.email.split("@")[0]!.replace(/[.+_-]+/g, " ").trim() || "User"
    : "User";

  const postId = parseInt(req.params["id"] as string, 10);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { reason } = req.body as { reason?: string };
  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ error: "Please provide a reason (at least 5 characters)." });
    return;
  }

  const [post] = await db.select().from(communityPostsTable)
    .where(and(eq(communityPostsTable.id, postId), eq(communityPostsTable.isDeleted, false)));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const [report] = await db.insert(communityReportsTable).values({
    postId,
    reporterName,
    reason: reason.trim(),
    status: "pending",
  }).returning();

  res.status(201).json({ id: report!.id, status: "pending", message: "Report submitted. Our admin will review it shortly." });
});

// ── Admin routes ────────────────────────────────────────────────────────────

// DELETE /community/:id — admin OR post author can delete
router.delete("/community/:id", async (req, res): Promise<void> => {
  const adminToken = req.headers["x-admin-token"] as string | undefined;
  const isAdmin = Boolean(adminToken && verifyAdminToken(adminToken));

  let requestingUserId: number | null = null;
  if (!isAdmin) {
    const authHeader = req.headers["authorization"];
    if (authHeader && process.env.JWT_SECRET) {
      const payload = verifyJwt(authHeader.replace("Bearer ", "").trim(), process.env.JWT_SECRET);
      if (payload && typeof payload.id === "number") requestingUserId = payload.id;
    }
    if (!requestingUserId) {
      res.status(401).json({ error: "Unauthorized" }); return;
    }
  }

  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [post] = await db.select().from(communityPostsTable)
    .where(and(eq(communityPostsTable.id, id), eq(communityPostsTable.isDeleted, false)));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  if (!isAdmin && post.userId !== requestingUserId) {
    res.status(403).json({ error: "You can only delete your own posts." }); return;
  }

  const [updated] = await db.update(communityPostsTable)
    .set({ isDeleted: true, ...(isAdmin ? { deletedByAdmin: true } : {}) })
    .where(eq(communityPostsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Post not found" }); return; }

  res.json({ id: updated.id, deleted: true });
});

// GET /admin/community/reports — list all reports
router.get("/admin/community/reports", async (req, res): Promise<void> => {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  const reports = await db.select().from(communityReportsTable)
    .orderBy(desc(communityReportsTable.createdAt));

  const postIds = [...new Set(reports.map(r => r.postId))];
  let postsMap: Record<number, typeof communityPostsTable.$inferSelect> = {};
  if (postIds.length > 0) {
    const posts = await db.select().from(communityPostsTable);
    postsMap = Object.fromEntries(posts.map(p => [p.id, p]));
  }

  res.json(reports.map(r => ({
    id: r.id,
    postId: r.postId,
    postContent: postsMap[r.postId]?.content ?? "[deleted]",
    postAuthor: postsMap[r.postId]?.authorName ?? "—",
    postDeleted: postsMap[r.postId]?.isDeleted ?? true,
    reporterName: r.reporterName,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  })));
});

// PATCH /admin/community/reports/:id — resolve/dismiss report
router.patch("/admin/community/reports/:id", async (req, res): Promise<void> => {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const id = parseInt(req.params["id"] as string, 10);
  const { status } = req.body as { status?: string };
  if (!status || !["pending", "resolved", "dismissed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }

  const [updated] = await db.update(communityReportsTable)
    .set({ status })
    .where(eq(communityReportsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Report not found" }); return; }

  res.json({ id: updated.id, status: updated.status });
});

// ── Chat routes ─────────────────────────────────────────────────────────────

// GET /community/chat — fetch messages (optionally since a timestamp)
router.get("/community/chat", async (req, res): Promise<void> => {
  const since = req.query["since"] as string | undefined;
  const limit = 100;

  let msgs;
  if (since) {
    const sinceDate = new Date(since);
    msgs = await db
      .select()
      .from(communityMessagesTable)
      .where(and(eq(communityMessagesTable.isDeleted, false), gt(communityMessagesTable.createdAt, sinceDate)))
      .orderBy(desc(communityMessagesTable.createdAt))
      .limit(limit);
    msgs = msgs.reverse();
  } else {
    msgs = await db
      .select()
      .from(communityMessagesTable)
      .where(eq(communityMessagesTable.isDeleted, false))
      .orderBy(desc(communityMessagesTable.createdAt))
      .limit(limit);
    msgs = msgs.reverse();
  }

  // Build "online" set: authors who posted a message in the last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
  const recentAuthors = await db
    .select({ authorName: communityMessagesTable.authorName })
    .from(communityMessagesTable)
    .where(and(eq(communityMessagesTable.isDeleted, false), gt(communityMessagesTable.createdAt, fiveMinAgo)));
  const onlineNames = [...new Set(recentAuthors.map(r => r.authorName))];

  res.json({
    messages: msgs.map(m => ({
      id: m.id,
      userId: m.userId,
      authorName: m.authorName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    onlineNames,
  });
});

// POST /community/chat — send a message (auth required)
router.post("/community/chat", async (req, res): Promise<void> => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !process.env.JWT_SECRET) {
    res.status(401).json({ error: "You must be signed in to chat." });
    return;
  }
  const payload = verifyJwt(authHeader.replace("Bearer ", "").trim(), process.env.JWT_SECRET);
  if (!payload || typeof payload.id !== "number") {
    res.status(401).json({ error: "You must be signed in to chat." });
    return;
  }
  const userId: number = payload.id;
  // Look up actual display name from users table
  const [userRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  const authorName = userRow?.name ?? "User";

  // Rate limit: 1 message per 2 seconds per user
  const twoSecAgo = new Date(Date.now() - 2_000);
  const [{ recentCount }] = await db
    .select({ recentCount: sql<number>`cast(count(*) as int)` })
    .from(communityMessagesTable)
    .where(and(eq(communityMessagesTable.userId, userId), gt(communityMessagesTable.createdAt, twoSecAgo)));
  if (recentCount >= 1) {
    res.status(429).json({ error: "Please wait a moment before sending another message." });
    return;
  }

  const { content } = req.body as { content?: string };
  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "Message content is required." }); return;
  }
  const sanitized = stripHtml(content).trim();
  if (sanitized.length < 1) { res.status(400).json({ error: "Message cannot be empty." }); return; }
  if (sanitized.length > 300) { res.status(400).json({ error: "Message must be under 300 characters." }); return; }
  const badWord = containsBannedWords(sanitized);
  if (badWord) { res.status(400).json({ error: "Message contains language not allowed on this platform." }); return; }

  const [msg] = await db.insert(communityMessagesTable).values({
    userId,
    authorName,
    content: sanitized,
  }).returning();

  res.status(201).json({
    id: msg!.id,
    userId: msg!.userId,
    authorName: msg!.authorName,
    content: msg!.content,
    createdAt: msg!.createdAt.toISOString(),
  });
});

// DELETE /community/chat/:id — admin delete message
router.delete("/community/chat/:id", async (req, res): Promise<void> => {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(communityMessagesTable).set({ isDeleted: true }).where(eq(communityMessagesTable.id, id));
  res.json({ id, deleted: true });
});

// ── DM routes ────────────────────────────────────────────────────────────────

// Helper: extract auth'd userId + name or respond 401
async function requireChatAuth(
  req: import("express").Request,
  res: import("express").Response,
): Promise<{ userId: number; userName: string } | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !process.env.JWT_SECRET) {
    res.status(401).json({ error: "You must be signed in." });
    return null;
  }
  const payload = verifyJwt(authHeader.replace("Bearer ", "").trim(), process.env.JWT_SECRET);
  if (!payload || typeof payload.id !== "number") {
    res.status(401).json({ error: "You must be signed in." });
    return null;
  }
  const [row] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, payload.id));
  return { userId: payload.id, userName: row?.name ?? "User" };
}

// GET /community/dm/conversations — list recent conversations for the current user
router.get("/community/dm/conversations", async (req, res): Promise<void> => {
  const auth = await requireChatAuth(req, res);
  if (!auth) return;
  const { userId } = auth;

  // Get last message per conversation partner
  const rows = await db
    .select()
    .from(directMessagesTable)
    .where(and(
      eq(directMessagesTable.isDeleted, false),
      or(eq(directMessagesTable.fromUserId, userId), eq(directMessagesTable.toUserId, userId)),
    ))
    .orderBy(desc(directMessagesTable.createdAt))
    .limit(500);

  // Group by conversation partner
  const convMap = new Map<number, {
    partnerId: number; partnerName: string; lastMessage: string;
    lastAt: string; unread: number;
  }>();
  for (const r of rows) {
    const isFrom = r.fromUserId === userId;
    const partnerId = isFrom ? r.toUserId : r.fromUserId;
    const partnerName = isFrom ? r.toName : r.fromName;
    if (!convMap.has(partnerId)) {
      const unread = rows.filter(m => m.toUserId === userId && m.fromUserId === partnerId && !m.isRead).length;
      convMap.set(partnerId, {
        partnerId,
        partnerName,
        lastMessage: r.content,
        lastAt: r.createdAt.toISOString(),
        unread,
      });
    }
  }
  res.json([...convMap.values()]);
});

// GET /community/dm/:partnerId — messages between current user and partner
router.get("/community/dm/:partnerId", async (req, res): Promise<void> => {
  const auth = await requireChatAuth(req, res);
  if (!auth) return;
  const { userId } = auth;
  const partnerId = parseInt(req.params["partnerId"] as string, 10);
  if (isNaN(partnerId)) { res.status(400).json({ error: "Invalid partner id" }); return; }

  const msgs = await db
    .select()
    .from(directMessagesTable)
    .where(and(
      eq(directMessagesTable.isDeleted, false),
      or(
        and(eq(directMessagesTable.fromUserId, userId), eq(directMessagesTable.toUserId, partnerId)),
        and(eq(directMessagesTable.fromUserId, partnerId), eq(directMessagesTable.toUserId, userId)),
      ),
    ))
    .orderBy(directMessagesTable.createdAt)
    .limit(200);

  // Mark unread messages from partner as read
  await db.update(directMessagesTable)
    .set({ isRead: true })
    .where(and(
      eq(directMessagesTable.fromUserId, partnerId),
      eq(directMessagesTable.toUserId, userId),
      eq(directMessagesTable.isRead, false),
    ));

  res.json(msgs.map(m => ({
    id: m.id,
    fromUserId: m.fromUserId,
    fromName: m.fromName,
    toUserId: m.toUserId,
    toName: m.toName,
    content: m.content,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
  })));
});

// POST /community/dm/:partnerId — send a DM
router.post("/community/dm/:partnerId", async (req, res): Promise<void> => {
  const auth = await requireChatAuth(req, res);
  if (!auth) return;
  const { userId, userName } = auth;
  const partnerId = parseInt(req.params["partnerId"] as string, 10);
  if (isNaN(partnerId) || partnerId === userId) { res.status(400).json({ error: "Invalid partner" }); return; }

  // Look up partner's name
  const [partnerRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, partnerId));
  if (!partnerRow) { res.status(404).json({ error: "User not found" }); return; }

  const { content } = req.body as { content?: string };
  if (!content || typeof content !== "string") { res.status(400).json({ error: "Content required" }); return; }
  const sanitized = stripHtml(content).trim();
  if (sanitized.length < 1) { res.status(400).json({ error: "Message cannot be empty" }); return; }
  if (sanitized.length > 500) { res.status(400).json({ error: "Max 500 characters" }); return; }

  const [msg] = await db.insert(directMessagesTable).values({
    fromUserId: userId,
    fromName: userName,
    toUserId: partnerId,
    toName: partnerRow.name,
    content: sanitized,
  }).returning();

  res.status(201).json({
    id: msg!.id,
    fromUserId: msg!.fromUserId,
    fromName: msg!.fromName,
    toUserId: msg!.toUserId,
    toName: msg!.toName,
    content: msg!.content,
    isRead: msg!.isRead,
    createdAt: msg!.createdAt.toISOString(),
  });
});

// GET /community/dm/search — find users by name or user ID (for starting new DM)
router.get("/community/dm/search", async (req, res): Promise<void> => {
  const auth = await requireChatAuth(req, res);
  if (!auth) return;
  const q = (req.query["q"] as string ?? "").trim().toLowerCase();
  if (q.length < 2) { res.json([]); return; }

  const isNumeric = /^\d+$/.test(q);
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(
      isNumeric
        ? or(
            sql`lower(${usersTable.name}) like ${"%" + q + "%"}`,
            eq(usersTable.id, parseInt(q, 10)),
          )
        : sql`lower(${usersTable.name}) like ${"%" + q + "%"}`,
    )
    .limit(15);

  res.json(users.filter(u => u.id !== auth.userId));
});

// POST /admin/community/posts/:id/anonymize — M-007: overwrite spoofed authorName
router.post("/admin/community/posts/:id/anonymize", async (req, res): Promise<void> => {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db.update(communityPostsTable)
    .set({ authorName: "Anonymous" })
    .where(eq(communityPostsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Post not found" }); return; }

  res.json({ id: updated.id, authorName: updated.authorName, message: "Author name anonymized." });
});

export default router;
