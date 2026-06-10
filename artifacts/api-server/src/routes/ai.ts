import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import OpenAI from "openai";
import { verifyJwt } from "../lib/jwt";
import { logger } from "../lib/logger";
import { db, subscriptionsTable, subscriptionPlansTable, aiUsageTable, backtestsTable, paperTradesTable, tradesTable, journalEntriesTable, traderPatternsTable, twinProfileTable, coachCacheTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { extractTraderProfile } from "../lib/pattern-extractor";

const JWT_SECRET_AI = process.env.JWT_SECRET ?? "";

const router: IRouter = Router();

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth || !JWT_SECRET_AI) return null;
    const token = auth.replace("Bearer ", "").trim();
    const payload = verifyJwt(token, JWT_SECRET_AI);
    return typeof payload?.id === "number" ? payload.id : null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!extractUserId(req)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

const aiRateLimit = new Map<number, { count: number; resetAt: number }>();

function checkAiRateLimit(userId: number): boolean {
  const now = Date.now();
  const rec = aiRateLimit.get(userId);
  if (!rec || now >= rec.resetAt) {
    aiRateLimit.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (rec.count >= 20) return false;
  rec.count++;
  return true;
}

async function checkAiPlanLimit(userId: number): Promise<{ allowed: boolean; error?: string }> {
  let dailyLimit = 0; // Default to deny — will be overridden by the plan record

  try {
    const [activeSub] = await db
      .select({ planId: subscriptionsTable.planId })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (activeSub) {
      const [plan] = await db
        .select({ features: subscriptionPlansTable.features })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, activeSub.planId))
        .limit(1);
      const lim = (plan?.features as { aiQueriesPerDay?: number } | null)?.aiQueriesPerDay;
      if (lim === -1) return { allowed: true }; // Unlimited (Elite)
      if (typeof lim === "number") dailyLimit = lim;
      else dailyLimit = 50; // Paid plan fallback
    } else {
      // No active subscription — look up the default (free) plan
      const [freePlan] = await db
        .select({ features: subscriptionPlansTable.features })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.isDefault, true))
        .limit(1);
      const lim = (freePlan?.features as { aiQueriesPerDay?: number } | null)?.aiQueriesPerDay;
      if (typeof lim === "number") dailyLimit = lim;
      else dailyLimit = 0; // Deny if no free plan found
    }
  } catch {
    return { allowed: true }; // Allow through on DB error
  }

  if (dailyLimit === 0) {
    return {
      allowed: false,
      error: "AI access requires a Pro or Elite plan. Upgrade to unlock AI features.",
    };
  }

  // DB-backed daily counter — survives server restarts and deploys
  const today = new Date().toISOString().split("T")[0]!;
  try {
    const [usageRec] = await db
      .select({ count: aiUsageTable.count })
      .from(aiUsageTable)
      .where(and(eq(aiUsageTable.userId, userId), eq(aiUsageTable.date, today)))
      .limit(1);

    const currentCount = usageRec?.count ?? 0;
    if (currentCount >= dailyLimit) {
      return {
        allowed: false,
        error: `Daily AI limit reached (${dailyLimit} queries/day). Upgrade your plan for more AI access.`,
      };
    }

    // Upsert: insert first use or increment existing
    if (!usageRec) {
      await db.insert(aiUsageTable).values({ userId, date: today, count: 1 });
    } else {
      await db.update(aiUsageTable)
        .set({ count: currentCount + 1 })
        .where(and(eq(aiUsageTable.userId, userId), eq(aiUsageTable.date, today)));
    }
  } catch {
    // Allow through on DB error — don't block users due to tracking failure
    return { allowed: true };
  }

  return { allowed: true };
}

async function requirePlanAiAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = extractUserId(req);
  if (!userId) { next(); return; } // requireAuth handles unauthenticated
  const check = await checkAiPlanLimit(userId);
  if (!check.allowed) {
    res.status(403).json({ error: check.error, limitReached: true });
    return;
  }
  next();
}

function groqClient(): OpenAI {
  const apiKey = process.env["GROQ_API_KEY"] ?? "";
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
}

const SYSTEM_PROMPT = `You are an expert trading and financial markets educator. Help users learn about:
- Trading strategies (momentum, mean reversion, breakout, swing, scalping, etc.)
- Technical analysis (chart patterns, candlesticks, support/resistance, indicators)
- Risk management (position sizing, stop-loss, risk/reward ratios)
- Market dynamics (liquidity, volatility, market structure)
- Financial instruments (crypto, forex, stocks, indices, commodities, futures)
- Fundamental analysis concepts
Keep responses concise but informative (2–4 paragraphs max). Use clear examples where helpful. Do not give specific investment advice or price predictions.`;

// Apply plan-level daily limit to all AI routes (scoped to /ai/* only)
router.use("/ai", requirePlanAiAccess);

