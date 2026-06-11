import { Router, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, backtestsTable, tradesTable, journalEntriesTable, paperTradesTable,
} from "@workspace/db";
import { extractTraderProfile, type TraderProfile } from "../lib/pattern-extractor";
import { verifyJwt } from "../lib/jwt";
import OpenAI from "openai";
import pino from "pino";

const logger = pino({ level: "info" });
const JWT_SECRET = process.env.JWT_SECRET ?? "";

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth || !JWT_SECRET) return null;
    const token = auth.replace("Bearer ", "").trim();
    const payload = verifyJwt(token, JWT_SECRET);
    return typeof payload?.id === "number" ? payload.id : null;
  } catch { return null; }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const id = extractUserId(req);
  if (!id) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = id;
  next();
}

function groqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY ?? "",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function getMarket(symbol: string): string {
  const crypto = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LINK"];
  const forex  = ["EUR", "GBP", "USD", "JPY", "AUD", "CAD", "CHF", "NZD"];
  if (crypto.some(c => symbol.includes(c))) return "Crypto";
  if (forex.some(f => symbol.startsWith(f) || symbol.endsWith(f))) return "Forex";
  return "Stocks";
}

/* ── Rank ──────────────────────────────────────────────────────────────────── */
export const RANKS = [
  { min: 0,  name: "Rookie Trader",        icon: "🌱", color: "#6b7280", description: "Building your foundation" },
  { min: 16, name: "Disciplined Trader",    icon: "📋", color: "#3b82f6", description: "Consistent habits forming" },
  { min: 31, name: "Professional Trader",   icon: "💼", color: "#8b5cf6", description: "Executing with precision" },
  { min: 51, name: "Market Sniper",         icon: "🎯", color: "#06b6d4", description: "High-probability only" },
  { min: 66, name: "Institutional Mindset", icon: "🏛", color: "#f59e0b", description: "Trading like the pros" },
  { min: 81, name: "Legendary Trader",      icon: "⭐", color: "#22c55e", description: "Elite performance tier" },
];

function computeRankScore(profile: TraderProfile) {
  const winRateScore = Math.min(25, (profile.avgWinRate / 100) * 25);

  const wRates = profile.strategyStats.map(s => s.avgWinRate);
  const meanWR = wRates.length ? wRates.reduce((a, b) => a + b, 0) / wRates.length : 50;
  const stdDev = wRates.length > 1
    ? Math.sqrt(wRates.reduce((sum, w) => sum + (w - meanWR) ** 2, 0) / wRates.length)
    : 25;
  const consistencyScore = Math.min(20, Math.max(0, 20 - stdDev * 0.5));

  const riskScore =
    profile.avgDrawdown < 10 ? 20 :
    profile.avgDrawdown < 20 ? 15 :
    profile.avgDrawdown < 30 ? 8 : 3;

  const hasJournaled = profile.journalMistakes.length > 0;
  const disciplineScore = profile.backtestCount >= 3
    ? (hasJournaled ? 20 : 12)
    : profile.backtestCount >= 1 ? (hasJournaled ? 10 : 6) : 0;

  const adherenceScore =
    profile.backtestCount >= 10 ? 15 :
    profile.backtestCount >= 5  ? 10 :
    profile.backtestCount >= 1  ? 5  : 0;

  const score = Math.round(Math.min(100, winRateScore + consistencyScore + riskScore + disciplineScore + adherenceScore));
  return {
    score,
    breakdown: {
      winRate:      Math.round(winRateScore),
      consistency:  Math.round(consistencyScore),
      risk:         Math.round(riskScore),
      discipline:   Math.round(disciplineScore),
      adherence:    Math.round(adherenceScore),
    },
  };
}

/* ── Router ────────────────────────────────────────────────────────────────── */
const router = Router();
router.use(requireAuth);

/* ── GET /api/trading-os/rank ─────────────────────────────────────────────── */
router.get("/trading-os/rank", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals["userId"] as number;
    const profile = await extractTraderProfile(userId);
    const { score, breakdown } = computeRankScore(profile);

    const currentRank = [...RANKS].filter(r => score >= r.min).pop()!;
    const nextRank    = RANKS.find(r => r.min > score) ?? null;
    const pctToNext   = nextRank
      ? Math.round(((score - currentRank.min) / (nextRank.min - currentRank.min)) * 100)
      : 100;

    const achievements = [
      { id: "first_bt",   label: "First Backtest",  earned: profile.backtestCount >= 1,              icon: "🚀" },
      { id: "ten_bt",     label: "10 Backtests",     earned: profile.backtestCount >= 10,             icon: "📊" },
      { id: "win50",      label: "50% Win Rate",      earned: profile.avgWinRate >= 50,               icon: "🎯" },
      { id: "win65",      label: "65% Win Rate",      earned: profile.avgWinRate >= 65,               icon: "🔥" },
      { id: "risk10",     label: "Low Drawdown",      earned: profile.avgDrawdown > 0 && profile.avgDrawdown < 10, icon: "🛡" },
      { id: "journaled",  label: "Journaled Trades",  earned: profile.journalMistakes.length > 0,     icon: "📝" },
      { id: "sharpe1",    label: "Sharpe > 1",        earned: profile.avgSharpe >= 1,                 icon: "⚡" },
      { id: "consistent", label: "3+ Strategies",     earned: profile.strategyStats.length >= 3,      icon: "💡" },
    ];

    res.json({
      score, breakdown, achievements,
      rank: currentRank, nextRank, pctToNext,
      profile: {
        totalTrades: profile.totalTrades,
        avgWinRate:  Math.round(profile.avgWinRate * 10) / 10,
        avgDrawdown: Math.round(profile.avgDrawdown * 10) / 10,
        traderStyle: profile.traderStyle,
        backtestCount: profile.backtestCount,
      },
    });
  } catch (err) {
    logger.error(err, "trading-os/rank error");
    res.status(500).json({ error: "Failed to compute rank." });
  }
});

