import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth) return null;
    const token = auth.replace("Bearer ", "");
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64").toString());
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

const SYSTEM_PROMPT = `You are an expert trading and financial markets educator. Help users learn about:
- Trading strategies (momentum, mean reversion, breakout, swing, scalping, etc.)
- Technical analysis (chart patterns, candlesticks, support/resistance, indicators)
- Risk management (position sizing, stop-loss, risk/reward ratios)
- Market dynamics (liquidity, volatility, market structure)
- Financial instruments (crypto, forex, stocks, indices, commodities, futures)
- Fundamental analysis concepts
Keep responses concise but informative (2–4 paragraphs max). Use clear examples where helpful. Do not give specific investment advice or price predictions.`;

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
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

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

export default router;