/* ─── Chat ────────────────────────────────────────────────────────────────── */
router.post("/ai/chat", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Too many AI requests. Please wait a moment before trying again." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "Groq API key is not configured." });
    return;
  }

  const { messages } = req.body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const message = completion.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    res.json({ message });
  } catch (err) {
    logger.error(err, "ai/chat error");
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

/* ─── Trade Autopsy ───────────────────────────────────────────────────────── */
router.post("/ai/autopsy", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { symbol, strategyName, metrics, trades } = req.body as {
    symbol: string;
    strategyName: string;
    metrics: {
      totalReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
      winRate: number;
      totalTrades: number;
      bestTrade: number;
      worstTrade: number;
      profitFactor: number;
      avgTradeDuration: number;
    };
    trades: Array<{
      side: string;
      entryDate: string;
      exitDate: string;
      entryPrice: number;
      exitPrice: number;
      pnl: number;
      pnlPercent: number;
    }>;
  };

  if (!symbol || !trades?.length) {
    res.status(400).json({ error: "symbol and trades are required" });
    return;
  }

  const topTrades = [...trades]
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 6);

  const tradeLines = topTrades.map(t =>
    `  • ${t.side.toUpperCase()} | Entry: ${t.entryDate} @ $${t.entryPrice.toFixed(2)} → Exit: ${t.exitDate} @ $${t.exitPrice.toFixed(2)} | P&L: ${t.pnl >= 0 ? "+" : ""}${t.pnlPercent.toFixed(2)}% ($${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)})`
  ).join("\n");

  const systemPrompt = `You are an elite quantitative trading analyst and compelling financial storyteller. Write a rich, specific narrative autopsy of a backtest — like a hedge fund PM reviewing results with a junior analyst. Use the actual numbers. Be honest about weaknesses. 4–5 paragraphs.`;

  const userPrompt = `Write a trade autopsy narrative for this backtest:

STRATEGY: ${strategyName || "Unknown"} on ${symbol}

PERFORMANCE METRICS:
  • Total Return: ${metrics.totalReturn >= 0 ? "+" : ""}${metrics.totalReturn.toFixed(2)}%
  • Annualized Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%
  • Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
  • Win Rate: ${metrics.winRate.toFixed(1)}%
  • Total Trades: ${metrics.totalTrades}
  • Profit Factor: ${metrics.profitFactor.toFixed(2)}
  • Best Trade: +${metrics.bestTrade.toFixed(2)}%
  • Worst Trade: ${metrics.worstTrade.toFixed(2)}%
  • Avg Trade Duration: ~${Math.round(metrics.avgTradeDuration)} days

MOST IMPACTFUL TRADES:
${tradeLines}

Your narrative should:
1. Open with a one-sentence verdict on the strategy's overall performance
2. Explain what the win rate and profit factor reveal about the strategy's edge (or lack thereof)
3. Analyze the best and worst trades — what market conditions likely caused them
4. Assess the risk profile: is the drawdown acceptable given the returns?
5. Close with a sharp, actionable verdict: does this strategy have a real edge, or is it noise?`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.72,
    });
    const narrative = completion.choices[0]?.message?.content ?? "Unable to generate autopsy.";
    res.json({ narrative });
  } catch (err) {
    logger.error(err, "ai/autopsy error");
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

/* ─── Natural Language Strategy Builder ──────────────────────────────────── */
router.post("/ai/build-strategy", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { description } = req.body as { description: string };
  if (!description?.trim()) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const systemPrompt = `You are a trading strategy parser. Convert natural language strategy descriptions into structured JSON. Respond with ONLY valid JSON — no markdown, no code fences, no explanation outside the JSON.

Available strategy types and their valid parameters:
- "sma_crossover":     { "fastPeriod": integer 5–50, "slowPeriod": integer 20–200 }
- "ema_crossover":     { "fastPeriod": integer 5–50, "slowPeriod": integer 20–200 }
- "rsi":               { "period": integer 7–21, "overbought": integer 60–80, "oversold": integer 20–40 }
- "macd":              { "fastPeriod": integer 8–15, "slowPeriod": integer 20–30, "signalPeriod": integer 7–12 }
- "bollinger_bands":   { "period": integer 10–30, "stdDev": number 1.5–3.0 }
- "super_trend":       { "period": integer 7–20, "multiplier": number 2.0–5.0 }
- "breakout":          { "entryPeriod": integer 10–50, "exitPeriod": integer 5–25 }
- "vwap":              { "rsiPeriod": integer 7–21, "oversold": integer 30–55 }
- "macd_rsi":          { "fastPeriod": integer 8–15, "slowPeriod": integer 20–30, "signalPeriod": integer 7–12, "rsiPeriod": integer 7–21, "rsiOverbought": integer 60–80 }
- "donchian_breakout": { "entryPeriod": integer 10–55, "exitPeriod": integer 5–25 }
- "bollinger_reversal":{ "period": integer 10–30, "stdDev": number 1.5–3.0 }
- "orb":               { "rangePeriod": integer 3–15, "holdDays": integer 5–30 }
- "trend_following":   { "fastEma": integer 20–100, "slowEma": integer 100–300, "rsiPeriod": integer 7–21 }
- "golden_cross":      { "fastPeriod": integer 30–75, "slowPeriod": integer 150–250 }
- "turtle_trading":    { "entryPeriod": integer 10–55, "exitPeriod": integer 5–25 }

Available symbols: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, LINKUSDT, AVAXUSDT, AAPL, MSFT, TSLA, NVDA, SPY

Response shape (use exactly these keys):
{
  "type": "<strategy type from list above>",
  "name": "<descriptive name, max 48 chars>",
  "symbol": "<symbol from list above>",
  "timeframe": "1d",
  "parameters": { <valid params for the chosen type> },
  "reasoning": "<2–3 sentences explaining why this mapping was chosen and what the strategy does>"
}`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: description },
      ],
      max_tokens: 450,
      temperature: 0.25,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    logger.error(err, "ai/build-strategy error");
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

/* ─── Behavioral Bias Detector ────────────────────────────────────────────── */
router.post("/ai/bias-report", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { trades } = req.body as {
    trades: Array<{
      isWin: boolean;
      pnlPct: number;
      holdingHours: number;
      side: string;
    }>;
  };

  if (!Array.isArray(trades) || trades.length < 3) {
    res.status(400).json({ error: "At least 3 closed trades are required for a bias analysis." });
    return;
  }

  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);
  const avgWinHold = wins.length ? wins.reduce((s, t) => s + t.holdingHours, 0) / wins.length : 0;
  const avgLossHold = losses.length ? losses.reduce((s, t) => s + t.holdingHours, 0) / losses.length : 0;
  const avgWinPct = wins.length ? wins.reduce((s, t) => s + Math.abs(t.pnlPct), 0) / wins.length : 0;
  const avgLossPct = losses.length ? losses.reduce((s, t) => s + Math.abs(t.pnlPct), 0) / losses.length : 0;
  const winRate = (wins.length / trades.length) * 100;
  const sequence = trades.slice(-30).map(t => (t.isWin ? "W" : "L")).join("");

  // Detect consecutive loss clusters (revenge trading signal)
  const lossStreaks = (sequence.match(/L{3,}/g) || []).length;
  const winAfterLoss = (sequence.match(/LW/g) || []).length;
  const lossAfterLoss = (sequence.match(/LL/g) || []).length;

  const systemPrompt = `You are a trading psychology expert and behavioral finance analyst. Analyze paper trading statistics to detect cognitive biases. Respond with ONLY valid JSON — no markdown or explanation outside the JSON.

Response format:
{
  "score": <integer 0–100, where 100 = perfectly disciplined, 0 = highly biased>,
  "summary": "<2–3 sentence overall psychological profile>",
  "biases": [
    {
      "name": "<bias name>",
      "severity": "low" | "medium" | "high",
      "description": "<what this bias is and how it manifests>",
      "evidence": "<specific statistics from their trades that reveal this bias>",
      "tip": "<one concrete, actionable tip to overcome this bias>"
    }
  ]
}

Identify 2–4 biases. If the data shows healthy trading psychology, reflect that honestly with a high score and fewer biases.`;

  const userPrompt = `Analyze these paper trading stats:

Total trades: ${trades.length}
Win rate: ${winRate.toFixed(1)}%
Avg winning trade: +${avgWinPct.toFixed(2)}%
Avg losing trade: -${avgLossPct.toFixed(2)}%
Avg holding time (winners): ${avgWinHold.toFixed(1)} hours
Avg holding time (losers): ${avgLossHold.toFixed(1)} hours
Loser/winner hold ratio: ${avgWinHold > 0 ? (avgLossHold / avgWinHold).toFixed(2) : "N/A"}x

Recent trade sequence (W=win, L=loss): ${sequence}
Consecutive loss streaks (3+): ${lossStreaks}
Wins immediately after a loss: ${winAfterLoss}
Losses immediately after a loss: ${lossAfterLoss}

Key bias signals to check:
- Loss Aversion: losers held ${(avgLossHold / Math.max(avgWinHold, 0.1)).toFixed(1)}x longer than winners
- Cutting Winners Early: avg win (${avgWinPct.toFixed(2)}%) vs avg loss (${avgLossPct.toFixed(2)}%)
- Revenge Trading: ${lossStreaks} streak(s) of 3+ consecutive losses
- Overconfidence: win rate ${winRate.toFixed(1)}% — is it sustainable?`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.35,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    logger.error(err, "ai/bias-report error");
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