/* ── GET /api/trading-os/health-score ─────────────────────────────────────── */
router.get("/trading-os/health-score", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals["userId"] as number;
    const profile = await extractTraderProfile(userId);

    const recent         = profile.recentTrades.slice(0, 10);
    const recentWins     = recent.filter(t => t.pnl > 0).length;
    const recentWinRate  = recent.length > 0 ? (recentWins / recent.length) * 100 : 50;
    const recentScore    = Math.round((recentWinRate / 100) * 30);

    const journalScore   = profile.journalMistakes.length > 0 ? 16 : 8;

    const totalMistakes  = profile.journalMistakes.reduce((s, m) => s + m.count, 0);
    const mistakeScore   = Math.max(0, 20 - Math.min(20, totalMistakes * 2));

    const riskScore      =
      profile.avgDrawdown < 10 ? 15 :
      profile.avgDrawdown < 20 ? 10 :
      profile.avgDrawdown < 30 ? 5  : 2;

    const sharpeScore    =
      profile.avgSharpe >= 1.5 ? 15 :
      profile.avgSharpe >= 1   ? 10 :
      profile.avgSharpe >= 0.5 ? 6  : 2;

    const totalScore = Math.min(100, recentScore + journalScore + Math.round(mistakeScore) + riskScore + sharpeScore);

    const recommendation =
      totalScore >= 90 ? "In the zone. Trade at full confidence and size." :
      totalScore >= 75 ? "Strong mental state. Proceed normally." :
      totalScore >= 60 ? "Moderate form. Consider reducing position size 20%." :
      totalScore >= 40 ? "Below average form. Trade cautiously or step back." :
      "High risk day. Consider sitting today out entirely.";

    const riskMultiplier = totalScore >= 75 ? 1.0 : totalScore >= 60 ? 0.8 : totalScore >= 40 ? 0.5 : 0.25;

    const statusColor =
      totalScore >= 75 ? "#22c55e" :
      totalScore >= 55 ? "#f59e0b" : "#ef4444";

    res.json({
      score: Math.round(totalScore),
      recommendation, riskMultiplier, statusColor,
      breakdown: {
        recentPerformance: recentScore,
        journalConsistency: journalScore,
        mistakeDiscipline: Math.round(mistakeScore),
        riskControl: riskScore,
        sharpeQuality: sharpeScore,
      },
      recentWinRate:    Math.round(recentWinRate * 10) / 10,
      recentTradeCount: recent.length,
    });
  } catch (err) {
    logger.error(err, "trading-os/health-score error");
    res.status(500).json({ error: "Failed to compute health score." });
  }
});

/* ── GET /api/trading-os/mistake-counter ──────────────────────────────────── */
router.get("/trading-os/mistake-counter", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals["userId"] as number;

    const rows = await db
      .select({
        mistakes:   journalEntriesTable.mistakes,
        pnl:        tradesTable.pnl,
        pnlPercent: tradesTable.pnlPercent,
      })
      .from(journalEntriesTable)
      .innerJoin(tradesTable, and(
        eq(tradesTable.backtestId, journalEntriesTable.backtestId),
        eq(tradesTable.id,          journalEntriesTable.tradeId),
      ))
      .where(eq(journalEntriesTable.userId, userId));

    const mistakeMap: Record<string, { totalLoss: number; count: number }> = {};
    let totalLost = 0;

    for (const row of rows) {
      const pnl      = Number(row.pnl);
      const mistakes = (row.mistakes as string[]) ?? [];
      if (mistakes.length === 0) continue;
      const lossPer  = pnl < 0 ? Math.abs(pnl) / mistakes.length : 0;
      if (pnl < 0) totalLost += Math.abs(pnl);
      for (const m of mistakes) {
        if (!mistakeMap[m]) mistakeMap[m] = { totalLoss: 0, count: 0 };
        mistakeMap[m].count++;
        if (pnl < 0) mistakeMap[m].totalLoss += lossPer;
      }
    }

    const breakdown = Object.entries(mistakeMap)
      .sort((a, b) => b[1].totalLoss - a[1].totalLoss)
      .map(([label, data]) => ({
        label,
        totalLoss: Math.round(data.totalLoss * 100) / 100,
        count:     data.count,
        pct:       totalLost > 0 ? Math.round((data.totalLoss / totalLost) * 100) : 0,
      }));

    res.json({
      totalLost:       Math.round(totalLost * 100) / 100,
      breakdown,
      tradesAnalyzed:  rows.length,
    });
  } catch (err) {
    logger.error(err, "trading-os/mistake-counter error");
    res.status(500).json({ error: "Failed to compute mistake counter." });
  }
});

