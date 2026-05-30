import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are an expert trading and financial markets educator. Help users learn about:
- Trading strategies (momentum, mean reversion, breakout, swing, scalping, etc.)
- Technical analysis (chart patterns, candlesticks, support/resistance, indicators)
- Risk management (position sizing, stop-loss, risk/reward ratios)
- Market dynamics (liquidity, volatility, market structure)
- Financial instruments (crypto, forex, stocks, indices, commodities, futures)
- Fundamental analysis concepts
Keep responses concise but informative (2–4 paragraphs max). Use clear examples where helpful. Do not give specific investment advice or price predictions.`;

router.post("/ai/chat", async (req, res) => {
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "OpenAI API key is not configured." });
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
      baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
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