/* ─── Narrative Mode ──────────────────────────────────────────────────────── */
router.post("/ai/narrative", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { symbol, strategyName, strategyType, startDate, endDate, metrics, trades, equityPeaks } = req.body as {
    symbol: string;
    strategyName: string;
    strategyType: string;
    startDate: string;
    endDate: string;
    metrics: {
      totalReturn: number;
      annualizedReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
      winRate: number;
      totalTrades: number;
      profitFactor: number;
      initialCapital: number;
      finalCapital: number;
    };
    trades: Array<{
      side: string;
      entryDate: string;
      exitDate: string;
      entryPrice: number;
      exitPrice: number;
      pnl: number;
      pnlPercent: number;
      holdingDays: number;
    }>;
    equityPeaks?: { peakDate: string; troughDate: string; drawdownPct: number; recoveryDays: number | null }[];
  };

  if (!symbol || !trades?.length) {
    res.status(400).json({ error: "symbol and trades are required" });
    return;
  }

  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl <= 0);
  const avgHoldWin = winners.length ? (winners.reduce((s, t) => s + t.holdingDays, 0) / winners.length).toFixed(1) : "N/A";
  const avgHoldLoss = losers.length ? (losers.reduce((s, t) => s + t.holdingDays, 0) / losers.length).toFixed(1) : "N/A";
  const bestTrade = [...trades].sort((a, b) => b.pnlPercent - a.pnlPercent)[0];
  const worstTrade = [...trades].sort((a, b) => a.pnlPercent - b.pnlPercent)[0];

  const topTrades = [...trades]
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 5)
    .map(t => `  • ${t.side.toUpperCase()} ${t.entryDate}→${t.exitDate} (${t.holdingDays}d) @ $${t.entryPrice.toFixed(2)}→$${t.exitPrice.toFixed(2)} | ${t.pnl >= 0 ? "+" : ""}${t.pnlPercent.toFixed(2)}%`)
    .join("\n");

  const peakLines = equityPeaks?.length
    ? equityPeaks.map(p => `  • Peak→Trough ${p.peakDate}→${p.troughDate}: -${p.drawdownPct.toFixed(1)}% drawdown, ${p.recoveryDays !== null ? `recovered in ${p.recoveryDays} days` : "not yet recovered"}`).join("\n")
    : "  No major drawdown periods identified";

  const systemPrompt = `You are a master financial storyteller — think Michael Lewis meets a quantitative analyst. Convert a dry backtest report into a compelling, vivid narrative. Write in present-tense, active voice, as if narrating events as they unfolded. Use SPECIFIC dates, prices, and numbers from the data. Structure your story in exactly 4 chapters, each as a paragraph:

Chapter 1 — "Setting the Stage": Describe the asset, strategy, time period, and what the trader was trying to achieve.
Chapter 2 — "The Campaign": Walk through how the strategy played out month by month, referencing key turning points.
Chapter 3 — "Moments of Truth": Narrate the best and worst trades — what market conditions caused them.  
Chapter 4 — "The Verdict": Give an honest, sharp assessment of whether this strategy has a real edge.

Use vivid language but stay factually grounded in the exact numbers provided. Keep it to ~500 words total.`;

  const userPrompt = `Write a backtest narrative story for:

STRATEGY: "${strategyName}" (${strategyType}) on ${symbol}
PERIOD: ${startDate} → ${endDate}

RESULTS:
  Capital: $${metrics.initialCapital.toLocaleString()} → $${metrics.finalCapital.toLocaleString()} (${metrics.totalReturn >= 0 ? "+" : ""}${metrics.totalReturn.toFixed(2)}%)
  Annualized Return: ${metrics.annualizedReturn >= 0 ? "+" : ""}${metrics.annualizedReturn.toFixed(2)}%
  Max Drawdown: -${metrics.maxDrawdown.toFixed(2)}%
  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
  Win Rate: ${metrics.winRate.toFixed(1)}% (${winners.length}W / ${losers.length}L out of ${trades.length} trades)
  Profit Factor: ${metrics.profitFactor.toFixed(2)}
  Avg hold: winners ${avgHoldWin}d, losers ${avgHoldLoss}d
  Best trade: +${bestTrade?.pnlPercent.toFixed(2)}% on ${bestTrade?.entryDate}
  Worst trade: ${worstTrade?.pnlPercent.toFixed(2)}% on ${worstTrade?.entryDate}

DRAWDOWN PERIODS:
${peakLines}

MOST IMPACTFUL TRADES:
${topTrades}`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 900,
      temperature: 0.78,
    });
    const story = completion.choices[0]?.message?.content ?? "Unable to generate story.";
    res.json({ story });
  } catch (err) {
    logger.error(err, "ai/narrative error");
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

/* ─── Psychology-Matched Strategy Recommendations ─────────────────────────── */
router.post("/ai/psych-match", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { profile } = req.body as {
    profile: {
      totalTrades: number;
      winRate: number;
      avgHoldingDays: number;
      avgWinPct: number;
      avgLossPct: number;
      profitFactor: number;
      maxConsecutiveLosses: number;
      avgTradesPerBacktest: number;
      preferredSymbols: string[];
      lossToleranceRatio: number;
      backtestCount: number;
    };
  };

  if (!profile || profile.totalTrades < 3) {
    res.status(400).json({ error: "Not enough trading history. Run at least one backtest with trades to get recommendations." });
    return;
  }

  const systemPrompt = `You are an elite trading psychology coach and strategy matchmaker. Based on a trader's behavioral pattern from their paper trading history, diagnose their trading personality and recommend the best-fit strategy types. Respond with ONLY valid JSON — no markdown, no explanation outside JSON.

Available strategy types:
- "sma_crossover": Trend-following, slow signals, large moves, low trade frequency. Best for patient traders who hate false signals.
- "ema_crossover": Faster trend following, more responsive. Good for traders who want trend riding with tighter signals.
- "rsi": Mean reversion, counter-trend. Best for disciplined contrarians who can hold through pullbacks.
- "macd": Momentum + trend confirmation. Balanced approach for traders who want both trend and momentum signals.
- "bollinger_bands": Volatility-based, range and breakout hybrid. Good for traders who want defined entry/exit levels.

Response format:
{
  "personalityType": "<one of: Trend Rider | Momentum Hunter | Patient Contrarian | Disciplined Ranger | Reactive Scalper>",
  "personalityDescription": "<2-3 sentence vivid description of this trader's psychological profile based on their data>",
  "dominantTraits": ["<trait 1>", "<trait 2>", "<trait 3>"],
  "recommendations": [
    {
      "strategyType": "<type from list>",
      "fitScore": <integer 60–100>,
      "fitLabel": "<Perfect Fit | Strong Match | Good Match>",
      "reason": "<2 sentences explaining why this matches their psychology based on their specific stats>",
      "suggestedParams": { <specific parameter values for this strategy type> },
      "warning": "<one sentence about the risk or mismatch to watch for>"
    }
  ],
  "redFlags": ["<behavior 1 to avoid>", "<behavior 2>"],
  "coachingTip": "<one actionable, concrete coaching tip tailored to their specific stats>"
}

Include 2-3 recommendations ordered by fit score (highest first).`;

  const p = profile;
  const holdProfile = p.avgHoldingDays < 3 ? "very short-term (< 3 days)"
    : p.avgHoldingDays < 10 ? "short-term (3–10 days)"
    : p.avgHoldingDays < 30 ? "medium-term (10–30 days)"
    : "long-term (30+ days)";

  const lossProfile = p.lossToleranceRatio < 0.5 ? "very low loss tolerance (cuts losses quickly)"
    : p.lossToleranceRatio < 1.0 ? "moderate loss tolerance"
    : "high loss tolerance (lets losses run)";

  const userPrompt = `Analyze this trader's behavioral profile:

Total trades: ${p.totalTrades} across ${p.backtestCount} backtests
Win rate: ${p.winRate.toFixed(1)}%
Avg holding time: ${p.avgHoldingDays.toFixed(1)} days (${holdProfile})
Avg winner: +${p.avgWinPct.toFixed(2)}% | Avg loser: -${p.avgLossPct.toFixed(2)}%
Win/Loss size ratio: ${(p.avgWinPct / Math.max(p.avgLossPct, 0.01)).toFixed(2)}x (winners vs. losers)
Profit factor: ${p.profitFactor.toFixed(2)}
Max consecutive losses: ${p.maxConsecutiveLosses}
Avg trades per backtest: ${p.avgTradesPerBacktest.toFixed(1)}
Loss tolerance: ${lossProfile} (ratio: ${p.lossToleranceRatio.toFixed(2)})
Preferred assets: ${p.preferredSymbols.slice(0, 4).join(", ") || "unknown"}

Diagnose this trader's personality type and recommend the 2-3 strategy types that best match their psychological profile.`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    logger.error(err, "ai/psych-match error");
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

router.post("/ai/analyze-trade", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    return;
  }
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { trade, context } = req.body as {
    trade: {
      side: string;
      entryDate: string;
      exitDate: string;
      entryPrice: number;
      exitPrice: number;
      pnl: number;
      pnlPercent: number;
    };
    context: {
      symbol: string;
      strategyName: string;
      strategyType: string;
      winRate: number;
      totalReturn: number;
    };
  };

  if (!trade || !context?.symbol) {
    res.status(400).json({ error: "trade and context.symbol are required" });
    return;
  }

  const outcome = trade.pnl >= 0 ? "winning" : "losing";
  const sign = trade.pnl >= 0 ? "+" : "";
  const durationDays = Math.max(1, Math.round(
    (new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime()) / 86400000
  ));

  const systemPrompt = `You are an expert trading coach giving a crisp, actionable post-trade review for a retail trader. Be direct, specific, and educational. No fluff.`;

  const userPrompt = `Review this individual ${outcome} trade:

Strategy: ${context.strategyName} (${context.strategyType}) on ${context.symbol}
Side: ${trade.side.toUpperCase()}
Entry: ${trade.entryDate} @ $${Number(trade.entryPrice).toFixed(2)}
Exit:  ${trade.exitDate}  @ $${Number(trade.exitPrice).toFixed(2)}
P&L:   ${sign}${Number(trade.pnlPercent).toFixed(2)}% (${sign}$${Number(trade.pnl).toFixed(2)})
Duration: ${durationDays} day${durationDays !== 1 ? "s" : ""}
Strategy context: ${Number(context.winRate).toFixed(1)}% win rate, ${sign}${Number(context.totalReturn).toFixed(2)}% total return

In 2-3 sentences explain: (1) why this trade ${trade.pnl >= 0 ? "succeeded" : "failed"}, (2) what market condition it likely encountered, and (3) one specific takeaway for the trader.`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 220,
      temperature: 0.65,
    });
    const analysis = completion.choices[0]?.message?.content?.trim() ?? "Unable to generate analysis.";
    res.json({ analysis });
  } catch (err) {
    logger.error(err, "ai/analyze-trade error");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

/* ─── Strategy DNA Narrative ───────────────────────────────────────────────── */
router.post("/ai/dna-narrative", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Too many requests. Please wait a moment." });
    return;
  }

  const { strategyName, strategyType, dna, grade, overallScore, metrics } = req.body as {
    strategyName: string;
    strategyType: string;
    dna: { momentum: number; meanReversion: number; riskControl: number; consistency: number; adaptability: number; profitability: number };
    grade: string;
    overallScore: number;
    metrics: { totalReturn?: number; sharpeRatio?: number; maxDrawdown?: number; winRate?: number; profitFactor?: number; totalTrades?: number };
  };

  if (!strategyName || !dna) {
    res.status(400).json({ error: "strategyName and dna are required" });
    return;
  }

  const typeFmt = (strategyType ?? "").replace(/_/g, " ");
  const m = metrics ?? {};

  const userPrompt = `Analyze this trading strategy's behavioral DNA profile and provide a concise, structured assessment.

Strategy: "${strategyName}" (${typeFmt})
Overall Grade: ${grade} (${overallScore}/100)

DNA Dimensions (0-100):
- Momentum: ${dna.momentum}
- Mean Reversion: ${dna.meanReversion}
- Risk Control: ${dna.riskControl}
- Consistency: ${dna.consistency}
- Adaptability: ${dna.adaptability}
- Profitability: ${dna.profitability}

Backtest Metrics:
- Total Return: ${m.totalReturn != null ? m.totalReturn.toFixed(2) + "%" : "N/A"}
- Sharpe Ratio: ${m.sharpeRatio != null ? m.sharpeRatio.toFixed(2) : "N/A"}
- Max Drawdown: ${m.maxDrawdown != null ? m.maxDrawdown.toFixed(2) + "%" : "N/A"}
- Win Rate: ${m.winRate != null ? m.winRate.toFixed(1) + "%" : "N/A"}
- Profit Factor: ${m.profitFactor != null ? m.profitFactor.toFixed(2) : "N/A"}
- Total Trades: ${m.totalTrades ?? "N/A"}

Respond with a JSON object containing these exact fields:
{
  "summary": "2-3 sentence behavioral narrative explaining this strategy's personality and trading style",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "bestMarkets": ["market condition 1", "market condition 2"],
  "worstMarkets": ["market condition 1"],
  "improvementTip": "One specific, actionable tip to improve this strategy's weakest dimension"
}`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an expert quantitative trading analyst. Analyze strategy behavioral DNA profiles and return concise, actionable insights as JSON." },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.5,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err) {
    logger.error(err, "ai/dna-narrative error");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

/* ─── Position Analysis ───────────────────────────────────────────────────── */
router.post("/ai/analyze-position", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { side, entry, stopLoss, takeProfit, symbol, riskPct, rewardPct, rrRatio } = req.body as {
    side: string; entry: number; stopLoss: number; takeProfit: number;
    symbol: string; riskPct: string; rewardPct: string; rrRatio: string;
  };

  if (!side || !entry || !stopLoss || !takeProfit) {
    res.status(400).json({ error: "side, entry, stopLoss, takeProfit are required" });
    return;
  }

  const direction  = side === "long" ? "LONG" : "SHORT";
  const stopDist   = Math.abs(entry - stopLoss);
  const stopDistPct = ((stopDist / entry) * 100).toFixed(2);

  const prompt = `Analyze this ${direction} trade setup on ${symbol}:
Entry: $${entry}
Stop Loss: $${stopLoss} (${stopDistPct}% away)
Take Profit: $${takeProfit}
Risk: ${riskPct}% | Reward: ${rewardPct}% | R:R = 1:${rrRatio}

Give a concise analysis as exactly 4 bullet points (each starting with •), covering:
1. R:R quality (poor/fair/good/excellent and why)
2. Stop loss placement (too tight/reasonable/wide for typical ${symbol} volatility)
3. Take profit assessment (conservative/realistic/aggressive)
4. Overall verdict (1 sentence: should the trader take this setup?)

Keep each bullet under 18 words. No preamble, just the 4 bullets.`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a concise, experienced trading coach. Give direct, practical feedback on trade setups." },
        { role: "user", content: prompt },
      ],
      max_tokens: 280,
      temperature: 0.4,
    });
    const analysis = completion.choices[0]?.message?.content ?? "Unable to analyze position.";
    res.json({ analysis });
  } catch (err) {
    logger.error(err, "ai/analyze-position error");
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

/* ─── Coaching Insights ────────────────────────────────────────────────────── */
router.get("/ai/coaching-insights", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;

  const [backtests, btTrades, journals] = await Promise.all([
    db.select()
      .from(backtestsTable)
      .where(and(eq(backtestsTable.userId, userId), eq(backtestsTable.status, "complete")))
      .orderBy(desc(backtestsTable.createdAt))
      .limit(30),
    db.select({
      entryDate: tradesTable.entryDate,
      exitDate: tradesTable.exitDate,
    })
      .from(tradesTable)
      .innerJoin(backtestsTable, eq(tradesTable.backtestId, backtestsTable.id))
      .where(eq(backtestsTable.userId, userId))
      .limit(500),
    db.select({ mistakes: journalEntriesTable.mistakes, emotionPre: journalEntriesTable.emotionPre })
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId))
      .limit(100),
  ]);

  if (backtests.length < 3) {
    res.json({
      traderScore: 0,
      traderStyle: "Undefined",
      traderStyleColor: "#6b7280",
      avgHoldingDays: 0,
      backtestCount: backtests.length,
      avgWinRate: 0,
      avgSharpe: 0,
      avgDrawdown: 0,
      avgProfitFactor: 0,
      journalMistakes: [],
      mistakes: [],
      tips: [
        backtests.length === 0
          ? "Run your first backtest to get personalized coaching insights."
          : `Run ${3 - backtests.length} more backtest${3 - backtests.length > 1 ? "s" : ""} to unlock personalized coaching insights.`,
      ],
      hasData: false,
    });
    return;
  }

  const avgOf = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgWinRate  = avgOf(backtests.map(b => Number(b.winRate ?? 0)));
  const avgSharpe   = avgOf(backtests.map(b => Number(b.sharpeRatio ?? 0)));
  const avgDD       = avgOf(backtests.map(b => Number(b.maxDrawdown ?? 0)));
  const avgPF       = avgOf(backtests.map(b => Number(b.profitFactor ?? 0)));
  const avgReturn   = avgOf(backtests.map(b => Number(b.totalReturn ?? 0)));

  const avgHoldingDays = btTrades.length > 0
    ? avgOf(btTrades.map(t => {
        const entry = new Date(t.entryDate).getTime();
        const exit  = new Date(t.exitDate).getTime();
        return Math.max(0, (exit - entry) / 86400000);
      }))
    : 0;

  let traderStyle = "Developing";
  let traderStyleColor = "#f59e0b";
  if (avgHoldingDays < 1)       { traderStyle = "Scalper";          traderStyleColor = "#ef4444"; }
  else if (avgHoldingDays < 7)  { traderStyle = "Swing Trader";     traderStyleColor = "#22c55e"; }
  else if (avgHoldingDays < 30) { traderStyle = "Position Trader";  traderStyleColor = "#3b82f6"; }
  else                          { traderStyle = "Long-Term Investor"; traderStyleColor = "#a855f7"; }

  const journalMistakeCounts: Record<string, number> = {};
  for (const j of journals) {
    const arr = j.mistakes as string[] | null;
    if (arr) for (const m of arr) journalMistakeCounts[m] = (journalMistakeCounts[m] ?? 0) + 1;
  }
  const journalMistakes = Object.entries(journalMistakeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }));

  let score = 50;
  score += Math.min(20, (avgWinRate - 50) * 0.4);
  score += Math.min(20, avgSharpe * 10);
  score -= Math.min(20, avgDD * 0.6);
  score += Math.min(15, (avgPF - 1) * 8);
  score += Math.min(10, backtests.length * 1.5);
  score += Math.min(5, avgReturn * 0.1);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const mistakes: { label: string; severity: "high" | "medium" | "low"; detail: string }[] = [];
  if (avgWinRate < 40 && backtests.length >= 2)
    mistakes.push({ label: "Low Win Rate", severity: "high", detail: `Your average win rate is ${avgWinRate.toFixed(1)}%. Aim for 50%+ for consistent profitability.` });
  if (avgDD > 20)
    mistakes.push({ label: "Excessive Drawdown", severity: "high", detail: `Average max drawdown of ${avgDD.toFixed(1)}% suggests insufficient risk control. Target <15%.` });
  if (avgSharpe < 0.5 && avgSharpe !== 0)
    mistakes.push({ label: "Poor Risk-Adjusted Returns", severity: "medium", detail: `Sharpe ratio of ${avgSharpe.toFixed(2)} indicates high risk relative to returns. Aim for >1.0.` });
  if (avgPF < 1.2 && avgPF > 0.01)
    mistakes.push({ label: "Thin Profit Factor", severity: "medium", detail: `Profit factor of ${avgPF.toFixed(2)} means small average wins. Look for better risk/reward setups.` });
  if (avgReturn < 0)
    mistakes.push({ label: "Negative Average Return", severity: "high", detail: `Average backtest return is ${avgReturn.toFixed(1)}%. Review your strategy parameters and entry logic.` });
  for (const jm of journalMistakes) {
    if (!mistakes.find(m => m.label.toLowerCase().includes(jm.label.toLowerCase())))
      mistakes.push({ label: jm.label, severity: jm.count >= 3 ? "high" : "medium", detail: `Logged ${jm.count} time${jm.count > 1 ? "s" : ""} in your journal — a recurring pattern worth addressing.` });
  }

  type Insight = { text: string; improvementPct: number; category: string };
  const insights: Insight[] = [];

  if (avgWinRate < 50 && backtests.length >= 2) {
    const gap = Math.max(1, 50 - avgWinRate);
    insights.push({
      text: "Wait for confirmation signals before entering — avoid chasing breakouts.",
      improvementPct: Math.min(25, Math.round(gap * 0.5)),
      category: "win-rate",
    });
  }
  if (avgDD > 15) {
    insights.push({
      text: "Apply a 2% max daily loss rule to prevent large drawdowns from compounding.",
      improvementPct: Math.min(20, Math.round(avgDD * 0.6)),
      category: "risk",
    });
  }
  if (avgSharpe < 1 && avgSharpe > 0) {
    insights.push({
      text: "Reduce position size during high-volatility periods to improve risk-adjusted returns.",
      improvementPct: Math.min(18, Math.round((1 - avgSharpe) * 18)),
      category: "sharpe",
    });
  }
  if (avgPF < 1.5 && avgPF > 0.01) {
    insights.push({
      text: "Target asymmetric risk/reward — aim for at least 1:2 on every setup you take.",
      improvementPct: Math.min(15, Math.round((1.5 - avgPF) * 12)),
      category: "profit-factor",
    });
  }
  if (backtests.length < 5) {
    insights.push({
      text: "Run more backtests across different symbols and timeframes to diversify your strategy view.",
      improvementPct: 10,
      category: "data",
    });
  }
  if (insights.length === 0) {
    insights.push({
      text: "Your metrics are solid — forward test your best strategy in paper trading to build live confidence.",
      improvementPct: 8,
      category: "general",
    });
  }
  const finalInsights = insights.slice(0, 4);

  res.json({
    traderScore: score,
    traderStyle,
    traderStyleColor,
    avgHoldingDays: Number(avgHoldingDays.toFixed(1)),
    backtestCount: backtests.length,
    avgWinRate: Number(avgWinRate.toFixed(1)),
    avgSharpe: Number(avgSharpe.toFixed(2)),
    avgDrawdown: Number(avgDD.toFixed(1)),
    avgProfitFactor: Number(avgPF.toFixed(2)),
    journalMistakes,
    mistakes,
    insights: finalInsights,
    hasData: true,
  });
});