/* ── POST /api/trading-os/ghost ───────────────────────────────────────────── */
router.post("/trading-os/ghost", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId      = res.locals["userId"] as number;
    const b           = req.body as Record<string, unknown>;
    const symbol      = typeof b["symbol"]      === "string" ? b["symbol"]      : "BTCUSDT";
    const side        = typeof b["side"]        === "string" ? b["side"]        : "long";
    const durationDays = typeof b["durationDays"] === "number" ? b["durationDays"] : 1;

    const profile  = await extractTraderProfile(userId);
    const allTrades = [...profile.winningTrades, ...profile.losingTrades];

    if (allTrades.length === 0) {
      res.json({ similarityScore: 0, matches: [], stats: null, message: "No historical trades to compare against. Run backtests first." });
      return;
    }

    const scored = allTrades.map(trade => {
      let score = 0;
      if (trade.symbol === symbol)                                    score += 40;
      else if (getMarket(trade.symbol) === getMarket(symbol))         score += 15;
      if (trade.side   === side)                                       score += 25;
      const durDiff = Math.abs(trade.durationDays - durationDays);
      score += Math.max(0, 20 - durDiff * 3);
      const freq  = allTrades.filter(t => t.symbol === trade.symbol && t.side === trade.side).length;
      score += Math.min(15, (freq / allTrades.length) * 100);
      return { trade, score: Math.round(Math.min(100, score)) };
    });

    const sorted     = scored.sort((a, b) => b.score - a.score);
    const similar    = scored.filter(s => s.score >= 30).map(s => s.trade);
    const wins       = similar.filter(t => t.pnl > 0);
    const losses     = similar.filter(t => t.pnl <= 0);
    const avgReturn  = similar.length > 0 ? similar.reduce((s, t) => s + t.pnlPercent, 0) / similar.length : 0;
    const winRate    = similar.length > 0 ? (wins.length / similar.length) * 100 : 0;
    const avgWinRet  = wins.length   > 0 ? wins.reduce((s, t) => s + t.pnlPercent, 0)   / wins.length   : 0;
    const avgLossRet = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length : 0;
    const bestSim    = sorted[0];

    res.json({
      similarityScore: bestSim?.score ?? 0,
      topMatch: bestSim ? {
        symbol:     bestSim.trade.symbol,
        side:       bestSim.trade.side,
        pnlPercent: Math.round(bestSim.trade.pnlPercent * 100) / 100,
        durationDays: Math.round(bestSim.trade.durationDays * 10) / 10,
        won:        bestSim.trade.pnl > 0,
        score:      bestSim.score,
      } : null,
      matches: sorted.slice(1, 4).map(m => ({
        symbol:     m.trade.symbol,
        side:       m.trade.side,
        pnlPercent: Math.round(m.trade.pnlPercent * 100) / 100,
        won:        m.trade.pnl > 0,
        score:      m.score,
        durationDays: Math.round(m.trade.durationDays * 10) / 10,
      })),
      stats: similar.length > 0 ? {
        similarCount:   similar.length,
        wins:           wins.length,
        losses:         losses.length,
        winRate:        Math.round(winRate * 10) / 10,
        avgReturn:      Math.round(avgReturn * 100) / 100,
        avgWinReturn:   Math.round(avgWinRet * 100) / 100,
        avgLossReturn:  Math.round(avgLossRet * 100) / 100,
      } : null,
    });
  } catch (err) {
    logger.error(err, "trading-os/ghost error");
    res.status(500).json({ error: "Trade Ghost analysis failed." });
  }
});

