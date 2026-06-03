import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import OpenAI from "openai";
import { verifyJwt } from "../lib/jwt";

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
    const e = err as { message?: string; status?: number };
    const status = typeof e.status === "number" ? e.status : 500;
    res.status(status).json({ error: e.message ?? "AI chat failed" });
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
    const e = err as { message?: string; status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Autopsy generation failed" });
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
- "sma_crossover": { "shortPeriod": integer 5–50, "longPeriod": integer 20–200 }
- "ema_crossover": { "shortPeriod": integer 5–50, "longPeriod": integer 20–200 }
- "rsi": { "period": integer 7–21, "overbought": integer 60–80, "oversold": integer 20–40 }
- "macd": { "fastPeriod": integer 8–15, "slowPeriod": integer 20–30, "signalPeriod": integer 7–12 }
- "bollinger_bands": { "period": integer 10–30, "stdDev": number 1.5–3.0 }

Available symbols: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, LINKUSDT, AVAXUSDT

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
    const e = err as { message?: string; status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Strategy parsing failed" });
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
    const e = err as { message?: string; status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Bias report failed" });
  }
});

export default router;