/* ─── Session Analysis ──────────────────────────────────────────────────────── */
router.get("/ai/session-analysis", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;

  const [paperTrades, btTrades] = await Promise.all([
    db.select({
      symbol: paperTradesTable.symbol,
      pnl: paperTradesTable.pnl,
      pnlPct: paperTradesTable.pnlPct,
      entryTime: paperTradesTable.entryTime,
    })
      .from(paperTradesTable)
      .where(eq(paperTradesTable.userId, userId)),
    db.select({
      symbol: tradesTable.symbol,
      pnl: tradesTable.pnl,
      pnlPercent: tradesTable.pnlPercent,
      entryDate: tradesTable.entryDate,
    })
      .from(tradesTable)
      .innerJoin(backtestsTable, eq(tradesTable.backtestId, backtestsTable.id))
      .where(eq(backtestsTable.userId, userId))
      .limit(1000),
  ]);

  const totalPaper = paperTrades.length;
  const totalBt    = btTrades.length;

  if (totalPaper === 0 && totalBt === 0) {
    res.json({ hasData: false, totalTrades: 0, byDay: [], bySession: [], byMarket: [] });
    return;
  }

  const getSession = (utcHour: number): string => {
    if (utcHour >= 0  && utcHour < 7)  return "Asian Session";
    if (utcHour >= 7  && utcHour < 12) return "London Open";
    if (utcHour >= 12 && utcHour < 17) return "New York Open";
    if (utcHour >= 17 && utcHour < 21) return "New York Close";
    return "Asian Session";
  };

  const getMarket = (symbol: string): string => {
    const s = symbol.toUpperCase();
    if (s.endsWith("USDT") || s.endsWith("BTC") || s.endsWith("ETH")) return "Crypto";
    if (s.includes("XAU") || s.includes("OIL") || s.includes("SILVER") || s.includes("CORN") || s.includes("WHEAT")) return "Commodities";
    if (s.length === 6 && /^[A-Z]+$/.test(s)) return "Forex";
    return "Stocks";
  };

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  type Bucket = { wins: number; losses: number; pnlPctSum: number };
  const mkBucket = (): Bucket => ({ wins: 0, losses: 0, pnlPctSum: 0 });

  const byDay:     Record<string, Bucket> = {};
  const bySession: Record<string, Bucket> = {};
  const byMarket:  Record<string, Bucket> = {};

  const addToBucket = (map: Record<string, Bucket>, key: string, isWin: boolean, pnlPct: number) => {
    if (!map[key]) map[key] = mkBucket();
    if (isWin) map[key].wins++; else map[key].losses++;
    map[key].pnlPctSum += pnlPct;
  };

  for (const t of paperTrades) {
    const pnl    = Number(t.pnl);
    const pnlPct = Number(t.pnlPct ?? 0);
    const d      = new Date(Number(t.entryTime));
    const day    = DAY_NAMES[d.getUTCDay()] ?? "Mon";
    const ses    = getSession(d.getUTCHours());
    const mkt    = getMarket(t.symbol);
    const isWin  = pnl > 0;
    addToBucket(byDay,     day, isWin, pnlPct);
    addToBucket(bySession, ses, isWin, pnlPct);
    addToBucket(byMarket,  mkt, isWin, pnlPct);
  }

  // Backtest trades have date only — derive approximate session from market type as heuristic
  const marketToSession = (mkt: string): string => {
    if (mkt === "Stocks")      return "New York Open";
    if (mkt === "Forex")       return "London Open";
    if (mkt === "Commodities") return "New York Open";
    return "Asian Session"; // Crypto trades 24/7; Asian is largest crypto session
  };

  for (const t of btTrades) {
    const pnl    = Number(t.pnl);
    const pnlPct = Number(t.pnlPercent ?? 0);
    const d      = new Date(t.entryDate);
    const day    = DAY_NAMES[d.getUTCDay()] ?? "Mon";
    const mkt    = getMarket(t.symbol);
    const ses    = marketToSession(mkt);
    const isWin  = pnl > 0;
    addToBucket(byDay,     day, isWin, pnlPct);
    addToBucket(bySession, ses, isWin, pnlPct);
    addToBucket(byMarket,  mkt, isWin, pnlPct);
  }

  const toArr = (map: Record<string, Bucket>) =>
    Object.entries(map).map(([label, s]) => {
      const trades = s.wins + s.losses;
      return {
        label,
        wins:       s.wins,
        losses:     s.losses,
        trades,
        winRate:    Number(trades > 0 ? ((s.wins / trades) * 100).toFixed(1) : "0"),
        avgPnlPct:  Number(trades > 0 ? (s.pnlPctSum / trades).toFixed(2) : "0"),
      };
    });

  const SESSION_ORDER = ["Asian Session", "London Open", "New York Open", "New York Close"];
  const DAY_ORDER     = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const sortedSessions = toArr(bySession).sort((a, b) =>
    SESSION_ORDER.indexOf(a.label) - SESSION_ORDER.indexOf(b.label));
  const sortedDays = toArr(byDay).sort((a, b) =>
    DAY_ORDER.indexOf(a.label) - DAY_ORDER.indexOf(b.label));

  res.json({
    hasData: true,
    totalTrades: totalPaper + totalBt,
    paperTrades: totalPaper,
    backtestTrades: totalBt,
    byDay:     sortedDays,
    bySession: sortedSessions,
    byMarket:  toArr(byMarket),
  });
});