/* ── POST /api/trading-os/future-sim ─────────────────────────────────────── */
router.post("/trading-os/future-sim", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId       = res.locals["userId"] as number;
    const b            = req.body as Record<string, unknown>;
    const entry        = Number(b["entry"]        ?? 0);
    const stopLoss     = Number(b["stopLoss"]     ?? 0);
    const takeProfit   = Number(b["takeProfit"]   ?? 0);
    const positionSize = Number(b["positionSize"] ?? 1);
    const symbol       = typeof b["symbol"] === "string" ? b["symbol"] : "BTCUSDT";
    const side         = typeof b["side"]   === "string" ? b["side"]   : "long";

    if (entry <= 0 || stopLoss <= 0 || takeProfit <= 0) {
      res.status(400).json({ error: "entry, stopLoss, and takeProfit are required." });
      return;
    }

    const profile = await extractTraderProfile(userId);

    const winPnl  = side === "long" ? (takeProfit - entry) * positionSize : (entry - takeProfit) * positionSize;
    const lossPnl = side === "long" ? (stopLoss   - entry) * positionSize : (entry - stopLoss)   * positionSize;
    const winPct  = side === "long" ? ((takeProfit - entry) / entry) * 100 : ((entry - takeProfit) / entry) * 100;
    const lossPct = side === "long" ? ((stopLoss   - entry) / entry) * 100 : ((entry - stopLoss)   / entry) * 100;
    const rrRatio = Math.abs(winPnl / (lossPnl || 1));

    const symbolTrades = [...profile.winningTrades, ...profile.losingTrades].filter(t => t.symbol === symbol && t.side === side);
    const histWinRate  = symbolTrades.length > 0
      ? (symbolTrades.filter(t => t.pnl > 0).length / symbolTrades.length) * 100
      : profile.avgWinRate;

    const expectedValue = (histWinRate / 100) * winPnl + ((100 - histWinRate) / 100) * lossPnl;

    const avgAbsPct    = profile.avgReturn > 0 ? profile.avgReturn : 2;
    const thisMovePct  = Math.abs(winPct);
    const emotionalRisk =
      thisMovePct > avgAbsPct * 3 ? 90 :
      thisMovePct > avgAbsPct * 2 ? 65 :
      thisMovePct > avgAbsPct     ? 40 : 20;

    res.json({
      scenarios: {
        win:   { label: "Trade Wins",    pnl: Math.round(winPnl  * 100) / 100, pct: Math.round(winPct  * 100) / 100 },
        loss:  { label: "Trade Loses",   pnl: Math.round(lossPnl * 100) / 100, pct: Math.round(lossPct * 100) / 100 },
        range: { label: "Market Ranges", pnl: Math.round(winPnl * 0.12 * 100) / 100, pct: Math.round(winPct * 0.12 * 100) / 100 },
      },
      rrRatio:          Math.round(rrRatio * 100) / 100,
      expectedValue:    Math.round(expectedValue * 100) / 100,
      historicalWinRate: Math.round(histWinRate * 10) / 10,
      symbolTradeCount: symbolTrades.length,
      emotionalRisk,
    });
  } catch (err) {
    logger.error(err, "trading-os/future-sim error");
    res.status(500).json({ error: "Simulation failed." });
  }
});

/* ── POST /api/trading-os/fomo-check ─────────────────────────────────────── */
router.post("/trading-os/fomo-check", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId               = res.locals["userId"] as number;
    const b                    = req.body as Record<string, unknown>;
    const symbol               = typeof b["symbol"] === "string" ? b["symbol"] : "BTCUSDT";
    const side                 = typeof b["side"]   === "string" ? b["side"]   : "long";
    const priceMovePercent     = Number(b["priceMovePercent"]     ?? 0);
    const recentLossCount      = Number(b["recentLossCount"]      ?? 0);
    const minutesSinceLastTrade = Number(b["minutesSinceLastTrade"] ?? 60);

    const profile   = await extractTraderProfile(userId);
    const behaviors: string[] = [];
    let riskScore = 0;
    const warnings: string[] = [];

    if (priceMovePercent > 5) {
      behaviors.push("FOMO");
      riskScore += 35;
      warnings.push(`Price has already moved ${priceMovePercent.toFixed(1)}%. Your historical losing trades frequently occur after moves larger than 5%.`);
    } else if (priceMovePercent > 3) {
      riskScore += 15;
      warnings.push(`Price moved ${priceMovePercent.toFixed(1)}% — elevated. Wait for a minor pullback before entering.`);
    }

    if (recentLossCount >= 3) {
      behaviors.push("Revenge Trading");
      riskScore += 35;
      warnings.push(`${recentLossCount} recent losses detected. Revenge trading is your #1 risk right now. Step away for 15 minutes.`);
    } else if (recentLossCount >= 2) {
      behaviors.push("Caution: Recent Losses");
      riskScore += 20;
      warnings.push(`${recentLossCount} recent losses detected. Reduce position size by 50% on this trade.`);
    }

    if (minutesSinceLastTrade < 5) {
      behaviors.push("Overtrading");
      riskScore += 25;
      warnings.push("You traded less than 5 minutes ago. Overtrading dramatically reduces performance consistency.");
    } else if (minutesSinceLastTrade < 15) {
      riskScore += 10;
      warnings.push("Quick succession trading. Slow down and fully validate this setup before entering.");
    }

    const currentHour    = new Date().getUTCHours();
    const currentSession =
      currentHour >= 8  && currentHour < 13 ? "London Open"  :
      currentHour >= 13 && currentHour < 22 ? "New York Open" : "Asian Session";

    const sessionStat = profile.sessionStats?.find(s => s.label === currentSession);
    if (sessionStat && sessionStat.winRate < 40) {
      riskScore += 15;
      warnings.push(`${currentSession} is your weakest session (${sessionStat.winRate.toFixed(0)}% win rate). Your edge is significantly lower right now.`);
    }

    const fomoLevel: "none" | "low" | "medium" | "high" =
      riskScore >= 60 ? "high"   :
      riskScore >= 35 ? "medium" :
      riskScore >= 15 ? "low"    : "none";

    const recommendation =
      fomoLevel === "high"   ? "STOP. Multiple emotional risk factors detected. Do not enter this trade." :
      fomoLevel === "medium" ? "Caution. Verify all entry criteria are precisely met before proceeding." :
      fomoLevel === "low"    ? "Minor risk signals. Consider reducing position size by 25%." :
      "No behavioral red flags detected. Your setup looks clean.";

    res.json({
      fomoLevel, riskScore, behaviors, warnings, recommendation, currentSession,
      sessionWinRate: sessionStat?.winRate ?? null,
    });
  } catch (err) {
    logger.error(err, "trading-os/fomo-check error");
    res.status(500).json({ error: "FOMO check failed." });
  }
});

