import { Router, type IRouter } from "express";
import { db, communityPostsTable, communityReportsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { createHmac } from "crypto";

const router: IRouter = Router();

const ADMIN_ID = process.env.ADMIN_ID ?? "";
const HMAC_SECRET = `${ADMIN_ID}:adivasu:admin`;

function makeAdminToken(): string {
  return createHmac("sha256", HMAC_SECRET).update("admin-session-v1").digest("hex");
}
function verifyAdminToken(token: string): boolean {
  if (!ADMIN_ID) return false;
  return token === makeAdminToken();
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

// GET /community — list posts (newest first, not deleted)
router.get("/community", async (_req, res): Promise<void> => {
  const posts = await db
    .select()
    .from(communityPostsTable)
    .where(eq(communityPostsTable.isDeleted, false))
    .orderBy(desc(communityPostsTable.createdAt))
    .limit(100);
  res.json(posts.map(serializePost));
});

// POST /community — create a post
router.post("/community", async (req, res): Promise<void> => {
  const { authorName, content, imageUrl, userId } = req.body as {
    authorName?: string;
    content?: string;
    imageUrl?: string;
    userId?: number;
  };

  if (!authorName || typeof authorName !== "string" || authorName.trim().length < 2) {
    res.status(400).json({ error: "Display name must be at least 2 characters." });
    return;
  }
  if (!content || typeof content !== "string" || content.trim().length < 3) {
    res.status(400).json({ error: "Post content must be at least 3 characters." });
    return;
  }
  if (content.trim().length > 1200) {
    res.status(400).json({ error: "Post content must be under 1200 characters." });
    return;
  }

  const badWord = containsBannedWords(authorName) || containsBannedWords(content);
  if (badWord) {
    res.status(400).json({ error: "Your post contains language that is not allowed on this platform." });
    return;
  }

  if (imageUrl && typeof imageUrl === "string") {
    try {
      const u = new URL(imageUrl);
      if (!["http:", "https:"].includes(u.protocol)) {
        res.status(400).json({ error: "Image URL must start with http or https." });
        return;
      }
    } catch {
      res.status(400).json({ error: "Invalid image URL." });
      return;
    }
  }

  const [post] = await db.insert(communityPostsTable).values({
    userId: userId ?? null,
    authorName: authorName.trim(),
    content: content.trim(),
    imageUrl: imageUrl?.trim() || null,
  }).returning();

  res.status(201).json(serializePost(post!));
});

// POST /community/:id/like — toggle like (simple increment, no auth tracking)
router.post("/community/:id/like", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [post] = await db.select().from(communityPostsTable)
    .where(and(eq(communityPostsTable.id, id), eq(communityPostsTable.isDeleted, false)));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const { action } = req.body as { action?: "like" | "unlike" };
  const newLikes = action === "unlike" ? Math.max(0, post.likes - 1) : post.likes + 1;

  const [updated] = await db.update(communityPostsTable)
    .set({ likes: newLikes })
    .where(eq(communityPostsTable.id, id))
    .returning();

  res.json(serializePost(updated!));
});

// POST /community/:id/report — report a post
router.post("/community/:id/report", async (req, res): Promise<void> => {
  const postId = parseInt(req.params["id"] as string, 10);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { reporterName, reason } = req.body as { reporterName?: string; reason?: string };
  if (!reporterName || reporterName.trim().length < 2) {
    res.status(400).json({ error: "Please provide your name." });
    return;
  }
  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ error: "Please provide a reason (at least 5 characters)." });
    return;
  }

  const [post] = await db.select().from(communityPostsTable)
    .where(and(eq(communityPostsTable.id, postId), eq(communityPostsTable.isDeleted, false)));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const [report] = await db.insert(communityReportsTable).values({
    postId,
    reporterName: reporterName.trim(),
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

export default router;