/* ─── Ghost Mode ──────────────────────────────────────────────────────────── */
router.post("/ai/ghost-mode", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }

  const { symbol, side, strategyType, entryReason } = req.body as {
    symbol?: string;
    side?: string;
    strategyType?: string;
    entryReason?: string;
  };

  if (!symbol || !side) {
    res.status(400).json({ error: "symbol and side are required" });
    return;
  }

  // Check if we have a fresh cache (30 min TTL)
  const CACHE_TTL_MS = 30 * 60 * 1000;
  const cacheRow = await db.select()
    .from(traderPatternsTable)
    .where(and(
      eq(traderPatternsTable.userId, userId),
      eq(traderPatternsTable.patternType, "ghost_cache"),
    ))
    .orderBy(desc(traderPatternsTable.computedAt))
    .limit(1)
    .then(r => r[0] ?? null);

  let profile: Awaited<ReturnType<typeof extractTraderProfile>>;
  if (cacheRow && Date.now() - new Date(cacheRow.computedAt).getTime() < CACHE_TTL_MS) {
    profile = cacheRow.patternData as any;
  } else {
    profile = await extractTraderProfile(userId);
    await db.delete(traderPatternsTable).where(and(
      eq(traderPatternsTable.userId, userId),
      eq(traderPatternsTable.patternType, "ghost_cache"),
    ));
    await db.insert(traderPatternsTable).values({
      userId,
      patternType: "ghost_cache",
      patternData: profile as any,
    });
  }

  const allTrades = [...(profile.recentTrades ?? []), ...(profile.winningTrades ?? []), ...(profile.losingTrades ?? [])];
  const uniqueTrades: typeof allTrades = [];
  const seen = new Set<string>();
  for (const t of allTrades) {
    const key = `${t.symbol}|${t.entryDate}|${t.side}`;
    if (!seen.has(key)) { seen.add(key); uniqueTrades.push(t); }
  }

  if (uniqueTrades.length === 0) {
    res.json({
      hasHistory: false,
      similarityScore: 0,
      closestMatch: null,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      avgReturn: 0,
      message: "No trade history found. Run some backtests to enable Ghost Mode.",
    });
    return;
  }

  // Weighted similarity: symbol (40%) + side (30%) + strategyType (20%) + market (10%)
  const getMarket = (sym: string) => {
    if (["BTC","ETH","SOL","BNB","XRP","ADA","DOGE"].some(c => sym.includes(c))) return "Crypto";
    if (["EUR","GBP","JPY","AUD","CAD","CHF","NZD"].some(c => sym.includes(c))) return "Forex";
    return "Stocks";
  };
  const proposedMarket = getMarket(symbol);

  const scored = uniqueTrades.map(t => {
    let score = 0;
    if (t.symbol === symbol) score += 40;
    else if (getMarket(t.symbol) === proposedMarket) score += 15;
    if (t.side === side) score += 30;
    if (strategyType && t.strategyType === strategyType) score += 20;
    else if (!strategyType) score += 10;
    score += 10;
    return { trade: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0]?.score ?? 0;
  const similarityScore = Math.min(100, Math.round(topScore));

  // Stats for similar trades (same symbol or market + same side)
  const similar = uniqueTrades.filter(t =>
    (t.symbol === symbol || getMarket(t.symbol) === proposedMarket) && t.side === side
  );
  const winCount  = similar.filter(t => t.pnl > 0).length;
  const lossCount = similar.filter(t => t.pnl <= 0).length;
  const winRate   = similar.length ? Number(((winCount / similar.length) * 100).toFixed(1)) : 0;
  const avgReturn = similar.length ? Number((similar.reduce((s, t) => s + t.pnlPercent, 0) / similar.length).toFixed(2)) : 0;

  // Average drawdown for similar setups — uses abs(pnlPercent) of losing trades in cohort
  // as a per-trade drawdown proxy; falls back to profile.avgDrawdown when cohort is small.
  const losingTrades = similar.filter(t => t.pnl < 0);
  const cohortAvgDrawdown = losingTrades.length >= 2
    ? Number((losingTrades.reduce((s, t) => s + Math.abs(t.pnlPercent), 0) / losingTrades.length).toFixed(2))
    : Number(profile.avgDrawdown.toFixed(2));

  const closestMatch = scored[0]?.trade ?? null;

  res.json({
    hasHistory: true,
    similarityScore,
    closestMatch: closestMatch ? {
      symbol: closestMatch.symbol,
      side: closestMatch.side,
      entryDate: closestMatch.entryDate,
      exitDate: closestMatch.exitDate,
      entryPrice: Number(closestMatch.entryPrice.toFixed(4)),
      exitPrice: Number(closestMatch.exitPrice.toFixed(4)),
      pnl: Number(closestMatch.pnl.toFixed(2)),
      pnlPercent: Number(closestMatch.pnlPercent.toFixed(2)),
      durationDays: Number(closestMatch.durationDays.toFixed(1)),
      strategyType: closestMatch.strategyType ?? null,
    } : null,
    similarTrades: similar.length,
    winCount,
    lossCount,
    winRate,
    avgReturn,
    avgDrawdown: cohortAvgDrawdown,
    marketContext: proposedMarket,
  });
});

