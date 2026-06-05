import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import OpenAI from "openai";
import { verifyJwt } from "../lib/jwt";
import { logger } from "../lib/logger";
import { db, subscriptionsTable, subscriptionPlansTable, aiUsageTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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

export default router;
