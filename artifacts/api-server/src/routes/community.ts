import { Router, type IRouter } from "express";
import { db, communityPostsTable, communityReportsTable, communityMessagesTable, subscriptionsTable, subscriptionPlansTable } from "@workspace/db";
import { eq, desc, and, gt, gte, lt, sql } from "drizzle-orm";
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

function serializePost(p: typeof communityPostsTable.$inferSelect) {
  return {
    id: p.id,
    userId: p.userId,
    authorName: p.authorName,
    content: p.content,
    imageUrl: p.imageUrl,
    likes: p.likes,
    createdAt: p.createdAt.toISOString(),
  };
}

// ── Public routes ───────────────────────────────────────────────────────────

// GET /community — list posts (newest first, not deleted) with cursor-based pagination
router.get("/community", async (req, res): Promise<void> => {
  const PAGE_SIZE = 20;
  const limit = Math.min(Math.max(parseInt(String(req.query["limit"] ?? PAGE_SIZE), 10) || PAGE_SIZE, 1), 50);
  const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"), 10) || 0, 0);

  const posts = await db
    .select()
    .from(communityPostsTable)
    .where(eq(communityPostsTable.isDeleted, false))
    .orderBy(desc(communityPostsTable.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = posts.length > limit;
  res.json({ posts: posts.slice(0, limit).map(serializePost), hasMore, offset, limit });
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

  const { content, imageUrl } = req.body as {
    content?: string;
    imageUrl?: string;
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

  const [post] = await db.insert(communityPostsTable).values({
    userId: userId ?? null,
    authorName: authorName.trim(),
    content: sanitized,
    imageUrl: imageUrl?.trim() || null,
  }).returning();

  res.status(201).json(serializePost(post!));
});

// POST /community/:id/like — toggle like (authentication required — CRIT-001)
router.post("/community/:id/like", async (req, res): Promise<void> => {
  // CRIT-001: Require auth to prevent unauthenticated bot-flooding of likes
  const likeAuth = req.headers["authorization"];
  if (!likeAuth || !process.env.JWT_SECRET) {
    res.status(401).json({ error: "You must be signed in to like posts." });
    return;
  }
  const likePayload = verifyJwt(likeAuth.replace("Bearer ", "").trim(), process.env.JWT_SECRET);
  if (!likePayload) {
    res.status(401).json({ error: "You must be signed in to like posts." });
    return;
  }

  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [post] = await db.select().from(communityPostsTable)
    .where(and(eq(communityPostsTable.id, id), eq(communityPostsTable.isDeleted, false)));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const action = (req.body as { action?: "like" | "unlike" } | undefined)?.action;
  const newLikes = action === "unlike" ? Math.max(0, post.likes - 1) : post.likes + 1;

  const [updated] = await db.update(communityPostsTable)
    .set({ likes: newLikes })
    .where(eq(communityPostsTable.id, id))
    .returning();

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

// DELETE /community/:id — admin delete post
router.delete("/community/:id", async (req, res): Promise<void> => {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db.update(communityPostsTable)
    .set({ isDeleted: true, deletedByAdmin: true })
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
  const rawName = typeof payload.email === "string"
    ? payload.email.split("@")[0]!.replace(/[.+_-]+/g, " ").trim()
    : "";
  const authorName = rawName.length >= 2 ? rawName : "User";

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