/* ─── Twin Profile (no LLM — raw profile data only) ─────────────────────── */
router.get("/ai/twin-profile", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  try {
    const profile = await extractTraderProfile(userId);
    const hasProfile = profile.totalTrades >= 3;
    res.json({
      hasProfile,
      traderStyle: profile.traderStyle,
      preferredSide: profile.preferredSide,
      avgDrawdown: profile.avgDrawdown,
      avgWinRate: profile.avgWinRate,
      avgReturn: profile.avgReturn,
      totalTrades: profile.totalTrades,
      avgHoldingDays: profile.avgHoldingDays,
      sessionStats: profile.sessionStats,
      topSymbols: profile.topSymbols,
      strategyStats: profile.strategyStats,
      journalMistakes: profile.journalMistakes,
      backtestCount: profile.backtestCount,
    });
  } catch (err) {
    logger.error(err, "ai/twin-profile error");
    res.status(500).json({ error: "Failed to load trader profile." });
  }
});

/* ─── AI Trading Twin ─────────────────────────────────────────────────────── */
router.post("/ai/twin-analysis", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const { symbol, side, strategyType, entryReason, entryPrice } = req.body as {
    symbol?: string;
    side?: string;
    strategyType?: string;
    entryReason?: string;
    entryPrice?: number;
  };

  if (!symbol || !side) {
    res.status(400).json({ error: "symbol and side are required" });
    return;
  }

  // Load or regenerate twin profile (24h TTL)
  const TWIN_TTL_MS = 24 * 60 * 60 * 1000;
  const existingTwin = await db.select()
    .from(twinProfileTable)
    .where(eq(twinProfileTable.userId, userId))
    .limit(1)
    .then(r => r[0] ?? null);

  let profileData: Awaited<ReturnType<typeof extractTraderProfile>>;
  if (existingTwin && Date.now() - new Date(existingTwin.updatedAt).getTime() < TWIN_TTL_MS) {
    profileData = existingTwin.profileData as any;
  } else {
    profileData = await extractTraderProfile(userId);
    if (existingTwin) {
      await db.update(twinProfileTable)
        .set({ profileData: profileData as any, updatedAt: new Date() })
        .where(eq(twinProfileTable.userId, userId));
    } else {
      await db.insert(twinProfileTable).values({ userId, profileData: profileData as any });
    }
  }

  if (profileData.backtestCount === 0 && profileData.totalTrades === 0) {
    res.json({
      hasProfile: false,
      decision: "insufficient_data",
      confidence: 0,
      reason: "Your Trading Twin needs data to learn from. Run some backtests first.",
      alternative: null,
    });
    return;
  }

  const profileSummary = `
TRADER PROFILE:
- Style: ${profileData.traderStyle} (avg holding ${profileData.avgHoldingDays.toFixed(1)} days)
- Preferred side: ${profileData.preferredSide}
- Avg win rate: ${profileData.avgWinRate.toFixed(1)}%
- Avg return: ${profileData.avgReturn.toFixed(2)}%
- Avg max drawdown: ${profileData.avgDrawdown.toFixed(1)}%
- Avg Sharpe: ${profileData.avgSharpe.toFixed(2)}
- Total trades analyzed: ${profileData.totalTrades}
- Top symbols: ${profileData.topSymbols.slice(0, 3).map(s => `${s.symbol} (WR: ${s.winRate.toFixed(0)}%)`).join(", ")}
- Best sessions: ${profileData.sessionStats.sort((a, b) => b.winRate - a.winRate).slice(0, 2).map(s => `${s.label} (WR: ${s.winRate.toFixed(0)}%)`).join(", ")}
- Preferred strategies: ${profileData.strategyStats.slice(0, 2).map(s => s.type).join(", ")}
- Journal mistakes: ${profileData.journalMistakes.slice(0, 3).map(m => m.label).join(", ") || "None logged"}
`;

  const proposed = `
PROPOSED TRADE:
- Symbol: ${symbol}
- Side: ${side}
- Strategy: ${strategyType ?? "unspecified"}
- Entry price: ${entryPrice ? `$${entryPrice}` : "unspecified"}
- Entry reason: ${entryReason ?? "not provided"}
`;

  const systemPrompt = `You are an AI Trading Twin — a behavioral clone of a specific trader built from their historical trade data. Your job is to analyze a proposed trade and decide if THIS SPECIFIC TRADER would enter it, based on their established patterns. Respond ONLY with valid JSON matching this schema exactly: { "decision": "would_enter" | "would_not_enter", "confidence": <number 0-100>, "reason": "<1-2 sentences explaining why based on their patterns>", "alternative": "<optional: suggest what adjustment could make this a better fit for their style, or null>" }`;

  try {
    const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${profileSummary}\n${proposed}\nAnalyze this trade against the trader's profile and respond with JSON only.` },
      ],
      max_tokens: 400,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: { decision?: string; confidence?: number; reason?: string; alternative?: string | null } = {};
    try { result = JSON.parse(raw); } catch { result = {}; }

    res.json({
      hasProfile: true,
      decision: result.decision ?? "would_not_enter",
      confidence: Number(result.confidence ?? 50),
      reason: result.reason ?? "Unable to analyze this trade at this time.",
      alternative: result.alternative ?? null,
      traderStyle: profileData.traderStyle,
      preferredSide: profileData.preferredSide,
    });
  } catch (err) {
    logger.error(err, "ai/twin-analysis error");
    res.status(500).json({ error: "AI service temporarily unavailable." });
  }
});