/* ── GET /api/trading-os/coach-briefing ──────────────────────────────────── */
router.get("/trading-os/coach-briefing", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId  = res.locals["userId"] as number;
    const profile = await extractTraderProfile(userId);

    if (profile.totalTrades === 0 && profile.backtestCount === 0) {
      res.json({
        greeting:      "Welcome to Trade Lab, Trader.",
        keyInsight:    "Your coaching journey starts with your first backtest. Run one now to unlock your personalized daily briefing.",
        sessionAdvice: "Explore the Strategy Lab to get started.",
        todayGoal:     "Complete your first backtest and journal the results.",
        warning:       null,
        generatedAt:   new Date().toISOString(),
        source:        "system",
      });
      return;
    }

    const bestSession  = [...profile.sessionStats].sort((a, b) => b.winRate - a.winRate)[0];
    const worstSession = [...profile.sessionStats].sort((a, b) => a.winRate - b.winRate)[0];
    const topMistake   = profile.journalMistakes[0];
    const { score: rankScore } = computeRankScore(profile);
    const recent       = profile.recentTrades.slice(0, 5);
    const recentWins   = recent.filter(t => t.pnl > 0).length;
    const recentLosses = recent.length - recentWins;

    const context = `Trader Performance Data:
Style: ${profile.traderStyle} | Side: ${profile.preferredSide} | Rank: ${rankScore}/100
Win Rate: ${profile.avgWinRate.toFixed(1)}% | Avg Return: ${profile.avgReturn.toFixed(1)}% | Drawdown: ${profile.avgDrawdown.toFixed(1)}% | Sharpe: ${profile.avgSharpe.toFixed(2)}
Backtests: ${profile.backtestCount} | Total Trades Analyzed: ${profile.totalTrades}
Recent form (last 5 trades): ${recentWins} wins / ${recentLosses} losses
Best session: ${bestSession?.label ?? "N/A"} (${bestSession?.winRate.toFixed(0) ?? "?"}% win rate)
Worst session: ${worstSession?.label ?? "N/A"} (${worstSession?.winRate.toFixed(0) ?? "?"}% win rate)
Top mistake pattern: ${topMistake ? `"${topMistake.label}" recurring ${topMistake.count} times` : "none recorded yet"}
Best strategy type: ${profile.strategyStats[0]?.type ?? "N/A"} (${profile.strategyStats[0]?.avgWinRate.toFixed(0) ?? "?"}% avg win rate)
Top symbol: ${profile.topSymbols[0]?.symbol ?? "N/A"} (${profile.topSymbols[0]?.winRate.toFixed(0) ?? "?"}% win rate)`;

    const systemPrompt = `You are an elite personal trading coach who combines the precision of a hedge fund manager with the psychological insight of a sports performance coach. You know this trader's complete history. Be direct, specific, and motivating — never generic. All performance statistics are derived from real historical market data (Binance for crypto, Yahoo Finance for stocks/forex/indices/commodities).

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "greeting": "[Address them by their trading style. 1 sentence acknowledging their current performance trend]",
  "keyInsight": "[The single most actionable insight from their exact data — cite specific numbers. 2 sentences max]",
  "sessionAdvice": "[Which session to trade today and the specific reason based on their win rate data. 1 sentence]",
  "todayGoal": "[One concrete, measurable improvement goal for today. Start with a verb. 1 sentence]",
  "warning": "[If there's a pattern risk to watch today — be specific. null if none]"
}`;

    const client     = groqClient();
    const completion = await client.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "system", content: systemPrompt }, { role: "user", content: context }],
      max_tokens:      450,
      temperature:     0.7,
      response_format: { type: "json_object" },
    });

    const raw     = completion.choices[0]?.message?.content ?? "{}";
    let briefing: Record<string, unknown> = {};
    try { briefing = JSON.parse(raw); } catch { briefing = {}; }

    res.json({
      ...briefing,
      generatedAt:  new Date().toISOString(),
      source:       "ai",
      rankScore,
      recentForm:   { wins: recentWins, losses: recentLosses, total: recent.length },
      bestSession:  bestSession  ? { label: bestSession.label,  winRate: Math.round(bestSession.winRate  * 10) / 10 } : null,
      worstSession: worstSession ? { label: worstSession.label, winRate: Math.round(worstSession.winRate * 10) / 10 } : null,
    });
  } catch (err) {
    logger.error(err, "trading-os/coach-briefing error");
    res.status(500).json({ error: "Coach temporarily unavailable." });
  }
});

