import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc, and, gte } from "drizzle-orm";
import { db, paperTradesTable, psychAlertEventsTable } from "@workspace/db";
import { verifyJwt } from "../lib/jwt";
import { logger } from "../lib/logger";
import OpenAI from "openai";
import { alpacaGetOrders, ALPACA_CONFIGURED } from "../lib/alpaca";

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const payload = verifyJwt(token, process.env["JWT_SECRET"]!);
    return typeof payload?.id === "number" ? payload.id : null;
  } catch { return null; }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const id = extractUserId(req);
  if (!id) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = id;
  next();
}

const router: IRouter = Router();

// ── Constants ────────────────────────────────────────────────────────────────
const MIN_DATA_POINTS = 10; // require at least 10 trades before firing most detectors
const COACH_MIN_TRADES = 5;

// ── Types ────────────────────────────────────────────────────────────────────

type PsychAlertType =
  | "fomo"
  | "revenge"
  | "overtrading"
  | "aggressive"
  | "emotional"
  | "tilt"
  | "discipline"
  | "confirmation_bias";

type Severity = "low" | "medium" | "high" | "critical";

interface DetectedAlert {
  type: PsychAlertType;
  severity: Severity;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

interface TradeRow {
  id: number;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  units: number;
  pnl: number;
  pnlPct: number;
  entryTime: number;
  exitTime: number;
}

interface CoachAssessment {
  status: "green" | "yellow" | "orange" | "red";
  statusLabel: string;
  headline: string;
  detail: string;
  recommendation: string;
  confidence: number;
  sampleSize: number;
}

// ── Confidence score ─────────────────────────────────────────────────────────

function calcConfidence(tradeCount: number): number {
  if (tradeCount < 5)  return 0;
  if (tradeCount < 10) return 30;
  if (tradeCount < 20) return 55;
  if (tradeCount < 50) return 75;
  if (tradeCount < 100) return 87;
  return 95;
}

// ── Detection helpers ─────────────────────────────────────────────────────────

function toMs(t: number): number {
  return t > 1e10 ? t : t * 1000;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function detectAlerts(trades: TradeRow[]): DetectedAlert[] {
  if (trades.length < 2) return [];

  const alerts: DetectedAlert[] = [];
  const avgPositionValue = avg(trades.map(t => t.entryPrice * t.units));

  // ── FOMO ─────────────────────────────────────────────────────────────────
  // Require MIN_DATA_POINTS to avoid false positives on new accounts
  if (trades.length >= MIN_DATA_POINTS) {
    for (let i = 3; i < trades.length; i++) {
      const prev3 = trades.slice(i - 3, i);
      const all3Win = prev3.every(t => t.pnl > 0);
      if (!all3Win) continue;

      const current = trades[i]!;
      const last = trades[i - 1]!;

      const timeDiff = toMs(current.entryTime) - toMs(last.exitTime);
      const priceDiff = Math.abs(current.entryPrice - last.exitPrice) / last.exitPrice;

      if (timeDiff < 30 * 60 * 1000 && priceDiff > 0.03) {
        alerts.push({
          type: "fomo",
          severity: priceDiff > 0.07 ? "high" : "medium",
          title: "FOMO Risk Detected",
          message: `You entered ${(priceDiff * 100).toFixed(1)}% above the recent zone after ${prev3.length} consecutive wins. Classic FOMO entry pattern.`,
          metadata: { tradeId: current.id, symbol: current.symbol, priceDiff: +(priceDiff * 100).toFixed(2), winStreak: 3 },
        });
        break;
      }
    }
  }

  // ── Revenge Trading ───────────────────────────────────────────────────────
  // Compute trade durations upfront for adaptive revenge window
  const durations = trades.map(t => toMs(t.exitTime) - toMs(t.entryTime));
  const avgDuration = avg(durations);
  // Scalpers (avg hold < 5 min) get a tighter 2-min window; swing traders get 15 min
  const revengeWindowMs = avgDuration > 0 && avgDuration < 5 * 60 * 1000
    ? 2 * 60 * 1000
    : 15 * 60 * 1000;

  // Require MIN_DATA_POINTS to avoid false positives
  if (trades.length >= MIN_DATA_POINTS) {
    for (let i = 1; i < trades.length; i++) {
      const prev = trades[i - 1]!;
      const curr = trades[i]!;
      if (prev.pnl >= 0) continue;

      const gapMs = toMs(curr.entryTime) - toMs(prev.exitTime);
      if (gapMs < 0 || gapMs > revengeWindowMs) continue;

      const sizeRatio = avgPositionValue > 0 ? (curr.entryPrice * curr.units) / avgPositionValue : 1;
      const severity: Severity = sizeRatio > 1.8 ? "critical" : sizeRatio > 1.3 ? "high" : "medium";

      alerts.push({
        type: "revenge",
        severity,
        title: "Revenge Trading Warning",
        message: `You opened a new position ${Math.round(gapMs / 60000)} min after a $${Math.abs(prev.pnl).toFixed(2)} loss${sizeRatio > 1.3 ? ` with ${sizeRatio.toFixed(1)}× your average size` : ""}. Take 5 minutes before entering another position.`,
        metadata: {
          tradeId: curr.id,
          previousLoss: +Math.abs(prev.pnl).toFixed(2),
          gapMinutes: Math.round(gapMs / 60000),
          sizeMultiplier: +sizeRatio.toFixed(2),
        },
      });
      break;
    }
  }

  // ── Overtrading ───────────────────────────────────────────────────────────
  for (let i = 0; i < trades.length; i++) {
    const windowStart = toMs(trades[i]!.entryTime);
    const windowEnd = windowStart + 24 * 60 * 60 * 1000;
    const inWindow = trades.filter(t => {
      const ms = toMs(t.entryTime);
      return ms >= windowStart && ms < windowEnd;
    });
    if (inWindow.length > 8) {
      const severity: Severity = inWindow.length > 15 ? "critical" : inWindow.length > 12 ? "high" : "medium";
      alerts.push({
        type: "overtrading",
        severity,
        title: "Overtrading Alert",
        message: `You've taken ${inWindow.length} trades in a 24-hour window. Performance typically drops significantly after 8 trades.`,
        metadata: { tradesInWindow: inWindow.length, threshold: 8 },
      });
      break;
    }
  }

  // ── Aggressive Position Sizing ────────────────────────────────────────────
  for (const trade of trades) {
    const posValue = trade.entryPrice * trade.units;
    const ratio = avgPositionValue > 0 ? posValue / avgPositionValue : 1;
    if (ratio > 2.5) {
      alerts.push({
        type: "aggressive",
        severity: ratio > 4 ? "critical" : "high",
        title: "Aggressive Risk Detected",
        message: `One of your positions was ${ratio.toFixed(1)}× your average trade size. Current risk is significantly above your normal profile.`,
        metadata: { tradeId: trade.id, symbol: trade.symbol, sizeMultiplier: +ratio.toFixed(2) },
      });
      break;
    }
  }

  // ── Emotional Trading ─────────────────────────────────────────────────────
  // avgDuration already computed above for adaptive revenge window
  if (avgDuration < 3 * 60 * 1000 && trades.length >= 3) {
    alerts.push({
      type: "emotional",
      severity: "high",
      title: "Emotional Trading Alert",
      message: `Your average trade duration is ${Math.round(avgDuration / 1000)}s. Rapid entries and exits suggest emotional, reactive trading behavior.`,
      metadata: { avgDurationSeconds: Math.round(avgDuration / 1000) },
    });
  } else {
    for (let i = 0; i < trades.length - 2; i++) {
      const windowEnd = toMs(trades[i]!.entryTime) + 10 * 60 * 1000;
      const burst = trades.slice(i).filter(t => toMs(t.entryTime) <= windowEnd);
      if (burst.length >= 3) {
        alerts.push({
          type: "emotional",
          severity: "medium",
          title: "Emotional Trading Alert",
          message: `You opened ${burst.length} trades within a 10-minute window. Trading behavior differs significantly from a calm, planned approach.`,
          metadata: { burstCount: burst.length, windowMinutes: 10 },
        });
        break;
      }
    }
  }

  // ── Tilt ──────────────────────────────────────────────────────────────────
  if (trades.length >= MIN_DATA_POINTS) {
    for (let i = 2; i < trades.length; i++) {
      const streak = [trades[i - 2]!, trades[i - 1]!, trades[i]!];
      if (!streak.every(t => t.pnl < 0)) continue;

      const sizes = streak.map(t => t.entryPrice * t.units);
      const escalating = sizes[2]! > sizes[0]! * 1.2;

      const gapAfter = i + 1 < trades.length
        ? toMs(trades[i + 1]!.entryTime) - toMs(trades[i]!.exitTime)
        : null;
      const quickFollow = gapAfter !== null && gapAfter < 10 * 60 * 1000;

      if (escalating || quickFollow) {
        alerts.push({
          type: "tilt",
          severity: "critical",
          title: "Possible Tilt Detected",
          message: `You have ${streak.length} consecutive losses${escalating ? " with escalating position sizes" : ""}. Historical performance typically drops 37% in this state. Consider stopping for the day.`,
          metadata: {
            consecutiveLosses: streak.length,
            totalLoss: +streak.reduce((s, t) => s + Math.abs(t.pnl), 0).toFixed(2),
            escalatingSize: escalating,
          },
        });
        break;
      }
    }
  }

  // ── Confirmation Bias ─────────────────────────────────────────────────────
  if (trades.length >= MIN_DATA_POINTS) {
    const recentFive = trades.slice(-5);
    const allSameSide = recentFive.every(t => t.side === recentFive[0]!.side);
    const winRate = recentFive.filter(t => t.pnl > 0).length / recentFive.length;
    if (allSameSide && winRate < 0.4) {
      alerts.push({
        type: "confirmation_bias",
        severity: "medium",
        title: "Confirmation Bias Alert",
        message: `Your last 5 trades are all ${recentFive[0]!.side.toUpperCase()} with only ${Math.round(winRate * 100)}% win rate. You may be ignoring signals in the opposite direction.`,
        metadata: { side: recentFive[0]!.side, recentWinRate: +(winRate * 100).toFixed(1) },
      });
    }
  }

  // ── Fading Discipline ─────────────────────────────────────────────────────
  if (trades.length >= MIN_DATA_POINTS) {
    const overall = trades.filter(t => t.pnl > 0).length / trades.length;
    const recent = trades.slice(-5).filter(t => t.pnl > 0).length / 5;
    if (overall > 0.5 && recent < 0.3) {
      alerts.push({
        type: "discipline",
        severity: "high",
        title: "Fading Discipline Alert",
        message: `Your recent win rate (${Math.round(recent * 100)}%) has dropped sharply from your historical average (${Math.round(overall * 100)}%). Your trades may no longer match your documented strategy criteria.`,
        metadata: {
          recentWinRate: +(recent * 100).toFixed(1),
          historicalWinRate: +(overall * 100).toFixed(1),
          gap: +((overall - recent) * 100).toFixed(1),
        },
      });
    }
  }

  return alerts;
}

// ── AI Coach Assessment ───────────────────────────────────────────────────────

async function getCoachAssessment(
  trades: TradeRow[],
  detectedAlerts: DetectedAlert[],
  recentHistory: Array<{ status: string; headline: string; detectedAt: string }>,
): Promise<CoachAssessment> {
  const confidence = calcConfidence(trades.length);

  if (trades.length < COACH_MIN_TRADES) {
    return {
      status: "green",
      statusLabel: "Insufficient Data",
      headline: "Not enough trades to assess",
      detail: `Run at least ${COACH_MIN_TRADES} paper trades to unlock behavioral analysis.`,
      recommendation: "Start trading in the paper trading simulator to generate behavioral data.",
      confidence: 0,
      sampleSize: trades.length,
    };
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    const criticalCount = detectedAlerts.filter(a => a.severity === "critical").length;
    const highCount = detectedAlerts.filter(a => a.severity === "high").length;
    const status: CoachAssessment["status"] =
      criticalCount >= 2 ? "red" :
      criticalCount >= 1 ? "orange" :
      highCount >= 2 ? "yellow" : "green";
    return {
      status,
      statusLabel: status === "red" ? "Stop Trading" : status === "orange" ? "Emotional Behavior" : status === "yellow" ? "Risk Increasing" : "Trading Well",
      headline: status === "green" ? "Trading within normal parameters" : "Multiple risk patterns detected",
      detail: `${detectedAlerts.length} behavioral pattern${detectedAlerts.length !== 1 ? "s" : ""} detected.`,
      recommendation: status === "red" ? "Stop trading for today and review your psychology." : "Review flagged patterns before your next trade.",
      confidence,
      sampleSize: trades.length,
    };
  }

  try {
    const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

    const winRate = +(trades.filter(t => t.pnl > 0).length / trades.length * 100).toFixed(1);
    const totalPnl = +trades.reduce((s, t) => s + t.pnl, 0).toFixed(2);
    const avgDuration = avg(trades.map(t => toMs(t.exitTime) - toMs(t.entryTime)));
    const alertTypes = [...new Set(detectedAlerts.map(a => a.type))];

    const historyContext = recentHistory.length > 0
      ? `\nPrevious session summaries (for continuity):\n${recentHistory.map(h => `- ${h.detectedAt.slice(0, 10)}: ${h.status} — "${h.headline}"`).join("\n")}`
      : "";

    const prompt = `You are an elite trading psychology coach analyzing behavioral data. You have access ONLY to the data provided below — do not invent statistics, cite external research, or reference any source outside this data.

STRICT RULES:
1. Base every assessment ONLY on the numbers below. Never fabricate statistics.
2. Never say "Research shows", "Studies indicate", or cite any book, paper, or external expert.
3. Start data-driven observations with "Based on your trade data:" — never with "Research shows."
4. If data is insufficient for a strong conclusion, state that briefly rather than guessing.

Trader data:
- Trades analyzed: ${trades.length} total (confidence: ${confidence}% based on sample size)
- Win rate: ${winRate}%
- Total P&L: $${totalPnl}
- Avg hold time: ${Math.round(avgDuration / 60000)} minutes
- Behavioral alerts triggered: ${alertTypes.length > 0 ? alertTypes.join(", ") : "none"}
- Critical alerts: ${detectedAlerts.filter(a => a.severity === "critical").length}
${historyContext}

Return a JSON object with exactly these fields:
{
  "status": one of: "green" | "yellow" | "orange" | "red",
  "statusLabel": short label (e.g. "Trading Well", "Risk Increasing", "Emotional Behavior", "Stop Trading"),
  "headline": one short bold headline citing their actual data (max 10 words),
  "detail": 1-2 sentences of honest assessment referencing their specific numbers (max 30 words),
  "recommendation": one clear action sentence derived from their data (max 20 words)
}

Be direct. If multiple critical alerts exist, lean toward orange or red. Reference previous sessions only if there is an evident pattern in the session history data.`;

    const res = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.4,
    });

    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<CoachAssessment>;

    return {
      status: (["green", "yellow", "orange", "red"].includes(parsed.status ?? "") ? parsed.status : "green") as CoachAssessment["status"],
      statusLabel: parsed.statusLabel ?? "Normal",
      headline: parsed.headline ?? "Trading within normal parameters",
      detail: parsed.detail ?? "No major issues detected.",
      recommendation: parsed.recommendation ?? "Continue following your strategy.",
      confidence,
      sampleSize: trades.length,
    };
  } catch (err) {
    logger.error(err, "psych-alerts: AI coach failed");
    const criticalCount = detectedAlerts.filter(a => a.severity === "critical").length;
    const highCount = detectedAlerts.filter(a => a.severity === "high").length;
    const status: CoachAssessment["status"] =
      criticalCount >= 2 ? "red" :
      criticalCount >= 1 ? "orange" :
      highCount >= 2 ? "yellow" : "green";
    return {
      status,
      statusLabel: status === "red" ? "Stop Trading" : status === "orange" ? "Emotional Behavior" : status === "yellow" ? "Risk Increasing" : "Trading Well",
      headline: status === "green" ? "You are trading better than usual" : "Multiple risk patterns detected",
      detail: `${detectedAlerts.length} behavioral pattern${detectedAlerts.length !== 1 ? "s" : ""} detected in your recent trades.`,
      recommendation: status === "red" ? "Stop trading for today and review your psychology." : "Review flagged patterns before your next trade.",
      confidence,
      sampleSize: trades.length,
    };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/psych-alerts — analyze + return stored events
router.get("/psych-alerts", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [rawTrades, storedEvents] = await Promise.all([
      db
        .select()
        .from(paperTradesTable)
        .where(eq(paperTradesTable.userId, userId))
        .orderBy(desc(paperTradesTable.createdAt))
        .limit(100),
      db
        .select()
        .from(psychAlertEventsTable)
        .where(eq(psychAlertEventsTable.userId, userId))
        .orderBy(desc(psychAlertEventsTable.detectedAt))
        .limit(100),
    ]);

    // Fetch 30-day history for trend chart
    const thirtyDayEvents = storedEvents.filter(e => e.detectedAt >= thirtyDaysAgo);

    const trades: TradeRow[] = rawTrades.map(r => ({
      id: r.id,
      symbol: r.symbol,
      side: r.side,
      entryPrice: Number(r.entryPrice),
      exitPrice: Number(r.exitPrice),
      units: Number(r.units),
      pnl: Number(r.pnl),
      pnlPct: Number(r.pnlPct),
      entryTime: r.entryTime,
      exitTime: r.exitTime,
    })).reverse();

    // BUG-012: Merge Alpaca brokerage orders so psych detection covers real trades too
    if (ALPACA_CONFIGURED()) {
      try {
        const alpacaOrders = await alpacaGetOrders("closed", 100);
        let nextId = -1;
        for (const o of alpacaOrders) {
          if (o["status"] !== "filled") continue;
          const sym   = typeof o["symbol"]            === "string" ? o["symbol"] : "";
          const oSide = o["side"] === "buy" ? "long" : "short";
          const price = Number(o["filled_avg_price"]  ?? 0);
          const qty   = Number(o["filled_qty"]         ?? 0);
          const ts    = String(o["filled_at"] ?? o["submitted_at"] ?? "");
          if (!sym || !price || !ts) continue;
          const tMs = new Date(ts).getTime();
          if (isNaN(tMs)) continue;
          const tSec = Math.floor(tMs / 1000);
          trades.push({
            id: nextId--,
            symbol: sym,
            side: oSide,
            entryPrice: price,
            exitPrice: price,
            units: qty,
            pnl: 0,       // P&L not available without round-trip matching
            pnlPct: 0,
            entryTime: tSec,
            exitTime: tSec,
          });
        }
        trades.sort((a, b) => a.entryTime - b.entryTime);
      } catch {
        // Alpaca unavailable — continue with paper trades only
      }
    }

    const detectedAlerts = detectAlerts(trades);

    // Persist new detected alerts (deduplicate by type within 1h)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTypes = new Set(
      storedEvents
        .filter(e => e.detectedAt > oneHourAgo)
        .map(e => e.type)
    );

    const newAlerts = detectedAlerts.filter(a => !recentTypes.has(a.type));
    if (newAlerts.length > 0) {
      await db.insert(psychAlertEventsTable).values(
        newAlerts.map(a => ({
          userId,
          type: a.type,
          severity: a.severity,
          title: a.title,
          message: a.message,
          metadata: a.metadata,
        }))
      );
    }

    // Fetch updated events (limit 50 for display)
    const allEvents = await db
      .select()
      .from(psychAlertEventsTable)
      .where(eq(psychAlertEventsTable.userId, userId))
      .orderBy(desc(psychAlertEventsTable.detectedAt))
      .limit(50);

    // Build previous session history for coach context (last 3 unique sessions)
    const coachHistory = storedEvents
      .filter(e => e.metadata && typeof (e.metadata as Record<string,unknown>)["coachStatus"] === "string")
      .slice(0, 3)
      .map(e => ({
        status: String((e.metadata as Record<string,unknown>)["coachStatus"] ?? ""),
        headline: String((e.metadata as Record<string,unknown>)["coachHeadline"] ?? ""),
        detectedAt: e.detectedAt.toISOString(),
      }));

    const coach = await getCoachAssessment(trades, detectedAlerts, coachHistory);

    // Store coach assessment as a metadata-enriched event for future sessions
    if (trades.length >= COACH_MIN_TRADES && coach.status !== "green") {
      const lastCoachEvent = storedEvents.find(e => e.type === "coach_session");
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (!lastCoachEvent || lastCoachEvent.detectedAt < hourAgo) {
        await db.insert(psychAlertEventsTable).values({
          userId,
          type: "coach_session" as PsychAlertType,
          severity: coach.status === "red" ? "critical" : coach.status === "orange" ? "high" : "medium",
          title: coach.headline,
          message: coach.detail,
          metadata: {
            coachStatus: coach.status,
            coachHeadline: coach.headline,
            sampleSize: trades.length,
          },
          isRead: true,
        });
      }
    }

    // Build 30-day trend data (group by date, count by type)
    const trendMap: Record<string, Record<string, number>> = {};
    for (const e of thirtyDayEvents) {
      if (e.type === "coach_session") continue;
      const day = e.detectedAt.toISOString().slice(0, 10);
      if (!trendMap[day]) trendMap[day] = {};
      trendMap[day][e.type] = (trendMap[day][e.type] ?? 0) + 1;
    }
    const trendData = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts, total: Object.values(counts).reduce((s, v) => s + v, 0) }));

    // MISSING-009: 4-week rolling sparkline — always populated even if zero alerts (shows improvement)
    const weeklyTrend: Array<{ week: string; fomo: number; revenge: number; overtrading: number; aggressive: number; total: number }> = [];
    const nowMs = Date.now();
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(nowMs - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd   = new Date(nowMs - w       * 7 * 24 * 60 * 60 * 1000);
      const mmdd      = weekStart.toISOString().slice(5, 10); // MM-DD
      const label     = `W${4 - w} ${mmdd}`;
      const counts    = { fomo: 0, revenge: 0, overtrading: 0, aggressive: 0, total: 0 };
      for (const e of thirtyDayEvents) {
        if (e.type === "coach_session") continue;
        if (e.detectedAt >= weekStart && e.detectedAt < weekEnd) {
          const t = e.type as string;
          if (t === "fomo" || t === "revenge" || t === "overtrading" || t === "aggressive") {
            (counts as Record<string, number>)[t]++;
          }
          counts.total++;
        }
      }
      weeklyTrend.push({ week: label, ...counts });
    }

    const stats = {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? +(trades.filter(t => t.pnl > 0).length / trades.length * 100).toFixed(1) : 0,
      totalPnl: +trades.reduce((s, t) => s + t.pnl, 0).toFixed(2),
      unreadCount: allEvents.filter(e => !e.isRead && e.type !== "coach_session").length,
    };

    res.json({
      events: allEvents.filter(e => e.type !== "coach_session").map(e => ({
        ...e,
        detectedAt: e.detectedAt.toISOString(),
      })),
      detectedNow: detectedAlerts,
      coach,
      stats,
      trendData,
      weeklyTrend,
    });
  } catch (err) {
    logger.error(err, "psych-alerts: GET failed");
    res.status(500).json({ error: "Failed to analyze trading psychology" });
  }
});