/* ─── Daily Coach ─────────────────────────────────────────────────────────── */
router.get("/ai/daily-coach", requireAuth, async (req, res) => {
  const userId = extractUserId(req)!;
  if (!checkAiRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) { res.status(503).json({ error: "AI not configured." }); return; }

  const today = new Date().toISOString().split("T")[0]!;

  // Check cache: one briefing per user per day
  const cached = await db.select()
    .from(coachCacheTable)
    .where(and(eq(coachCacheTable.userId, userId), eq(coachCacheTable.date, today)))
    .limit(1)
    .then(r => r[0] ?? null);

  if (cached) {
    res.json({ cached: true, ...cached.briefingData as object });
    return;
  }

  const profile = await extractTraderProfile(userId);

  if (profile.backtestCount === 0 && profile.totalTrades === 0) {
    const briefing = {
      hasData: false,
      greeting: "Welcome to TradeLab! Your personalized daily coaching starts here.",
      winRateTrend: "No data yet",
      recentLossPattern: "Run your first backtest to identify loss patterns.",
      bestSession: "To be determined",
      worstSession: "To be determined",
      todayGoal: "Complete your first backtest to begin receiving personalized coaching.",
      recommendation: "Start with a simple SMA Crossover strategy on BTCUSDT to learn the platform.",
      traderStyle: "Undetermined",
    };
    await db.insert(coachCacheTable).values({ userId, date: today, briefingData: briefing as any });
    res.json(briefing);
    return;
  }

  const recentWR = profile.avgWinRate;
  const recentLosses = profile.losingTrades.slice(0, 5);
  const lossSymbols = recentLosses.map(t => t.symbol).join(", ") || "various";
  const bestSes = profile.sessionStats.sort((a, b) => b.winRate - a.winRate)[0];
  const worstSes = profile.sessionStats.sort((a, b) => a.winRate - b.winRate)[0];
  const topMistake = profile.journalMistakes[0]?.label ?? null;

  const profileText = `
Trader: ${profile.traderStyle}, ${profile.preferredSide} bias
Win rate: ${recentWR.toFixed(1)}%, Sharpe: ${profile.avgSharpe.toFixed(2)}, Avg drawdown: ${profile.avgDrawdown.toFixed(1)}%
Recent losses on: ${lossSymbols}
Best session: ${bestSes?.label ?? "N/A"} (WR: ${bestSes?.winRate.toFixed(0) ?? 0}%)
Worst session: ${worstSes?.label ?? "N/A"} (WR: ${worstSes?.winRate.toFixed(0) ?? 0}%)
Top journal mistake: ${topMistake ?? "none logged"}
Backtests: ${profile.backtestCount}, Total trades: ${profile.totalTrades}
Top strategies: ${profile.strategyStats.slice(0, 2).map(s => `${s.type} (avg return ${s.avgReturn.toFixed(1)}%)`).join(", ")}
`;

  const systemPrompt = `You are a personal AI trading coach generating a daily briefing for a trader. Be warm, specific, and actionable. Always use THEIR actual data. Respond ONLY with valid JSON matching this schema exactly: { "hasData": true, "greeting": "<personalized 1-sentence morning greeting using their trader style>", "winRateTrend": "<1 sentence on their win rate pattern — is it improving, stable, or declining?>", "recentLossPattern": "<1-2 sentences identifying what their recent losses have in common>", "bestSession": "<session name and why it works for them>", "worstSession": "<session name and what to watch out for>", "todayGoal": "<one specific, measurable focus goal for today based on their weak points>", "recommendation": "<one concrete, actionable improvement for their next trade>", "traderStyle": "<their trader style label>" }`;

  try {
    const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate today's coaching briefing for this trader:\n${profileText}` },
      ],
      max_tokens: 600,
      temperature: 0.65,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let briefing: Record<string, unknown> = {};
    try { briefing = JSON.parse(raw); } catch { briefing = {}; }
    briefing.hasData = true;
    briefing.traderStyle = briefing.traderStyle ?? profile.traderStyle;

    await db.insert(coachCacheTable).values({ userId, date: today, briefingData: briefing as any });
    res.json(briefing);
  } catch (err) {
    logger.error(err, "ai/daily-coach error");
    res.status(500).json({ error: "AI service temporarily unavailable." });
  }
});