/* ── GET /api/trading-os/weekly-report ───────────────────────────────────── */
router.get("/trading-os/weekly-report", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId  = res.locals["userId"] as number;
    const profile = await extractTraderProfile(userId);

    if (profile.backtestCount === 0) {
      res.status(400).json({ error: "Run at least one backtest to generate your weekly report." });
      return;
    }

    const { score: rankScore, breakdown } = computeRankScore(profile);
    const bestSession  = [...profile.sessionStats].sort((a, b) => b.winRate - a.winRate)[0];
    const worstSession = [...profile.sessionStats].sort((a, b) => a.winRate - b.winRate)[0];

    const context = `Generate a weekly performance report for this trader:
Win Rate: ${profile.avgWinRate.toFixed(1)}% | Sharpe: ${profile.avgSharpe.toFixed(2)} | Max Drawdown: ${profile.avgDrawdown.toFixed(1)}% | Avg Return: ${profile.avgReturn.toFixed(1)}%
Style: ${profile.traderStyle} | Rank Score: ${rankScore}/100 | Backtests: ${profile.backtestCount}
Best Session: ${bestSession?.label ?? "N/A"} (${bestSession?.winRate.toFixed(0) ?? "?"}% win rate)
Worst Session: ${worstSession?.label ?? "N/A"} (${worstSession?.winRate.toFixed(0) ?? "?"}% win rate)
Top Mistake: ${profile.journalMistakes[0]?.label ?? "None recorded"}
Best Strategy: ${profile.strategyStats[0]?.type ?? "N/A"} (${profile.strategyStats[0]?.avgWinRate.toFixed(0) ?? "?"}% avg win rate)`;

    const systemPrompt = `You are an institutional hedge fund performance analyst producing a weekly trader report. Write with authority, precision, and professionalism. Use specific data. Be constructive but honest.

Respond ONLY with this exact JSON:
{
  "headline": "[One powerful, specific headline that captures the week's performance story — 10 words max]",
  "performanceSummary": "[2 sentences on overall performance with specific numbers]",
  "strengthsFound": ["[specific strength with data]", "[another specific strength]"],
  "areasForImprovement": ["[specific weakness with data]", "[another area to improve]"],
  "psychologyNote": "[1 sentence identifying the most important psychological pattern this week]",
  "nextWeekFocus": "[The single most important thing to focus on next week — be specific]",
  "analystRating": "Underperforming | Neutral | Cautiously Optimistic | Outperforming"
}`;

    const client     = groqClient();
    const completion = await client.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "system", content: systemPrompt }, { role: "user", content: context }],
      max_tokens:      550,
      temperature:     0.6,
      response_format: { type: "json_object" },
    });

    const raw    = completion.choices[0]?.message?.content ?? "{}";
    let report: Record<string, unknown> = {};
    try { report = JSON.parse(raw); } catch { report = {}; }

    res.json({
      ...report,
      generatedAt: new Date().toISOString(),
      metrics: {
        winRate:      Math.round(profile.avgWinRate  * 10) / 10,
        sharpe:       Math.round(profile.avgSharpe   * 100) / 100,
        drawdown:     Math.round(profile.avgDrawdown * 10) / 10,
        avgReturn:    Math.round(profile.avgReturn   * 10) / 10,
        rankScore, breakdown,
        bestSession:  bestSession  ? { label: bestSession.label,  winRate: Math.round(bestSession.winRate  * 10) / 10 } : null,
        worstSession: worstSession ? { label: worstSession.label, winRate: Math.round(worstSession.winRate * 10) / 10 } : null,
        topMistake:   profile.journalMistakes[0] ?? null,
        traderStyle:  profile.traderStyle,
        backtestCount: profile.backtestCount,
      },
    });
  } catch (err) {
    logger.error(err, "trading-os/weekly-report error");
    res.status(500).json({ error: "Report generation failed." });
  }
});