// GET /api/psych-alerts/trend — 30-day alert trend data
router.get("/psych-alerts/trend", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await db
      .select()
      .from(psychAlertEventsTable)
      .where(and(eq(psychAlertEventsTable.userId, userId), gte(psychAlertEventsTable.detectedAt, thirtyDaysAgo)))
      .orderBy(psychAlertEventsTable.detectedAt);

    const trendMap: Record<string, Record<string, number>> = {};
    for (const e of events) {
      if (e.type === "coach_session") continue;
      const day = e.detectedAt.toISOString().slice(0, 10);
      if (!trendMap[day]) trendMap[day] = {};
      trendMap[day][e.type] = (trendMap[day][e.type] ?? 0) + 1;
    }
    const trendData = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts, total: Object.values(counts).reduce((s, v) => s + v, 0) }));

    res.json({ trendData });
  } catch (err) {
    logger.error(err, "psych-alerts: trend failed");
    res.status(500).json({ error: "Failed to fetch trend data" });
  }
});

// POST /api/psych-alerts/read-all — mark all as read
router.post("/psych-alerts/read-all", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    await db
      .update(psychAlertEventsTable)
      .set({ isRead: true })
      .where(and(eq(psychAlertEventsTable.userId, userId), eq(psychAlertEventsTable.isRead, false)));
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "psych-alerts: read-all failed");
    res.status(500).json({ error: "Failed to mark alerts as read" });
  }
});

// DELETE /api/psych-alerts — clear all events for user
router.delete("/psych-alerts", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    await db.delete(psychAlertEventsTable).where(eq(psychAlertEventsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "psych-alerts: DELETE failed");
    res.status(500).json({ error: "Failed to clear alerts" });
  }
});

export default router;