// Deterministic pre-trade DNA pattern check — no LLM, pure DB math
router.post("/ai/pre-trade-check", requireAuth, async (req, res) => {
  const userId = res.locals["userId"] as number;

  const b = req.body as Record<string, unknown>;
  const symbol    = typeof b["symbol"]    === "string" ? b["symbol"]    : "";
  const side      = typeof b["side"]      === "string" ? b["side"]      : "long";
  const leverage  = typeof b["leverage"]  === "number" ? b["leverage"]  : 1;
  void b["timeframe"]; // accepted in request but not used in deterministic path

  try {
    const profile = await extractTraderProfile(userId);

    if (!profile || profile.totalTrades < 3) {
      res.json({
        warningLevel: "none",
        matchedPatterns: [],
        avgLossOnMatch: 0,
        hasEnoughHistory: false,
        tip: "Complete more trades to enable pre-trade DNA warnings.",
      });
      return;
    }

    // ── Match against losing trades with same symbol or side ──────────
    interface MatchedPattern { label: string; count: number; avgPnlPct: number }
    const matchedPatterns: MatchedPattern[] = [];

    // Pattern 1: same symbol + same side losses
    const symbolSideMatches = profile.losingTrades.filter(
      t => t.symbol === symbol && t.side === side,
    );
    if (symbolSideMatches.length >= 2) {
      const avgPnl = symbolSideMatches.reduce((s, t) => s + t.pnlPercent, 0) / symbolSideMatches.length;
      matchedPatterns.push({
        label: `${symbol} ${side} — historically loses`,
        count: symbolSideMatches.length,
        avgPnlPct: avgPnl,
      });
    }

    // Pattern 2: same side under same timeframe losses
    const sideMatches = profile.losingTrades.filter(t => t.side === side);
    const sideWins    = profile.winningTrades.filter(t => t.side === side);
    const sideTotal   = sideMatches.length + sideWins.length;
    if (sideTotal >= 5 && sideMatches.length / sideTotal > 0.65) {
      const avgPnl = sideMatches.reduce((s, t) => s + t.pnlPercent, 0) / sideMatches.length;
      matchedPatterns.push({
        label: `${side} trades — ${Math.round((sideMatches.length / sideTotal) * 100)}% loss rate`,
        count: sideMatches.length,
        avgPnlPct: avgPnl,
      });
    }

    // Pattern 3: high-leverage losses
    if (leverage >= 5) {
      const leverageMatches = profile.losingTrades.filter(t => (t as any).leverage >= 5 || leverage >= 5);
      const highLevWinRate = profile.sessionStats.find(s => s.label === "High Leverage")?.winRate ?? null;
      if (highLevWinRate !== null && highLevWinRate < 40) {
        matchedPatterns.push({
          label: `High leverage (≥5×) — ${highLevWinRate.toFixed(0)}% win rate`,
          count: leverageMatches.length,
          avgPnlPct: highLevWinRate - 100,
        });
      }
    }

    // ── Pattern 4: journal-listed recurring mistakes ──────────────────
    const topMistakes = profile.journalMistakes.slice(0, 2);
    for (const m of topMistakes) {
      if (m.count >= 2) {
        matchedPatterns.push({
          label: `Recurring mistake: ${m.label}`,
          count: m.count,
          avgPnlPct: -15, // heuristic: journal-logged mistakes correlate with losses
        });
      }
    }

    const avgLossOnMatch = matchedPatterns.length > 0
      ? matchedPatterns.reduce((s, p) => s + p.avgPnlPct, 0) / matchedPatterns.length
      : 0;

    // ── warningLevel: only none | caution | warning ───────────────────
    const warningLevel =
      matchedPatterns.length >= 2 || avgLossOnMatch < -10 ? "warning" :
      matchedPatterns.length === 1 ? "caution" : "none";

    // ── Tip: deterministic, based on strongest matched pattern ────────
    const strongest = matchedPatterns.sort((a, b) => a.avgPnlPct - b.avgPnlPct)[0];
    const tip = strongest
      ? `Your DNA shows ${strongest.label}. Average loss on this pattern: ${strongest.avgPnlPct.toFixed(1)}%. Consider reducing position size or waiting for a cleaner setup.`
      : null;

    res.json({
      warningLevel,
      matchedPatterns,
      avgLossOnMatch: Number(avgLossOnMatch.toFixed(2)),
      hasEnoughHistory: true,
      tip,
    });
  } catch (err) {
    logger.error(err, "ai/pre-trade-check error");
    res.status(500).json({ error: "Pre-trade check temporarily unavailable." });
  }
});

export default router;