/* ── GET /api/trading-os/missed-opportunities ────────────────────────────── */
router.get("/trading-os/missed-opportunities", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId  = res.locals["userId"] as number;
    const profile = await extractTraderProfile(userId);

    const wins   = profile.winningTrades;
    const losses = profile.losingTrades;

    const winsBySymbol: Record<string, typeof wins> = {};
    for (const t of wins) {
      if (!winsBySymbol[t.symbol]) winsBySymbol[t.symbol] = [];
      winsBySymbol[t.symbol].push(t);
    }

    const opportunities: Array<{
      type: string; title: string; description: string;
      potentialReturn: number; action: string;
    }> = [];

    for (const [sym, symWins] of Object.entries(winsBySymbol)) {
      const symLosses = losses.filter(t => t.symbol === sym);
      if (symLosses.length > 0 && symWins.length >= 2) {
        const avgWin = symWins.reduce((s, t) => s + t.pnlPercent, 0) / symWins.length;
        opportunities.push({
          type: "symbol_optimization",
          title: `${sym} Entry Precision`,
          description: `You have ${symWins.length} winning setups on ${sym} but also ${symLosses.length} losing entries. Optimizing your ${sym} entry conditions could unlock an average ${avgWin.toFixed(1)}% return per trade.`,
          potentialReturn: Math.round(avgWin * 100) / 100,
          action: `Review what made your ${symWins.length} winning ${sym} entries different from the ${symLosses.length} losing ones.`,
        });
      }
    }

    const stratsSorted = [...profile.strategyStats].sort((a, b) => b.avgWinRate - a.avgWinRate);
    const bestStrategy  = stratsSorted[0];
    const worstStrategy = stratsSorted[stratsSorted.length - 1];

    if (bestStrategy && worstStrategy && bestStrategy.type !== worstStrategy.type &&
        bestStrategy.avgWinRate - worstStrategy.avgWinRate > 10) {
      opportunities.push({
        type: "strategy_shift",
        title: `Reallocate to ${bestStrategy.type}`,
        description: `Your ${bestStrategy.type} strategy wins ${bestStrategy.avgWinRate.toFixed(0)}% vs ${worstStrategy.avgWinRate.toFixed(0)}% for ${worstStrategy.type}. Shifting effort to your best strategy type could significantly improve your overall win rate.`,
        potentialReturn: Math.round((bestStrategy.avgReturn - worstStrategy.avgReturn) * 10) / 10,
        action: `Run 5 more ${bestStrategy.type} backtests across different symbols to confirm the edge.`,
      });
    }

    const sessionsSorted = [...profile.sessionStats].sort((a, b) => b.winRate - a.winRate);
    const bestSession     = sessionsSorted[0];
    const worstSession    = sessionsSorted[sessionsSorted.length - 1];
    if (bestSession && worstSession && bestSession.winRate - worstSession.winRate > 20) {
      opportunities.push({
        type: "session_focus",
        title: `Focus on ${bestSession.label}`,
        description: `Your ${bestSession.label} win rate is ${bestSession.winRate.toFixed(0)}% vs ${worstSession.winRate.toFixed(0)}% in ${worstSession.label}. Concentrating on your strongest session could meaningfully lift your P&L.`,
        potentialReturn: Math.round((bestSession.avgPnlPct - worstSession.avgPnlPct) * 100) / 100,
        action: `Set ${worstSession.label} as a non-trading observation period and double down on ${bestSession.label} setups.`,
      });
    }

    const totalPotential = Math.round(
      opportunities.slice(0, 3).reduce((s, o) => s + Math.abs(o.potentialReturn ?? 0), 0) * 100,
    ) / 100;

    res.json({
      opportunities: opportunities.slice(0, 5),
      totalPotential,
      totalTrades:   profile.totalTrades,
      analysis:      `Based on your ${profile.totalTrades} historical trades, ${opportunities.length} optimization opportunities identified.`,
    });
  } catch (err) {
    logger.error(err, "trading-os/missed-opportunities error");
    res.status(500).json({ error: "Opportunity analysis failed." });
  }
});

/* ── GET /api/trading-os/ai-twin ─────────────────────────────────────────── */
router.post("/trading-os/ai-twin", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId  = res.locals["userId"] as number;
    const b       = req.body as Record<string, unknown>;
    const symbol  = typeof b["symbol"] === "string" ? b["symbol"] : "BTCUSDT";
    const side    = typeof b["side"]   === "string" ? b["side"]   : "long";
    const context = typeof b["context"] === "string" ? b["context"] : "";

    const profile = await extractTraderProfile(userId);

    if (profile.totalTrades < 5) {
      res.json({
        decision: "Insufficient Data",
        reasoning: "Your AI Twin needs at least 5 historical trades to learn your patterns. Run more backtests to train your Twin.",
        confidence: 0,
        alternative: null,
        twinPersonality: "Learning...",
      });
      return;
    }

    const symbolTrades = [...profile.winningTrades, ...profile.losingTrades]
      .filter(t => t.symbol === symbol && t.side === side);
    const symbolWinRate = symbolTrades.length > 0
      ? (symbolTrades.filter(t => t.pnl > 0).length / symbolTrades.length) * 100
      : profile.avgWinRate;

    const twinContext = `AI Twin Personality Profile:
Trading Style: ${profile.traderStyle} | Preferred Side: ${profile.preferredSide}
Overall Win Rate: ${profile.avgWinRate.toFixed(1)}% | Best Session: ${[...profile.sessionStats].sort((a,b) => b.winRate - a.winRate)[0]?.label ?? "N/A"}
On ${symbol} ${side} trades specifically: ${symbolTrades.length} trades, ${symbolWinRate.toFixed(0)}% win rate
Top mistake to avoid: ${profile.journalMistakes[0]?.label ?? "none recorded"}
Best strategy type: ${profile.strategyStats[0]?.type ?? "N/A"}

Current Trade Context: ${context || `${symbol} ${side} entry being considered`}`;

    const systemPrompt = `You are the trader's AI Trading Twin — a digital clone trained on their entire trading history. You think EXACTLY like them: same risk tolerance, same preferred setups, same psychological tendencies. You give a single, decisive pre-trade opinion.

Respond ONLY with this exact JSON:
{
  "decision": "Enter Now | Wait | Would Not Enter | Reduce Size",
  "reasoning": "[Exactly why based on their historical patterns — cite their stats. 2 sentences]",
  "confidence": [0-100 integer],
  "alternative": "[A specific alternative action if not entering now. null if entering]",
  "twinPersonality": "[One word describing how the twin sees this trader today: Disciplined/Cautious/Sharp/Aggressive/Patient]"
}`;

    const client     = groqClient();
    const completion = await client.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "system", content: systemPrompt }, { role: "user", content: twinContext }],
      max_tokens:      300,
      temperature:     0.5,
      response_format: { type: "json_object" },
    });

    const raw    = completion.choices[0]?.message?.content ?? "{}";
    let twin: Record<string, unknown> = {};
    try { twin = JSON.parse(raw); } catch { twin = {}; }

    res.json({ ...twin, symbolWinRate: Math.round(symbolWinRate * 10) / 10, symbolTradeCount: symbolTrades.length });
  } catch (err) {
    logger.error(err, "trading-os/ai-twin error");
    res.status(500).json({ error: "AI Twin analysis failed." });
  }
});

