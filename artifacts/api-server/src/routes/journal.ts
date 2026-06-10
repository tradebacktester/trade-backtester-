import { Router, type Request, type Response, type NextFunction } from "express";
import { db, journalEntriesTable, backtestsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { verifyJwt } from "../lib/jwt";
import { logger } from "../lib/logger";

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

const JWT_SECRET = process.env.JWT_SECRET ?? "";

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const auth = req.headers["authorization"];
    if (!auth || !JWT_SECRET) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const token = auth.replace("Bearer ", "").trim();
    const payload = verifyJwt(token, JWT_SECRET);
    if (typeof payload?.id !== "number") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    res.locals["userId"] = payload.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

const router = Router();

router.get("/backtests/:backtestId/journal/:tradeId", requireAuth, async (req, res) => {
  const userId = res.locals["userId"] as number;
  const backtestId = parseInt(String(req.params["backtestId"]), 10);
  const tradeId = parseInt(String(req.params["tradeId"]), 10);
  if (isNaN(backtestId) || isNaN(tradeId)) {
    res.status(400).json({ error: "Invalid IDs" });
    return;
  }
  try {
    const [backtest] = await db
      .select({ id: backtestsTable.id })
      .from(backtestsTable)
      .where(and(eq(backtestsTable.id, backtestId), eq(backtestsTable.userId, userId)));
    if (!backtest) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const [entry] = await db
      .select()
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.backtestId, backtestId),
          eq(journalEntriesTable.tradeId, tradeId),
          eq(journalEntriesTable.userId, userId),
        ),
      );
    res.json(entry ?? null);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to load journal entry" });
  }
});

router.put("/backtests/:backtestId/journal/:tradeId", requireAuth, async (req, res) => {
  const userId = res.locals["userId"] as number;
  const backtestId = parseInt(String(req.params["backtestId"]), 10);
  const tradeId = parseInt(String(req.params["tradeId"]), 10);
  if (isNaN(backtestId) || isNaN(tradeId)) {
    res.status(400).json({ error: "Invalid IDs" });
    return;
  }
  try {
    const [backtest] = await db
      .select({ id: backtestsTable.id })
      .from(backtestsTable)
      .where(and(eq(backtestsTable.id, backtestId), eq(backtestsTable.userId, userId)));
    if (!backtest) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const {
      note: rawNote = "",
      tags: rawTags = [],
      session: rawSession = "",
      emotionPre: rawEmotionPre = "",
      emotionPost: rawEmotionPost = "",
      confidence = 0,
      mistakes: rawMistakes = [],
    } = req.body as {
      note?: string;
      tags?: string[];
      session?: string;
      emotionPre?: string;
      emotionPost?: string;
      confidence?: number;
      mistakes?: string[];
    };

    const note       = stripHtml(String(rawNote));
    const tags       = rawTags.map((t) => stripHtml(String(t)));
    const session    = stripHtml(String(rawSession));
    const emotionPre = stripHtml(String(rawEmotionPre));
    const emotionPost= stripHtml(String(rawEmotionPost));
    const mistakes   = rawMistakes.map((m) => stripHtml(String(m)));

    const now = new Date();
    const [entry] = await db
      .insert(journalEntriesTable)
      .values({ backtestId, tradeId, userId, note, tags, session, emotionPre, emotionPost, confidence, mistakes, updatedAt: now })
      .onConflictDoUpdate({
        target: [journalEntriesTable.backtestId, journalEntriesTable.tradeId, journalEntriesTable.userId],
        set: { note, tags, session, emotionPre, emotionPost, confidence, mistakes, updatedAt: now },
      })
      .returning();
    res.json(entry);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to save journal entry" });
  }
});

export default router;