/* ── GET /api/trading-os/dashboard ────────────────────────────────────────── */
router.get("/trading-os/dashboard", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals["userId"] as number;
    const profile = await extractTraderProfile(userId);

    // ── Health Score ─────────────────────────────────────────────────────────
    const recent         = profile.recentTrades.slice(0, 10);
    const recentWins     = recent.filter(t => t.pnl > 0).length;
    const recentWinRate  = recent.length > 0 ? (recentWins / recent.length) * 100 : 50;
    const recentScore    = Math.round((recentWinRate / 100) * 30);
    const journalScore   = profile.journalMistakes.length > 0 ? 16 : 8;
    const totalMistakes  = profile.journalMistakes.reduce((s, m) => s + m.count, 0);
    const mistakeScore   = Math.max(0, 20 - Math.min(20, totalMistakes * 2));
    const riskScoreHS    = profile.avgDrawdown < 10 ? 15 : profile.avgDrawdown < 20 ? 10 : profile.avgDrawdown < 30 ? 5 : 2;
    const sharpeScore    = profile.avgSharpe >= 1.5 ? 15 : profile.avgSharpe >= 1 ? 10 : profile.avgSharpe >= 0.5 ? 6 : 2;
    const totalScore     = Math.min(100, recentScore + journalScore + Math.round(mistakeScore) + riskScoreHS + sharpeScore);
    const recommendation =
      totalScore >= 90 ? "In the zone. Trade at full confidence and size." :
      totalScore >= 75 ? "Strong mental state. Proceed normally." :
      totalScore >= 60 ? "Moderate form. Consider reducing position size 20%." :
      totalScore >= 40 ? "Below average form. Trade cautiously or step back." :
      "High risk day. Consider sitting today out entirely.";
    const riskMultiplier = totalScore >= 75 ? 1.0 : totalScore >= 60 ? 0.8 : totalScore >= 40 ? 0.5 : 0.25;
    const statusColor    = totalScore >= 75 ? "#22c55e" : totalScore >= 55 ? "#f59e0b" : "#ef4444";

    // ── Rank ─────────────────────────────────────────────────────────────────
    const { score: rankScore, breakdown: rankBreakdown } = computeRankScore(profile);
    const currentRank = [...RANKS].filter(r => rankScore >= r.min).pop()!;
    const nextRank    = RANKS.find(r => r.min > rankScore) ?? null;
    const pctToNext   = nextRank
      ? Math.round(((rankScore - currentRank.min) / (nextRank.min - currentRank.min)) * 100)
      : 100;
    const achievements = [
      { id: "first_bt",   label: "First Backtest", earned: profile.backtestCount >= 1,                               icon: "🚀" },
      { id: "ten_bt",     label: "10 Backtests",    earned: profile.backtestCount >= 10,                             icon: "📊" },
      { id: "win50",      label: "50% Win Rate",    earned: profile.avgWinRate >= 50,                                icon: "🎯" },
      { id: "win65",      label: "65% Win Rate",    earned: profile.avgWinRate >= 65,                                icon: "🔥" },
      { id: "risk10",     label: "Low Drawdown",    earned: profile.avgDrawdown > 0 && profile.avgDrawdown < 10,     icon: "🛡" },
      { id: "journaled",  label: "Journaled Trades",earned: profile.journalMistakes.length > 0,                      icon: "📝" },
      { id: "sharpe1",    label: "Sharpe > 1",      earned: profile.avgSharpe >= 1,                                  icon: "⚡" },
      { id: "consistent", label: "3+ Strategies",   earned: profile.strategyStats.length >= 3,                      icon: "💡" },
    ];

    res.json({
      healthScore: {
        score:             Math.round(totalScore),
        recommendation,
        riskMultiplier,
        statusColor,
        breakdown: {
          recentPerformance:  recentScore,
          journalConsistency: journalScore,
          mistakeDiscipline:  Math.round(mistakeScore),
          riskControl:        riskScoreHS,
          sharpeQuality:      sharpeScore,
        },
        recentWinRate:    Math.round(recentWinRate * 10) / 10,
        recentTradeCount: recent.length,
      },
      rank: {
        score: rankScore, breakdown: rankBreakdown, achievements,
        rank: currentRank, nextRank, pctToNext,
        profile: {
          totalTrades:   profile.totalTrades,
          avgWinRate:    Math.round(profile.avgWinRate * 10) / 10,
          avgDrawdown:   Math.round(profile.avgDrawdown * 10) / 10,
          traderStyle:   profile.traderStyle,
          backtestCount: profile.backtestCount,
        },
      },
    });
  } catch (err) {
    logger.error(err, "trading-os/dashboard error");
    res.status(500).json({ error: "Failed to load dashboard." });
  }
});

export default router;
