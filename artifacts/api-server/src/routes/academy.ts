import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import OpenAI from "openai";
import { verifyJwt } from "../lib/jwt";
import { verifyAdminToken } from "../lib/admin-auth";
import { logger } from "../lib/logger";
import {
  db,
  academyCoursesTable,
  academyLessonsTable,
  academyUserProgressTable,
  academyQuizQuestionsTable,
  academyQuizAttemptsTable,
  academyNotesTable,
  academyCertificatesTable,
  academyXpTable,
} from "@workspace/db";
import { eq, and, desc, count as drizzleCount, inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function groqClient() {
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY ?? "", baseURL: GROQ_BASE });
}

/* ── Auth helpers ─────────────────────────────────────────────────────────── */
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
  const uid = extractUserId(req);
  if (!uid) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = uid;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyAdminToken(token)) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

/* ── XP helpers ───────────────────────────────────────────────────────────── */
async function upsertXp(userId: number, addXp: number, badge?: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await db.select().from(academyXpTable).where(eq(academyXpTable.userId, userId)).limit(1);

  if (!existing) {
    await db.insert(academyXpTable).values({
      userId,
      xp: addXp,
      level: 1,
      badges: badge ? [badge] : [],
      streakDays: 1,
      longestStreak: 1,
      lastActiveDate: today,
      totalStudyMinutes: 0,
    });
    return;
  }

  const newXp = existing.xp + addXp;
  const newLevel = Math.floor(1 + newXp / 500);
  const badges = existing.badges ?? [];
  if (badge && !badges.includes(badge)) badges.push(badge);

  // Streak logic
  let streak = existing.streakDays;
  let longest = existing.longestStreak;
  const last = existing.lastActiveDate;
  if (last !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = last === yesterday ? streak + 1 : 1;
    if (streak > longest) longest = streak;
  }

  await db.update(academyXpTable).set({
    xp: newXp, level: newLevel, badges, streakDays: streak,
    longestStreak: longest, lastActiveDate: today, updatedAt: new Date(),
  }).where(eq(academyXpTable.userId, userId));
}

/* ── Seed data ────────────────────────────────────────────────────────────── */
const SEED_COURSES = [
  // BEGINNER PATH
  { pathId: "beginner", sortOrder: 1, thumbnailEmoji: "📈", title: "What Is Trading", category: "Fundamentals", difficulty: "beginner", estimatedMinutes: 25, description: "Understand what trading is, the different types of traders, and how financial markets work." },
  { pathId: "beginner", sortOrder: 2, thumbnailEmoji: "🌍", title: "Market Types", category: "Fundamentals", difficulty: "beginner", estimatedMinutes: 20, description: "Explore Forex, Crypto, Stocks, Commodities, and Indices — how each market behaves." },
  { pathId: "beginner", sortOrder: 3, thumbnailEmoji: "🕯️", title: "Candlestick Basics", category: "Chart Reading", difficulty: "beginner", estimatedMinutes: 30, description: "Master candlestick anatomy, bullish/bearish candles, and key single-candle patterns." },
  { pathId: "beginner", sortOrder: 4, thumbnailEmoji: "🎯", title: "Support & Resistance", category: "Chart Reading", difficulty: "beginner", estimatedMinutes: 35, description: "Identify key price levels where buying and selling pressure balance." },
  { pathId: "beginner", sortOrder: 5, thumbnailEmoji: "📊", title: "Trend Basics", category: "Chart Reading", difficulty: "beginner", estimatedMinutes: 25, description: "Understand uptrends, downtrends, and sideways markets — the foundation of any analysis." },
  { pathId: "beginner", sortOrder: 6, thumbnailEmoji: "🛡️", title: "Risk Management", category: "Risk & Money", difficulty: "beginner", estimatedMinutes: 40, description: "Learn how to protect your capital with stop losses, position sizing, and R:R ratios." },
  { pathId: "beginner", sortOrder: 7, thumbnailEmoji: "🧠", title: "Psychology Basics", category: "Trading Psychology", difficulty: "beginner", estimatedMinutes: 30, description: "Control emotions, build discipline, and understand the psychological challenges of trading." },
  // INTERMEDIATE PATH
  { pathId: "intermediate", sortOrder: 1, thumbnailEmoji: "🔍", title: "Price Action", category: "Price Action", difficulty: "intermediate", estimatedMinutes: 45, description: "Read markets using raw price without indicators — the purest form of analysis." },
  { pathId: "intermediate", sortOrder: 2, thumbnailEmoji: "💥", title: "Breakouts", category: "Price Action", difficulty: "intermediate", estimatedMinutes: 35, description: "Identify real breakouts from false ones and trade them profitably." },
  { pathId: "intermediate", sortOrder: 3, thumbnailEmoji: "🌊", title: "Trend Trading", category: "Strategies", difficulty: "intermediate", estimatedMinutes: 40, description: "Follow trends with precision — identify pullbacks and time entries in trending markets." },
  { pathId: "intermediate", sortOrder: 4, thumbnailEmoji: "⚖️", title: "Supply & Demand", category: "Advanced Concepts", difficulty: "intermediate", estimatedMinutes: 50, description: "Identify supply and demand zones where institutional orders are clustered." },
  { pathId: "intermediate", sortOrder: 5, thumbnailEmoji: "🏗️", title: "Market Structure", category: "Advanced Concepts", difficulty: "intermediate", estimatedMinutes: 45, description: "Read Higher Highs, Higher Lows, and market structure shifts to understand price direction." },
  { pathId: "intermediate", sortOrder: 6, thumbnailEmoji: "💡", title: "Trading Psychology", category: "Trading Psychology", difficulty: "intermediate", estimatedMinutes: 35, description: "Advanced behavioral patterns: overtrading, revenge trading, and how to beat them." },
  // ADVANCED PATH
  { pathId: "advanced", sortOrder: 1, thumbnailEmoji: "🏦", title: "ICT Concepts", category: "Smart Money", difficulty: "advanced", estimatedMinutes: 60, description: "Inner Circle Trader methodology — how to trade like institutions using time and price." },
  { pathId: "advanced", sortOrder: 2, thumbnailEmoji: "💰", title: "Smart Money Concepts", category: "Smart Money", difficulty: "advanced", estimatedMinutes: 55, description: "Understand how smart money (banks, funds) manipulates retail traders and how to follow them." },
  { pathId: "advanced", sortOrder: 3, thumbnailEmoji: "💧", title: "Liquidity", category: "Smart Money", difficulty: "advanced", estimatedMinutes: 50, description: "Buy-side and sell-side liquidity, liquidity sweeps, and engineering moves." },
  { pathId: "advanced", sortOrder: 4, thumbnailEmoji: "🧱", title: "Order Blocks", category: "Smart Money", difficulty: "advanced", estimatedMinutes: 55, description: "Identify bullish and bearish order blocks — zones where institutions placed large orders." },
  { pathId: "advanced", sortOrder: 5, thumbnailEmoji: "🌌", title: "Fair Value Gaps", category: "Smart Money", difficulty: "advanced", estimatedMinutes: 45, description: "Identify imbalances (FVGs) in price and how the market returns to fill them." },
  { pathId: "advanced", sortOrder: 6, thumbnailEmoji: "⚡", title: "Advanced Risk Management", category: "Risk & Money", difficulty: "advanced", estimatedMinutes: 50, description: "Partial TPs, scaling in/out, break-even stops, and advanced position management." },
  // PROFESSIONAL PATH
  { pathId: "professional", sortOrder: 1, thumbnailEmoji: "💼", title: "Portfolio Management", category: "Professional", difficulty: "professional", estimatedMinutes: 60, description: "Manage multiple positions, correlations, and portfolio-level risk like a fund manager." },
  { pathId: "professional", sortOrder: 2, thumbnailEmoji: "📐", title: "Position Sizing", category: "Professional", difficulty: "professional", estimatedMinutes: 50, description: "Kelly Criterion, fixed-fraction, and optimal position sizing for maximum long-run growth." },
  { pathId: "professional", sortOrder: 3, thumbnailEmoji: "⚙️", title: "Trading Systems", category: "Professional", difficulty: "professional", estimatedMinutes: 65, description: "Build systematic trading approaches — rules-based vs discretionary, and how to blend both." },
  { pathId: "professional", sortOrder: 4, thumbnailEmoji: "🏛️", title: "Institutional Concepts", category: "Professional", difficulty: "professional", estimatedMinutes: 70, description: "How large institutions operate, execute orders, and why retail levels often get hunted." },
  { pathId: "professional", sortOrder: 5, thumbnailEmoji: "🔬", title: "Strategy Development", category: "Professional", difficulty: "professional", estimatedMinutes: 60, description: "Research, back-test, forward-test, and refine a complete trading strategy from scratch." },
  { pathId: "professional", sortOrder: 6, thumbnailEmoji: "📈", title: "Performance Optimization", category: "Professional", difficulty: "professional", estimatedMinutes: 55, description: "Review your trading metrics, identify weaknesses, and systematically improve your edge." },
];

type SeedLesson = {
  titleSuffix: string;
  type: string;
  estimatedMinutes: number;
  content: string;
};

const SEED_LESSONS: Record<string, SeedLesson[]> = {
  "What Is Trading": [
    { titleSuffix: "Introduction to Financial Markets", type: "article", estimatedMinutes: 8, content: `# Introduction to Financial Markets\n\nTrading is the act of buying and selling financial instruments with the goal of making a profit. Unlike investing — which is typically long-term — trading focuses on shorter time frames and price movements.\n\n## Who Trades Markets?\n\n**Retail Traders** — Individual traders like you and me, trading from home or an office.\n\n**Institutional Traders** — Banks, hedge funds, pension funds, and market makers who move billions of dollars daily.\n\n**Market Makers** — Entities that provide liquidity by always being willing to buy or sell.\n\n## Types of Traders by Time Frame\n\n| Type | Hold Time | Style |\n|------|-----------|-------|\n| Scalper | Seconds–Minutes | Very high frequency |\n| Day Trader | Minutes–Hours | No overnight holds |\n| Swing Trader | Days–Weeks | Holds positions overnight |\n| Position Trader | Weeks–Months | Long-term trend following |\n\n## Key Takeaway\n\nEvery time you buy, someone is selling to you. Every time you sell, someone is buying from you. Markets are a zero-sum game — understanding who is on the other side of your trade is critical.` },
    { titleSuffix: "How Orders & Prices Work", type: "article", estimatedMinutes: 10, content: `# How Orders & Prices Work\n\nUnderstanding how price moves is the foundation of all trading. Price moves because of imbalances between supply (sellers) and demand (buyers).\n\n## The Order Book\n\nEvery market has an order book — a live record of all pending buy and sell orders.\n\n- **Bid** — The highest price a buyer is willing to pay\n- **Ask** — The lowest price a seller is willing to accept\n- **Spread** — The difference between bid and ask\n\n## Types of Orders\n\n**Market Order** — Execute immediately at the current market price. Fast, but you may get slippage.\n\n**Limit Order** — Execute only at your specified price or better. More control, but may not fill.\n\n**Stop Order** — Triggers a market order when a price level is reached. Used for stop losses and breakout entries.\n\n## Why Price Moves\n\nPrice rises when there are more buyers than sellers. Price falls when there are more sellers than buyers. When supply and demand are balanced, price consolidates sideways.\n\n## 🔑 Key Rule\n\n> *"Price always moves from one area of imbalance to the next."* — Understanding this principle is the basis of all technical analysis.` },
    { titleSuffix: "Choosing Your Market & Style", type: "article", estimatedMinutes: 7, content: `# Choosing Your Market & Trading Style\n\n## Which Market Should You Trade?\n\nThere is no universal best market. Each has different characteristics:\n\n**Forex** — Most liquid market in the world. 24/5 trading. Best for beginners due to lower capital requirements.\n\n**Crypto** — Highly volatile. 24/7 trading. Higher risk but also higher reward potential.\n\n**Stocks** — Tied to business fundamentals. Sessions-based (09:30–16:00 ET for US). Good for swing traders.\n\n**Commodities** — Gold, Oil, Silver. Often trend well and provide portfolio diversification.\n\n## Finding Your Style\n\nAsk yourself:\n- How much time do I have each day? → Scalping vs swing trading\n- What is my risk tolerance? → Volatile vs stable markets\n- Do I prefer rules or discretion? → Systematic vs discretionary\n\n## 🎯 Action Step\n\nPick ONE market to focus on for the next 90 days. Mastery comes from depth, not breadth. Most successful traders specialize.` },
  ],
  "Candlestick Basics": [
    { titleSuffix: "Anatomy of a Candlestick", type: "article", estimatedMinutes: 10, content: `# Anatomy of a Candlestick\n\nCandlestick charts are the most widely used charting format in trading. Each candle tells you exactly what happened during a specific time period.\n\n## The 4 Data Points (OHLC)\n\n- **Open** — Where price started at the beginning of the period\n- **High** — The highest price reached during the period\n- **Low** — The lowest price reached during the period\n- **Close** — Where price ended at the close of the period\n\n## Candle Structure\n\n```\n  │  ← Upper wick/shadow\n ┌┴┐\n │ │ ← Body (Open to Close)\n └┬┘\n  │  ← Lower wick/shadow\n```\n\n**Bullish Candle (Green/White)** — Close is ABOVE open. Buyers were in control.\n\n**Bearish Candle (Red/Black)** — Close is BELOW open. Sellers were in control.\n\n## Reading Candle Meaning\n\n| Feature | Meaning |\n|---------|---------|\n| Long body | Strong directional momentum |\n| Short body | Indecision, balance |\n| Long upper wick | Sellers rejected higher prices |\n| Long lower wick | Buyers rejected lower prices |\n| Doji (no body) | Perfect indecision |\n\n## 🔑 Key Insight\n\nThe wick tells you where the market TRIED to go. The body tells you where the market ACCEPTED price. Long wicks show rejection — a critical signal.` },
    { titleSuffix: "Key Candlestick Patterns", type: "article", estimatedMinutes: 12, content: `# Key Candlestick Patterns\n\nCertain candlestick patterns consistently signal potential reversals or continuations. Here are the most important ones every trader must know.\n\n## Reversal Patterns\n\n### 🔨 Hammer (Bullish Reversal)\n- Small body at the top, long lower wick (at least 2× body)\n- Appears at the bottom of a downtrend\n- Shows buyers stepped in strongly to reject lower prices\n\n### ⭐ Shooting Star (Bearish Reversal)\n- Small body at the bottom, long upper wick\n- Appears at the top of an uptrend\n- Shows sellers rejected higher prices aggressively\n\n### 🕯️ Engulfing Patterns\n- **Bullish Engulfing** — A large green candle completely engulfs the previous red candle\n- **Bearish Engulfing** — A large red candle completely engulfs the previous green candle\n- High reliability when appearing at key levels\n\n### ✨ Doji\n- Open and close are virtually equal\n- Signals indecision and potential reversal\n- Most powerful when appearing after a strong trend\n\n## Continuation Patterns\n\n**Marubozu** — Full body candle with no wicks. Extremely strong momentum in the candle direction.\n\n## ⚠️ Important Rule\n\nNever trade candlestick patterns in isolation. Always confirm with:\n1. Location (is it at a key level?)\n2. Context (what is the higher timeframe doing?)\n3. Follow-through (does the next candle confirm?)` },
    { titleSuffix: "Reading Candlestick Context", type: "article", estimatedMinutes: 8, content: `# Reading Candlestick Context\n\nA single candle means nothing on its own. Candlestick analysis is about reading sequences of candles to understand the story of the market.\n\n## The 3-Candle Rule\n\nAlways look at the candle before, the signal candle, and the candle after. The third candle is your confirmation.\n\n## Volume + Candlestick\n\nA candlestick pattern becomes far more powerful when accompanied by unusual volume:\n- High volume reversal candle = strong institutional participation\n- Low volume reversal = weak signal, likely to fail\n\n## Multi-Candle Stories\n\n**Three White Soldiers** — Three consecutive strong bullish candles. Signals strong buying momentum.\n\n**Three Black Crows** — Three consecutive strong bearish candles. Signals strong selling momentum.\n\n**Inside Bar** — A candle completely inside the previous candle's range. Signals consolidation before breakout.\n\n## 🎯 Practice Drill\n\nOpen any chart. Look at 20 consecutive candles. For each one, ask:\n1. Who was in control — buyers or sellers?\n2. Did one side reject the other?\n3. What story do these candles tell together?\n\nThis habit will develop your price reading intuition faster than any indicator.` },
  ],
  "Support & Resistance": [
    { titleSuffix: "What Is Support & Resistance", type: "article", estimatedMinutes: 10, content: `# What Is Support & Resistance?\n\nSupport and resistance are the most fundamental concepts in technical analysis. They are price levels where the market has repeatedly stalled, reversed, or paused.\n\n## Support\n\nA **support level** is a price where buying pressure exceeds selling pressure, causing price to stop falling and bounce upward.\n\n- Price has bounced from this level multiple times\n- Buyers perceive value at this price\n- Stop losses for short sellers cluster here\n\n## Resistance\n\nA **resistance level** is a price where selling pressure exceeds buying pressure, causing price to stop rising and reverse downward.\n\n- Price has reversed from this level multiple times\n- Sellers perceive the asset as overvalued at this price\n- Stop losses for long positions cluster here\n\n## Role Reversal\n\nOne of the most powerful principles: **broken support becomes resistance, and broken resistance becomes support.**\n\nThis is called a "role reversal" and creates high-probability trade setups when price returns to a previously broken level.\n\n## Types of Support/Resistance\n\n| Type | Description |\n|------|-------------|\n| Horizontal | Flat price levels, most reliable |\n| Trend Lines | Diagonal lines connecting highs/lows |\n| Round Numbers | Psychological levels (1.2000, 50,000) |\n| Moving Averages | Dynamic support/resistance |\n| Fibonacci | Mathematical retracement levels |` },
    { titleSuffix: "Drawing Levels Like a Pro", type: "article", estimatedMinutes: 12, content: `# Drawing Support & Resistance Levels Like a Pro\n\nMost beginners draw too many levels. Professional traders focus only on the MOST significant levels.\n\n## How to Draw Strong Levels\n\n**Rule 1: Use Higher Timeframes First**\nAlways start on the Daily or Weekly chart. Levels visible on higher timeframes are more significant and more respected.\n\n**Rule 2: Look for Clusters**\nA strong level is one where price has interacted multiple times — bounced, consolidated, or broken and retested.\n\n**Rule 3: Zones, Not Lines**\nPrice doesn't turn on a single pixel. Draw zones (areas) rather than exact lines to account for wicks and noise.\n\n**Rule 4: The More Touches, the Stronger**\n- 2 touches: Notable level\n- 3 touches: Strong level  \n- 4+ touches: Major level\n\n## What Weakens a Level\n\n- Too many touches (eventually breaks)\n- Long time since it was last tested\n- Weak momentum when it was formed\n\n## 🔑 Pro Tip\n\nDelete half your levels. The best traders use only 3–5 key levels on any chart. Fewer, higher-quality levels = better trades.` },
  ],
  "Trend Basics": [
    { titleSuffix: "Understanding Market Trends", type: "article", estimatedMinutes: 8, content: `# Understanding Market Trends\n\n"The trend is your friend" is perhaps the most repeated phrase in trading — because it's true.\n\n## The Three Market States\n\n**Uptrend** — Price making Higher Highs (HH) and Higher Lows (HL). Buyers are in control.\n\n**Downtrend** — Price making Lower Highs (LH) and Lower Lows (LL). Sellers are in control.\n\n**Sideways/Ranging** — Price oscillating between defined highs and lows. Neither side has control.\n\n## Dow Theory Basics\n\nCharles Dow described three types of trend:\n- **Primary trend** — Major multi-month to multi-year direction\n- **Secondary trend** — Counter-trend corrections (typically 33–66% of primary move)\n- **Minor trend** — Short-term fluctuations (noise)\n\n## Identifying Trend Strength\n\n**Strong trend signals:**\n- Large candle bodies in trend direction\n- Small pullbacks before continuation\n- Higher closes on each wave\n\n**Weak trend signals:**\n- Small candle bodies\n- Deep pullbacks (>50% retracement)\n- Increasing wicks against the trend\n\n## 🔑 Trading Rule\n\nOnly trade WITH the trend until the trend officially ends. A trend ends when it makes a lower low (uptrend) or higher high (downtrend) for the first time.` },
    { titleSuffix: "Trend Lines & Channels", type: "article", estimatedMinutes: 10, content: `# Trend Lines & Channels\n\n## Drawing Trend Lines\n\nA trend line is a diagonal line connecting swing lows (in an uptrend) or swing highs (in a downtrend).\n\n**Uptrend Line:** Connect at least 2 swing lows. A third touch confirms validity.\n\n**Downtrend Line:** Connect at least 2 swing highs. A third touch confirms validity.\n\n## Trend Channels\n\nA trend channel is formed by drawing a parallel line to the trend line:\n- Lower channel line = support\n- Upper channel line = resistance (price often stalls here)\n\nChannels are powerful for timing entries at the lower channel and exits at the upper channel.\n\n## How to Trade Trend Line Breaks\n\n1. Price breaks and closes BELOW the uptrend line\n2. Wait for a retest of the broken trend line from below\n3. Enter short if it holds as resistance\n\n**Never enter blindly on the break** — wait for the retest. This filters fake breaks and gives a better entry price.\n\n## Trend Line Timeframe Rule\n\nA trend line break on a higher timeframe (Daily, 4H) is far more significant than one on a lower timeframe (15m, 1H). Always check multiple timeframes before acting on a break.` },
  ],
  "Risk Management": [
    { titleSuffix: "Why Risk Management Is Everything", type: "article", estimatedMinutes: 10, content: `# Why Risk Management Is Everything\n\nHere is a hard truth: *You can have a 40% win rate and still be profitable if your risk management is excellent.*\n\n## The Math of Losses\n\nLosing capital is exponentially harder to recover from:\n\n| Loss | Recovery Needed |\n|------|-----------------|\n| 10%  | 11.1% to break even |\n| 25%  | 33.3% to break even |\n| 50%  | 100% to break even |\n| 75%  | 300% to break even |\n\n**Preservation of capital is the #1 priority.**\n\n## The Risk-to-Reward (R:R) Ratio\n\nR:R = Potential Profit ÷ Potential Loss\n\nExample: Risk $100 to make $300 = 3:1 R:R\n\nWith a 3:1 R:R, you only need to win 1 in 4 trades to break even. Win 2 in 4 and you're very profitable.\n\n## The 1–2% Rule\n\nNever risk more than 1–2% of your total account on a single trade.\n\n- $10,000 account → max risk per trade: $100–$200\n- This means a 10-loss streak only costs you 10–20% of your account\n- Gives you time to recover and find your edge\n\n## 🔑 Most Important Rule\n\nSet your stop loss BEFORE you enter. Know exactly how much you will lose if you're wrong. If you cannot define your loss, don't take the trade.` },
    { titleSuffix: "Position Sizing & Stop Losses", type: "article", estimatedMinutes: 12, content: `# Position Sizing & Stop Losses\n\n## How to Calculate Position Size\n\nPosition size = Account Risk ÷ Trade Risk (in price terms)\n\n**Example:**\n- Account: $10,000\n- Risk per trade: 1% = $100\n- Entry: $50,000 (BTC)\n- Stop loss: $49,000 (distance = $1,000)\n- Position size = $100 ÷ $1,000 = 0.1 BTC\n\nAlways size your position so that if your stop loss is hit, you lose exactly your predetermined risk amount.\n\n## Where to Place Stop Losses\n\n**Bad stop placement:**\n- Random round numbers\n- Too tight (gets hit by noise)\n- Based on how much you "want" to risk\n\n**Good stop placement:**\n- Behind a key support/resistance level\n- Below the low that created the setup\n- Behind an order block or FVG\n- Give the trade enough room to "breathe"\n\n## Types of Stop Losses\n\n- **Fixed stop** — Set and forget. Moves only to break even once in profit.\n- **Trailing stop** — Follows price as it moves in your favor.\n- **Time stop** — Exit if the trade doesn't perform within X candles.\n\n## 🎯 Stop Loss Checklist\n\n✓ Is the stop behind a structural level?\n✓ Does the position size respect the 1–2% rule?\n✓ Is the R:R at least 2:1?\n✓ Is the stop far enough to avoid normal noise?` },
  ],
  "Psychology Basics": [
    { titleSuffix: "The Psychology of Trading", type: "article", estimatedMinutes: 10, content: `# The Psychology of Trading\n\nTechnical and fundamental analysis can be learned in months. Mastering your own psychology takes years — and it is the primary reason 90% of traders fail.\n\n## The Two Enemies: Fear & Greed\n\n**Fear** causes:\n- Cutting winners too early\n- Missing entries because you "feel" unsure\n- Revenge trading after a loss\n- Paralysis after a drawdown\n\n**Greed** causes:\n- Holding losing trades hoping for a reversal\n- Removing stop losses\n- Overtrading — taking too many setups\n- Ignoring your trading plan\n\n## The Losing Trader's Cycle\n\nMost losing traders follow this cycle:\n1. Take a loss → Feel bad\n2. Revenge trade → Take another loss\n3. Increase position size → Take bigger loss\n4. Blow account or stop trading\n\n## Breaking the Cycle\n\n1. **Accept that losses are part of the business.** Even the best traders lose 40–50% of their trades.\n2. **Focus on process, not outcome.** A well-executed losing trade is better than a poorly-executed winning trade.\n3. **Track your psychology** in a trading journal. Note how you felt before, during, and after each trade.\n\n## 🔑 Mental Foundation\n\n*"The goal of trading is not to be right. The goal is to make money over a series of trades."*\n\nYou will lose individual trades. You will win the game.` },
    { titleSuffix: "Building a Trading Mindset", type: "article", estimatedMinutes: 8, content: `# Building a Winning Trading Mindset\n\n## The Professional vs Amateur Mindset\n\n| Amateur | Professional |\n|---------|--------------|\n| Trades for excitement | Trades for edge |\n| Wants to be right | Wants to be profitable |\n| Reactive to price | Proactive with plan |\n| No rules | Rigid rules |\n| Focuses on P&L | Focuses on process |\n| Trades every day | Waits for setups |\n\n## The Trading Plan — Your Anchor\n\nA trading plan removes emotion from the equation. It defines:\n- What setups you trade (entry criteria)\n- Where your stop loss goes\n- Where your take profit goes\n- How much you risk per trade\n- What you do after a loss / win\n- When you stop trading for the day\n\n## Daily Routines of Successful Traders\n\n**Pre-market:** Review key levels, news events, plan potential setups\n**During market:** Execute the plan, no improvisation\n**Post-market:** Journal every trade — what happened, what you felt, what you learned\n\n## 🎯 Week 1 Challenge\n\nTrade for one full week with these rules:\n1. No more than 2 trades per day\n2. Must pre-define stop before entry\n3. Journal every single trade\n\nThis exercise alone will reveal more about your psychology than a year of studying.` },
  ],
  "Price Action": [
    { titleSuffix: "What Is Price Action Trading", type: "article", estimatedMinutes: 12, content: `# What Is Price Action Trading?\n\nPrice action trading is the discipline of making trading decisions based purely on price movement — without relying on lagging indicators like RSI, MACD, or moving averages.\n\n## Why Price Action Works\n\nAll indicators are derived from price. They are mathematical formulas applied to historical price data. Price action traders simply cut out the middleman and read price directly.\n\n## The Core Principle: Structure\n\nPrice moves in a structured way — it does not move randomly. It leaves behind clues:\n- **Swing highs and lows** — The skeleton of any chart\n- **Imbalances** — Areas where price moved too fast in one direction\n- **Key levels** — Prices where significant buying or selling occurred\n\n## Price Action vs Indicator Trading\n\n| Price Action | Indicator Trading |\n|--------------|-------------------|\n| Leads price (reads cause) | Lags price (reads effect) |\n| Works on all timeframes | Repaints on lower TFs |\n| Minimal chart noise | Cluttered charts |\n| Discretionary judgment | Mechanical signals |\n\n## Getting Started\n\n1. Remove all indicators from your chart\n2. Switch to candlestick charts\n3. Use multiple timeframes (Daily → 4H → 1H)\n4. Identify swing highs/lows and key levels\n5. Look for candlestick signals at those levels\n\n## 🔑 The 80/20 of Price Action\n\nFocus on three things: **Where** is price (level)? **How** did it get there (momentum)? **What is it doing now** (candle signal)?` },
    { titleSuffix: "Swing Points & Market Flow", type: "article", estimatedMinutes: 10, content: `# Swing Points & Market Flow\n\n## What Are Swing Points?\n\nSwing highs and lows are the building blocks of all price action analysis. They are the points where price reversed direction.\n\n**Swing High:** A candle with a higher high than both the candle before and after it.\n\n**Swing Low:** A candle with a lower low than both the candle before and after it.\n\n## Reading Market Flow\n\nBy connecting swing points, you can read the "story" of the market:\n\n**Bullish flow:** HH → HL → HH → HL (Higher Highs and Higher Lows)\n\n**Bearish flow:** LH → LL → LH → LL (Lower Highs and Lower Lows)\n\n**Transition signal:** The moment a bullish structure makes its first LL, or a bearish structure makes its first HH — this is a potential trend change.\n\n## The Significance of Swing Points\n\nSwing points are not just for trend identification. They are also:\n- Natural stop loss placement zones\n- Areas where liquidity pools form (stops cluster above/below them)\n- Targets for price to reach (price seeks out previous highs/lows)\n\n## 🔑 Exercise\n\nOn a Daily chart of any instrument, mark all swing highs and lows from the last 6 months. Now describe the market flow in plain English: "Price made a series of higher highs and higher lows until [date], when it made the first lower low, signaling a potential shift..."` },
  ],
  "Supply & Demand": [
    { titleSuffix: "Supply & Demand Fundamentals", type: "article", estimatedMinutes: 12, content: `# Supply & Demand Fundamentals\n\nSupply and demand zones are the foundation of professional trading. They represent areas on the chart where significant institutional orders are still waiting to be filled.\n\n## The Core Concept\n\nWhen an institution (bank, fund, market maker) needs to buy or sell a large amount of an asset, they cannot do it all at once — it would move the market against them.\n\nSo they leave **pending orders** at specific price levels. When price returns to those levels, the remaining orders get filled — causing price to move away again.\n\n## Demand Zones (Buying Areas)\n\nA demand zone is an area where price consolidated before a strong move **up**.\n\n**How it forms:**\n1. Price consolidates in a tight range\n2. Institutions accumulate buy orders\n3. Price launches upward rapidly (leaving an imbalance)\n4. The consolidation zone = demand zone\n\n## Supply Zones (Selling Areas)\n\nA supply zone is an area where price consolidated before a strong move **down**.\n\n**Same logic, opposite direction:** Institutions accumulated sell orders. Price dropped rapidly. The consolidation = supply zone.\n\n## Identifying Valid Zones\n\n✓ Strong move away from the zone (impulse candle)\n✓ Zone has not been revisited multiple times (fresh = stronger)\n✓ Zone aligns with higher timeframe structure\n✓ The move was strong enough to suggest institutional involvement\n\n## 🔑 Key Rule\n\nNever buy at resistance or sell at support. Instead, wait for price to return to a fresh supply or demand zone and enter in the direction of the institutional order.` },
  ],
  "Market Structure": [
    { titleSuffix: "Reading Market Structure", type: "article", estimatedMinutes: 12, content: `# Reading Market Structure\n\nMarket structure is the framework that tells you who is in control — buyers or sellers — at any given moment.\n\n## The Four Key Points\n\n**HH (Higher High)** — A swing high that is higher than the previous swing high. Bullish sign.\n\n**HL (Higher Low)** — A swing low that is higher than the previous swing low. Bullish sign.\n\n**LH (Lower High)** — A swing high that is lower than the previous swing high. Bearish sign.\n\n**LL (Lower Low)** — A swing low that is lower than the previous swing low. Bearish sign.\n\n## Structure in Uptrend\n\nHL → HH → HL → HH → HL → HH\n\nEach pullback makes a higher low (HL), confirming buyers are stepping in at increasingly higher prices.\n\n## Structure Break (ChoCh — Change of Character)\n\nThe most important signal in structure analysis:\n\n**In an uptrend:** Price breaks below the most recent HL = Change of Character = potential trend reversal.\n\n**In a downtrend:** Price breaks above the most recent LH = Change of Character = potential trend reversal.\n\n## Break of Structure (BOS) vs ChoCh\n\n- **BOS** — Price breaks a structure point IN THE DIRECTION of the current trend. Confirms continuation.\n- **ChoCh** — Price breaks a structure point AGAINST the current trend. Signals potential reversal.\n\n## 🎯 Practical Application\n\nBefore entering any trade, ask:\n1. What is the higher timeframe structure (Daily)?\n2. Is my trade aligned with that structure?\n3. Has there been a ChoCh that shifts direction?\n\nOnly trade in the direction of the dominant structure.` },
  ],
  "Liquidity": [
    { titleSuffix: "Understanding Liquidity in Markets", type: "article", estimatedMinutes: 14, content: `# Understanding Liquidity in Markets\n\nLiquidity is the fuel that powers price movement. Understanding where liquidity is concentrated is the key to understanding WHERE price is going.\n\n## What Is Liquidity?\n\nIn simple terms, liquidity is clusters of pending orders. The most common forms are:\n\n**Buy-Side Liquidity** — Clusters of stop losses from short sellers and buy stop orders, sitting ABOVE swing highs and resistance levels.\n\n**Sell-Side Liquidity** — Clusters of stop losses from long buyers and sell stop orders, sitting BELOW swing lows and support levels.\n\n## Why Markets Seek Liquidity\n\nInstitutions need liquidity to fill their large orders. They engineer price moves toward areas of high liquidity to execute their orders without slipping.\n\n*Example: Price hunts the stops above a swing high (triggering buy stops from shorts), then reverses — the institution has now sold into that buying pressure.*\n\n## Key Liquidity Zones\n\n- **Equal highs / equal lows** — Double tops/bottoms are massive liquidity pools\n- **Swing highs and lows** — Classic stop clusters\n- **Round numbers** — Psychological levels attract stop clusters\n- **Previous day's high/low** — Widely watched, heavily targeted\n\n## The Liquidity Hunt Pattern\n\n1. Price approaches a known liquidity zone (e.g., equal highs)\n2. Price sweeps above those highs (triggering stops)\n3. Price reverses sharply downward\n4. Enter on the reversal after the sweep\n\n## 🔑 Mindset Shift\n\nStop thinking "price broke above resistance" and start thinking "price swept the liquidity sitting above resistance." This single perspective change will transform how you read charts.` },
  ],
  "Order Blocks": [
    { titleSuffix: "What Are Order Blocks?", type: "article", estimatedMinutes: 14, content: `# What Are Order Blocks?\n\nOrder blocks are one of the most powerful concepts in Smart Money and ICT trading. They represent areas where institutional traders placed large buy or sell orders.\n\n## Definition\n\nAn order block is the **last opposing candle before a significant impulsive move.**\n\n**Bullish Order Block:** The last bearish (red) candle before a strong bullish impulse move upward.\n\n**Bearish Order Block:** The last bullish (green) candle before a strong bearish impulse move downward.\n\n## Why They Work\n\nWhen institutions place a large buy order, they cannot fill it all at once. The orders that weren't filled on the initial move remain in that zone. When price returns to that zone, the remaining orders fill — creating a reaction.\n\n## How to Identify a Valid Order Block\n\n✓ The candle before a strong impulse move (BOS)\n✓ The impulse move should be fast and strong (sign of institutional involvement)\n✓ The OB should be "fresh" — not yet revisited\n✓ Better when it aligns with higher timeframe structure\n\n## Trading Order Blocks\n\n**Entry:** When price returns to the order block zone after the impulse move\n\n**Stop Loss:** Below the order block (for bullish OB)\n\n**Target:** Previous highs or the next significant level\n\n## OB vs Supply/Demand\n\nOrder blocks are a MORE SPECIFIC version of supply/demand zones. An OB is identifiable by the specific candle structure — the last candle before the move. All OBs are S/D zones, but not all S/D zones are OBs.\n\n## 🔑 High-Probability Setup\n\nBullish OB + Sell-side liquidity sweep + Discount (lower half of range) = Highest probability long entry in SMC trading.` },
  ],
  "Fair Value Gaps": [
    { titleSuffix: "Understanding Fair Value Gaps", type: "article", estimatedMinutes: 12, content: `# Understanding Fair Value Gaps (FVGs)\n\nFair Value Gaps — also called "imbalances" or "price inefficiencies" — are one of the most powerful tools in modern technical analysis.\n\n## What Is a Fair Value Gap?\n\nA Fair Value Gap forms when a three-candle sequence creates a price range that is only covered by one candle's body, leaving a "gap" in the price delivery.\n\n**Bullish FVG:** The high of candle 1 does not meet the low of candle 3. The gap between them is the FVG.\n\n**Bearish FVG:** The low of candle 1 does not meet the high of candle 3. The gap between them is the FVG.\n\n## Why FVGs Form\n\nFVGs form during moments of strong institutional buying or selling. The market moves so fast that it creates an imbalance — a zone where price was "delivered" but not fairly distributed.\n\nThe market has a natural tendency to return to these zones to "fill the imbalance" — this is the mechanics behind why price often retraces.\n\n## Trading FVGs\n\n**Entry:** Wait for price to return to the FVG zone (typically the 50% or lower portion of the gap)\n\n**Stop Loss:** Below the FVG (for bullish) with buffer\n\n**Target:** The high of the move that created the FVG (external liquidity)\n\n## FVG Types\n\n- **Inversion FVG (IFVG):** When price breaks through an FVG, the FVG inverts and becomes opposing order flow\n- **Consequent Encroachment (CE):** The 50% midpoint of a FVG — most common reaction point\n\n## 🔑 Best Setups\n\nFVG + Order Block alignment = extremely high probability zone. When an FVG sits within or on top of an order block, the reaction from that zone is typically very strong.` },
  ],
  "Portfolio Management": [
    { titleSuffix: "Professional Portfolio Management", type: "article", estimatedMinutes: 14, content: `# Professional Portfolio Management\n\nMoving from trading a single instrument to managing a portfolio of positions is what separates retail traders from professionals.\n\n## Why Portfolio Management Matters\n\nWhen you hold multiple positions simultaneously, they interact with each other:\n- **Correlated positions** — Move together (holding both BTC and ETH long doubles risk)\n- **Uncorrelated positions** — Move independently (diversification benefit)\n- **Inverse positions** — Move opposite (hedging)\n\n## The Correlation Problem\n\nHolding 5 positions in highly correlated assets is NOT diversification — it is concentrated risk with extra steps.\n\nExample: Long BTC + Long ETH + Long SOL + Long ADA = 4x concentrated crypto risk.\n\n**Rule:** Check correlation before opening a new position. If correlation > 0.7, reduce size or avoid.\n\n## Portfolio-Level Risk\n\nBeyond per-trade risk, manage portfolio-level risk:\n- **Maximum daily loss:** Stop trading when you've lost X% in a day (e.g., 3%)\n- **Maximum drawdown:** Hard stop at a drawdown level (e.g., 10% from peak)\n- **Concentration limit:** No more than 30% in one sector/asset class\n\n## The Pyramid Model\n\nStructure your portfolio:\n- **Core (60%):** High-conviction, higher timeframe trades\n- **Tactical (30%):** Shorter-term opportunities\n- **Speculative (10%):** High risk/reward asymmetric plays\n\n## 🔑 Professional Rule\n\n*"You cannot trade well if you are managing poorly."* Portfolio management is not about finding trades — it's about managing the exposure of the trades you already have.` },
  ],
  "Performance Optimization": [
    { titleSuffix: "Reviewing & Optimizing Your Trading", type: "article", estimatedMinutes: 12, content: `# Reviewing & Optimizing Your Performance\n\nThe best traders in the world review their performance obsessively. Without review, mistakes repeat. With review, growth compounds.\n\n## The Weekly Review Process\n\n**Every weekend, answer these questions:**\n\n1. How many trades did I take?\n2. What was my win rate?\n3. What was my average R:R on winners vs losers?\n4. Did I follow my trading plan on every trade?\n5. What was my biggest mistake?\n6. What was my best decision?\n\n## The Key Metrics\n\n| Metric | What It Tells You |\n|--------|-------------------|\n| Win Rate | How often you are right |\n| Profit Factor | Total profit ÷ Total loss (>1.5 is good) |\n| Average R | Average multiple of R made per trade |\n| Max Drawdown | Worst peak-to-trough loss |\n| Expectancy | Average amount made per dollar risked |\n\n## The Trade Journal — Your Most Valuable Tool\n\nEvery trade should be documented:\n- Screenshot of entry and exit\n- Why you entered (setup description)\n- How you managed it\n- What happened (result)\n- What you learned\n\nAfter 100 trades, patterns emerge. Your journal will show you exactly where you are losing money and why.\n\n## Optimization Loop\n\n1. **Review** → Find biggest weakness\n2. **Hypothesize** → "If I improve X, my results will improve because Y"\n3. **Test** → Run the adjusted approach for 20–30 trades\n4. **Measure** → Did it improve the metrics?\n5. **Integrate** → Bake it into your system\n\nRepeat forever. Trading is a craft that is never fully mastered.` },
  ],
};

type SeedQuiz = {
  question: string;
  type: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

const SEED_QUIZZES: Record<string, SeedQuiz[]> = {
  "What Is Trading": [
    { question: "What is the difference between trading and investing?", type: "mcq", options: ["Trading uses leverage, investing doesn't", "Trading focuses on shorter time frames and price movements, investing is typically long-term", "Trading is only for stocks, investing is for crypto", "There is no difference"], correctIndex: 1, explanation: "Trading typically involves shorter holding periods focused on price movements, while investing usually takes a long-term perspective on fundamental value." },
    { question: "A market maker's primary role is to provide liquidity to the market.", type: "true_false", options: ["True", "False"], correctIndex: 0, explanation: "Market makers constantly offer to buy and sell, providing liquidity and ensuring traders can always execute orders." },
    { question: "What type of trader typically holds positions for days to weeks?", type: "mcq", options: ["Scalper", "Day Trader", "Swing Trader", "High-Frequency Trader"], correctIndex: 2, explanation: "Swing traders hold positions for days to weeks, aiming to capture medium-term price moves." },
    { question: "Financial markets are zero-sum games, meaning every profit requires an equal and opposite loss.", type: "true_false", options: ["True", "False"], correctIndex: 0, explanation: "In trading, every buy has a corresponding seller and vice versa. One party's gain is effectively the other's loss (before transaction costs)." },
  ],
  "Candlestick Basics": [
    { question: "What does a long lower wick on a candlestick indicate?", type: "mcq", options: ["Buyers pushed price higher all session", "Sellers dominated throughout the session", "Buyers rejected lower prices and pushed price back up", "The market was closed for part of the session"], correctIndex: 2, explanation: "A long lower wick shows that price moved significantly lower during the period but buyers stepped in to push it back up, rejecting the lower prices." },
    { question: "A Doji candlestick has open and close at approximately the same level.", type: "true_false", options: ["True", "False"], correctIndex: 0, explanation: "A Doji forms when open and close prices are virtually equal, representing a state of market indecision." },
    { question: "A Bullish Engulfing pattern occurs when:", type: "mcq", options: ["A small green candle follows a large red candle", "A large green candle completely engulfs the previous red candle", "Two consecutive green candles appear", "A green candle has no wicks"], correctIndex: 1, explanation: "A Bullish Engulfing requires a large bullish (green) candle whose body completely contains the previous bearish (red) candle's body." },
    { question: "Which candle pattern signals the STRONGEST momentum in one direction?", type: "mcq", options: ["Doji", "Hammer", "Marubozu", "Spinning Top"], correctIndex: 2, explanation: "A Marubozu is a full-body candle with no wicks, indicating that price moved in one direction throughout the entire period with no opposing pressure." },
  ],
  "Support & Resistance": [
    { question: "When a resistance level is broken, what typically happens?", type: "mcq", options: ["It becomes a stronger resistance", "It disappears from the chart", "It often becomes a new support level", "Price immediately reverses"], correctIndex: 2, explanation: "This is called 'role reversal' — when resistance is broken, that level tends to become support because former sellers now become buyers at the same price." },
    { question: "Round number price levels (like 1.2000 or 50,000) tend to act as stronger support/resistance.", type: "true_false", options: ["True", "False"], correctIndex: 0, explanation: "Round numbers are psychological levels where many traders place orders, creating self-fulfilling clusters of buying and selling pressure." },
    { question: "How many touches are needed to confirm a 'major' level?", type: "mcq", options: ["1", "2", "3", "4 or more"], correctIndex: 3, explanation: "While 2-3 touches confirm a notable level, 4 or more touches make it a major, well-established level that the market is clearly respecting." },
  ],
  "Risk Management": [
    { question: "If you lose 50% of your trading account, what percentage gain do you need to return to break even?", type: "mcq", options: ["50%", "75%", "100%", "125%"], correctIndex: 2, explanation: "If you have $10,000 and lose 50% you have $5,000. To return to $10,000 from $5,000 requires a 100% gain — double what you lost." },
    { question: "The 1-2% rule means you should risk 1-2% of your portfolio on each trade.", type: "true_false", options: ["True", "False"], correctIndex: 0, explanation: "Risking only 1-2% per trade ensures that even a series of consecutive losses won't significantly damage your account." },
    { question: "What is a Risk:Reward ratio?", type: "mcq", options: ["The ratio of your wins to losses", "Potential profit divided by potential loss", "The percentage of your account at risk", "Your win rate multiplied by average gain"], correctIndex: 1, explanation: "R:R = Potential Profit ÷ Potential Loss. A 3:1 R:R means you aim to make $3 for every $1 you risk." },
    { question: "Where should a stop loss generally be placed?", type: "mcq", options: ["At a round number", "Based on how much you want to lose", "Behind a key structural level", "Randomly below your entry"], correctIndex: 2, explanation: "Stop losses should be placed behind key structural levels (support, swing lows, order blocks) where the trade thesis is invalidated if price reaches there." },
  ],
  "Liquidity": [
    { question: "Buy-side liquidity typically sits:", type: "mcq", options: ["Below swing lows", "Above swing highs and resistance levels", "At round numbers only", "At moving averages"], correctIndex: 1, explanation: "Buy-side liquidity consists of stop losses from short sellers and buy stop orders, which cluster above swing highs and resistance levels." },
    { question: "When institutions need to fill large orders, they engineer price moves toward liquidity pools.", type: "true_false", options: ["True", "False"], correctIndex: 0, explanation: "Institutions need counterparty liquidity to fill their large orders without slippage. They often engineer moves toward stop clusters to create the liquidity they need." },
    { question: "A 'liquidity sweep' is when:", type: "mcq", options: ["Price slowly approaches a level", "Price briefly breaks a level to trigger stops, then reverses", "Volume increases significantly", "Multiple timeframes align"], correctIndex: 1, explanation: "A liquidity sweep (also called a stop hunt) is when price briefly penetrates a key level to trigger stop orders, then reverses — providing institutions with their fill." },
  ],
  "Order Blocks": [
    { question: "A Bullish Order Block is defined as:", type: "mcq", options: ["The last bullish candle before a downmove", "The last bearish candle before a strong bullish impulse", "Any support zone", "A candle with a long lower wick"], correctIndex: 1, explanation: "A Bullish Order Block is specifically the LAST bearish (red) candle before a strong bullish impulse move upward — this is where institutional buy orders were placed." },
    { question: "Order blocks should preferably be 'fresh' — meaning price has not returned to them since formation.", type: "true_false", options: ["True", "False"], correctIndex: 0, explanation: "Fresh order blocks are more reliable because the institutional orders that created them may still be unfilled. Once a zone is mitigated (revisited), its supply of orders is depleted." },
    { question: "What makes an Order Block higher probability?", type: "mcq", options: ["When it's on a 1-minute chart", "When it aligns with higher timeframe structure and FVG", "When it has many touches", "When it's near a round number"], correctIndex: 1, explanation: "Order blocks gain probability when they align with multiple confluences — especially higher timeframe bias and a co-located Fair Value Gap (FVG)." },
  ],
};

let academySeeded = false;

async function ensureAcademyContent() {
  if (academySeeded) return;
  academySeeded = true;

  const existing = await db.select({ id: academyCoursesTable.id }).from(academyCoursesTable).limit(1);
  if (existing.length > 0) return;

  logger.info("Seeding Academy content...");

  for (const c of SEED_COURSES) {
    const [inserted] = await db.insert(academyCoursesTable).values(c).returning({ id: academyCoursesTable.id });
    const courseId = inserted.id;

    const lessons = SEED_LESSONS[c.title];
    if (lessons) {
      for (let i = 0; i < lessons.length; i++) {
        const l = lessons[i];
        await db.insert(academyLessonsTable).values({
          courseId,
          title: `${c.title}: ${l.titleSuffix}`,
          type: l.type,
          content: l.content,
          estimatedMinutes: l.estimatedMinutes,
          sortOrder: i + 1,
        });
      }
    } else {
      // Default lesson for courses without explicit seed content
      await db.insert(academyLessonsTable).values({
        courseId,
        title: `Introduction to ${c.title}`,
        type: "article",
        content: `# ${c.title}\n\n${c.description}\n\nThis lesson covers the core concepts of ${c.title} in the context of professional trading.\n\n## Key Learning Objectives\n\n- Understand the fundamental principles\n- Apply these concepts to real market scenarios\n- Build a systematic approach to using this knowledge\n\n## Getting Started\n\nStudy the concepts in this module carefully. Take notes, quiz yourself, and don't move forward until you can explain these ideas in your own words.\n\n*Use the AI Tutor to ask questions and deepen your understanding.*`,
        estimatedMinutes: c.estimatedMinutes,
        sortOrder: 1,
      });
    }

    // Insert quizzes
    const quizzes = SEED_QUIZZES[c.title];
    if (quizzes) {
      for (let i = 0; i < quizzes.length; i++) {
        await db.insert(academyQuizQuestionsTable).values({
          courseId,
          ...quizzes[i],
          sortOrder: i + 1,
        });
      }
    } else {
      // Default quiz questions
      await db.insert(academyQuizQuestionsTable).values([
        { courseId, sortOrder: 1, question: `What is the primary focus of ${c.title}?`, type: "mcq", options: ["Technical analysis only", "The core concepts covered in this module", "Fundamental analysis", "News trading"], correctIndex: 1, explanation: `${c.title} focuses on the key concepts described in this module's learning objectives.` },
        { courseId, sortOrder: 2, question: `${c.title} is only relevant to professional traders.`, type: "true_false", options: ["True", "False"], correctIndex: 1, explanation: "The concepts in this module are valuable for traders at all levels, from beginner to professional." },
        { courseId, sortOrder: 3, question: "Which approach is most effective when learning new trading concepts?", type: "mcq", options: ["Memorize theory only", "Trade live immediately", "Study, practice on demo, then apply to live markets", "Skip theory and only use indicators"], correctIndex: 2, explanation: "Effective learning combines theoretical study with practical application, starting on a demo account before risking real capital." },
      ]);
    }
  }

  logger.info("Academy content seeded successfully.");
}

// Initialize seed data on startup
ensureAcademyContent().catch(e => logger.error({ err: e }, "Academy seed failed"));

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC / USER ROUTES
═══════════════════════════════════════════════════════════════════ */

/* GET /api/academy/paths — learning paths with user progress */
router.get("/academy/paths", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    const courses = await db.select().from(academyCoursesTable)
      .where(eq(academyCoursesTable.published, true))
      .orderBy(academyCoursesTable.pathId, academyCoursesTable.sortOrder);

    const allLessons = await db.select({
      id: academyLessonsTable.id,
      courseId: academyLessonsTable.courseId,
    }).from(academyLessonsTable).where(eq(academyLessonsTable.published, true));

    const lessonIds = allLessons.map(l => l.id);
    const progress = lessonIds.length > 0 ? await db.select().from(academyUserProgressTable)
      .where(and(eq(academyUserProgressTable.userId, userId), inArray(academyUserProgressTable.lessonId, lessonIds))) : [];

    const completedLessonIds = new Set(progress.map(p => p.lessonId));

    const attempts = await db.select().from(academyQuizAttemptsTable)
      .where(eq(academyQuizAttemptsTable.userId, userId))
      .orderBy(desc(academyQuizAttemptsTable.completedAt));

    // Best score per course
    const bestScores = new Map<number, number>();
    for (const a of attempts) {
      const pct = Math.round((a.score / a.totalQuestions) * 100);
      if (!bestScores.has(a.courseId) || bestScores.get(a.courseId)! < pct) {
        bestScores.set(a.courseId, pct);
      }
    }

    // Lessons per course
    const lessonsByCourse = new Map<number, number[]>();
    for (const l of allLessons) {
      if (!lessonsByCourse.has(l.courseId)) lessonsByCourse.set(l.courseId, []);
      lessonsByCourse.get(l.courseId)!.push(l.id);
    }

    const enriched = courses.map(c => ({
      ...c,
      lessonCount: (lessonsByCourse.get(c.id) ?? []).length,
      completedLessons: (lessonsByCourse.get(c.id) ?? []).filter(lid => completedLessonIds.has(lid)).length,
      quizScore: bestScores.get(c.id) ?? null,
    }));

    res.json(enriched);
  } catch (e) {
    logger.error({ err: e }, "GET /academy/paths");
    res.status(500).json({ error: "Failed to load paths" });
  }
});

/* GET /api/academy/courses — searchable library */
router.get("/academy/courses", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const q = (req.query["q"] as string | undefined)?.toLowerCase() ?? "";
  const difficulty = req.query["difficulty"] as string | undefined;
  const pathId = req.query["pathId"] as string | undefined;

  try {
    let courses = await db.select().from(academyCoursesTable)
      .where(eq(academyCoursesTable.published, true))
      .orderBy(academyCoursesTable.pathId, academyCoursesTable.sortOrder);

    if (q) courses = courses.filter(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    if (difficulty) courses = courses.filter(c => c.difficulty === difficulty);
    if (pathId) courses = courses.filter(c => c.pathId === pathId);

    const allLessons = await db.select({ id: academyLessonsTable.id, courseId: academyLessonsTable.courseId })
      .from(academyLessonsTable).where(eq(academyLessonsTable.published, true));
    const lessonsByCourse = new Map<number, number[]>();
    for (const l of allLessons) {
      if (!lessonsByCourse.has(l.courseId)) lessonsByCourse.set(l.courseId, []);
      lessonsByCourse.get(l.courseId)!.push(l.id);
    }

    const lessonIds = allLessons.map(l => l.id);
    const progress = lessonIds.length > 0 ? await db.select().from(academyUserProgressTable)
      .where(and(eq(academyUserProgressTable.userId, userId), inArray(academyUserProgressTable.lessonId, lessonIds))) : [];
    const completedSet = new Set(progress.map(p => p.lessonId));

    const enriched = courses.map(c => ({
      ...c,
      lessonCount: (lessonsByCourse.get(c.id) ?? []).length,
      completedLessons: (lessonsByCourse.get(c.id) ?? []).filter(lid => completedSet.has(lid)).length,
    }));

    res.json(enriched);
  } catch (e) {
    logger.error({ err: e }, "GET /academy/courses");
    res.status(500).json({ error: "Failed to load courses" });
  }
});

/* GET /api/academy/courses/:id/lessons — lessons for a course */
router.get("/academy/courses/:id/lessons", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const courseId = Number(req.params["id"]);
  try {
    const [course] = await db.select().from(academyCoursesTable).where(eq(academyCoursesTable.id, courseId));
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }

    const lessons = await db.select().from(academyLessonsTable)
      .where(and(eq(academyLessonsTable.courseId, courseId), eq(academyLessonsTable.published, true)))
      .orderBy(academyLessonsTable.sortOrder);

    const lessonIds = lessons.map(l => l.id);
    const progress = lessonIds.length > 0 ? await db.select().from(academyUserProgressTable)
      .where(and(eq(academyUserProgressTable.userId, userId), inArray(academyUserProgressTable.lessonId, lessonIds))) : [];
    const completedSet = new Set(progress.map(p => p.lessonId));

    res.json({
      course,
      lessons: lessons.map(l => ({ ...l, completed: completedSet.has(l.id) })),
    });
  } catch (e) {
    logger.error({ err: e }, "GET /academy/courses/:id/lessons");
    res.status(500).json({ error: "Failed to load lessons" });
  }
});

/* GET /api/academy/lessons/:id — single lesson */
router.get("/academy/lessons/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const lessonId = Number(req.params["id"]);
  try {
    const [lesson] = await db.select().from(academyLessonsTable).where(eq(academyLessonsTable.id, lessonId));
    if (!lesson) { res.status(404).json({ error: "Lesson not found" }); return; }

    const [progress] = await db.select().from(academyUserProgressTable)
      .where(and(eq(academyUserProgressTable.userId, userId), eq(academyUserProgressTable.lessonId, lessonId)));

    res.json({ ...lesson, completed: !!progress });
  } catch (e) {
    logger.error({ err: e }, "GET /academy/lessons/:id");
    res.status(500).json({ error: "Failed to load lesson" });
  }
});

/* POST /api/academy/lessons/:id/complete — mark lesson done */
router.post("/academy/lessons/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const lessonId = Number(req.params["id"]);
  const timeSpent = Number(req.body?.timeSpentMinutes ?? 5);

  try {
    const existing = await db.select().from(academyUserProgressTable)
      .where(and(eq(academyUserProgressTable.userId, userId), eq(academyUserProgressTable.lessonId, lessonId)));

    if (existing.length === 0) {
      await db.insert(academyUserProgressTable).values({ userId, lessonId, timeSpentMinutes: timeSpent });
      // XP for completing a lesson
      const total = await db.select({ c: drizzleCount() }).from(academyUserProgressTable).where(eq(academyUserProgressTable.userId, userId));
      const count = total[0]?.c ?? 0;
      let badge: string | undefined;
      if (count === 1) badge = "first_lesson";
      else if (count === 10) badge = "10_lessons";
      else if (count === 50) badge = "50_lessons";
      await upsertXp(userId, 50, badge);

      // Update total study minutes
      await db.update(academyXpTable).set({
        totalStudyMinutes: sql`${academyXpTable.totalStudyMinutes} + ${timeSpent}`,
        updatedAt: new Date(),
      }).where(eq(academyXpTable.userId, userId));
    }

    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "POST /academy/lessons/:id/complete");
    res.status(500).json({ error: "Failed to record progress" });
  }
});

/* GET /api/academy/courses/:id/quiz — quiz questions */
router.get("/academy/courses/:id/quiz", requireAuth, async (req, res): Promise<void> => {
  const courseId = Number(req.params["id"]);
  try {
    const questions = await db.select().from(academyQuizQuestionsTable)
      .where(eq(academyQuizQuestionsTable.courseId, courseId))
      .orderBy(academyQuizQuestionsTable.sortOrder);
    // Strip correct answers from response
    res.json(questions.map(q => ({ id: q.id, courseId: q.courseId, question: q.question, type: q.type, options: q.options, sortOrder: q.sortOrder })));
  } catch (e) {
    logger.error({ err: e }, "GET /academy/courses/:id/quiz");
    res.status(500).json({ error: "Failed to load quiz" });
  }
});

/* POST /api/academy/courses/:id/quiz/submit — submit quiz */
router.post("/academy/courses/:id/quiz/submit", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const courseId = Number(req.params["id"]);
  const { answers, timeSpentSeconds } = req.body as { answers: number[]; timeSpentSeconds: number };

  try {
    const questions = await db.select().from(academyQuizQuestionsTable)
      .where(eq(academyQuizQuestionsTable.courseId, courseId))
      .orderBy(academyQuizQuestionsTable.sortOrder);

    if (!questions.length) { res.status(404).json({ error: "No quiz for this course" }); return; }

    let score = 0;
    const results = questions.map((q, i) => {
      const correct = answers[i] === q.correctIndex;
      if (correct) score++;
      return { correct, correctIndex: q.correctIndex, explanation: q.explanation };
    });

    await db.insert(academyQuizAttemptsTable).values({
      userId, courseId, score, totalQuestions: questions.length,
      answers, timeSpentSeconds: timeSpentSeconds ?? 0,
    });

    const pct = Math.round((score / questions.length) * 100);
    await upsertXp(userId, pct >= 80 ? 100 : 30, pct === 100 ? "perfect_quiz" : undefined);

    // Check for certificate eligibility
    await checkAndIssueCertificate(userId, courseId);

    res.json({ score, totalQuestions: questions.length, percentage: pct, results });
  } catch (e) {
    logger.error({ err: e }, "POST /academy/courses/:id/quiz/submit");
    res.status(500).json({ error: "Failed to submit quiz" });
  }
});

/* GET /api/academy/quiz/attempts — user's quiz history */
router.get("/academy/quiz/attempts", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    const attempts = await db.select().from(academyQuizAttemptsTable)
      .where(eq(academyQuizAttemptsTable.userId, userId))
      .orderBy(desc(academyQuizAttemptsTable.completedAt));
    res.json(attempts);
  } catch (e) {
    logger.error({ err: e }, "GET /academy/quiz/attempts");
    res.status(500).json({ error: "Failed to load attempts" });
  }
});

/* ── Certificate helper ─────────────────────────────────────────────────── */
async function checkAndIssueCertificate(userId: number, courseId: number): Promise<void> {
  try {
    const [course] = await db.select().from(academyCoursesTable).where(eq(academyCoursesTable.id, courseId));
    if (!course) return;

    // Check if cert already issued for this path
    const existing = await db.select().from(academyCertificatesTable)
      .where(and(eq(academyCertificatesTable.userId, userId), eq(academyCertificatesTable.pathId, course.pathId)));
    if (existing.length > 0) return;

    // Get all courses in path
    const pathCourses = await db.select({ id: academyCoursesTable.id })
      .from(academyCoursesTable).where(eq(academyCoursesTable.pathId, course.pathId));

    // Check lesson completion
    const allLessons = await db.select({ id: academyLessonsTable.id })
      .from(academyLessonsTable).where(inArray(academyLessonsTable.courseId, pathCourses.map(c => c.id)));
    const completedProgress = await db.select().from(academyUserProgressTable)
      .where(and(eq(academyUserProgressTable.userId, userId), inArray(academyUserProgressTable.lessonId, allLessons.map(l => l.id))));

    const completionPct = allLessons.length > 0 ? completedProgress.length / allLessons.length : 0;
    if (completionPct < 0.8) return;

    // Check average quiz score
    const attempts = await db.select().from(academyQuizAttemptsTable)
      .where(and(eq(academyQuizAttemptsTable.userId, userId), inArray(academyQuizAttemptsTable.courseId, pathCourses.map(c => c.id))));

    if (attempts.length === 0) return;
    const avgScore = attempts.reduce((s, a) => s + (a.score / a.totalQuestions), 0) / attempts.length;
    if (avgScore < 0.6) return;

    await db.insert(academyCertificatesTable).values({
      userId, pathId: course.pathId, score: Math.round(avgScore * 100),
    });
    await upsertXp(userId, 500, `cert_${course.pathId}`);
  } catch (e) {
    logger.error({ err: e }, "checkAndIssueCertificate");
  }
}

/* GET /api/academy/certificates — user certs */
router.get("/academy/certificates", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    const certs = await db.select().from(academyCertificatesTable)
      .where(eq(academyCertificatesTable.userId, userId))
      .orderBy(desc(academyCertificatesTable.issuedAt));
    res.json(certs);
  } catch (e) {
    logger.error({ err: e }, "GET /academy/certificates");
    res.status(500).json({ error: "Failed to load certificates" });
  }
});

/* ── Notes ─────────────────────────────────────────────────────────────── */
router.get("/academy/notes", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    const notes = await db.select().from(academyNotesTable)
      .where(eq(academyNotesTable.userId, userId))
      .orderBy(desc(academyNotesTable.updatedAt));
    res.json(notes);
  } catch (e) {
    logger.error({ err: e }, "GET /academy/notes");
    res.status(500).json({ error: "Failed to load notes" });
  }
});

router.post("/academy/notes", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { title, content, tags, lessonId } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "Title required" }); return; }
  try {
    const [note] = await db.insert(academyNotesTable).values({
      userId, title: title.trim(), content: content ?? "", tags: tags ?? [], lessonId: lessonId ?? null,
    }).returning();
    await upsertXp(userId, 10);
    res.json(note);
  } catch (e) {
    logger.error({ err: e }, "POST /academy/notes");
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.put("/academy/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id = Number(req.params["id"]);
  const { title, content, tags } = req.body;
  try {
    const [existing] = await db.select().from(academyNotesTable)
      .where(and(eq(academyNotesTable.id, id), eq(academyNotesTable.userId, userId)));
    if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
    const [updated] = await db.update(academyNotesTable).set({
      title: title?.trim() ?? existing.title,
      content: content ?? existing.content,
      tags: tags ?? existing.tags,
      updatedAt: new Date(),
    }).where(eq(academyNotesTable.id, id)).returning();
    res.json(updated);
  } catch (e) {
    logger.error({ err: e }, "PUT /academy/notes/:id");
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/academy/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id = Number(req.params["id"]);
  try {
    await db.delete(academyNotesTable)
      .where(and(eq(academyNotesTable.id, id), eq(academyNotesTable.userId, userId)));
    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "DELETE /academy/notes/:id");
    res.status(500).json({ error: "Failed to delete note" });
  }
});

/* POST /api/academy/notes/:id/ai — AI note operations */
router.post("/academy/notes/:id/ai", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id = Number(req.params["id"]);
  const { operation } = req.body as { operation: "summarize" | "flashcards" | "revision" | "takeaways" };

  try {
    const [note] = await db.select().from(academyNotesTable)
      .where(and(eq(academyNotesTable.id, id), eq(academyNotesTable.userId, userId)));
    if (!note) { res.status(404).json({ error: "Note not found" }); return; }

    const prompts: Record<string, string> = {
      summarize: `Summarize the following trading note in 3-5 concise bullet points. Keep it educational and actionable:\n\n${note.content}`,
      flashcards: `Create 5-8 flashcards from the following trading note. Return as JSON array: [{"question": "...", "answer": "..."}]\n\n${note.content}`,
      revision: `Create a one-page revision sheet from this trading note. Include: Key Concepts, Important Rules, and Action Steps. Keep it concise:\n\n${note.content}`,
      takeaways: `Extract the top 5 key trading takeaways from this note. Number them 1-5 and make each one actionable:\n\n${note.content}`,
    };

    if (!prompts[operation]) { res.status(400).json({ error: "Invalid operation" }); return; }

    const client = groqClient();
    const chat = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: "You are an expert trading educator. Provide clear, concise, actionable trading education content." },
        { role: "user", content: prompts[operation] },
      ],
      max_tokens: 1000,
    });

    res.json({ result: chat.choices[0]?.message?.content ?? "" });
  } catch (e) {
    logger.error({ err: e }, "POST /academy/notes/:id/ai");
    res.status(500).json({ error: "AI operation failed" });
  }
});

/* GET /api/academy/dashboard — dashboard stats */
router.get("/academy/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  try {
    const [xpRow] = await db.select().from(academyXpTable).where(eq(academyXpTable.userId, userId)).limit(1);

    const progress = await db.select().from(academyUserProgressTable)
      .where(eq(academyUserProgressTable.userId, userId));

    const attempts = await db.select().from(academyQuizAttemptsTable)
      .where(eq(academyQuizAttemptsTable.userId, userId))
      .orderBy(desc(academyQuizAttemptsTable.completedAt));

    const [{ noteCount }] = await db.select({ noteCount: drizzleCount() }).from(academyNotesTable)
      .where(eq(academyNotesTable.userId, userId));

    const certs = await db.select().from(academyCertificatesTable).where(eq(academyCertificatesTable.userId, userId));

    const quizAccuracy = attempts.length > 0
      ? Math.round(attempts.reduce((s, a) => s + (a.score / a.totalQuestions), 0) / attempts.length * 100)
      : 0;

    // Path progress
    const courses = await db.select().from(academyCoursesTable).where(eq(academyCoursesTable.published, true));
    const allLessons = await db.select({ id: academyLessonsTable.id, courseId: academyLessonsTable.courseId })
      .from(academyLessonsTable).where(eq(academyLessonsTable.published, true));
    const completedSet = new Set(progress.map(p => p.lessonId));

    const pathProgress: Record<string, { total: number; completed: number; quizScore: number | null }> = {};
    for (const path of ["beginner", "intermediate", "advanced", "professional"]) {
      const pathCourseIds = courses.filter(c => c.pathId === path).map(c => c.id);
      const pathLessons = allLessons.filter(l => pathCourseIds.includes(l.courseId));
      const pathCompleted = pathLessons.filter(l => completedSet.has(l.id)).length;
      const pathAttempts = attempts.filter(a => pathCourseIds.includes(a.courseId));
      const pathScore = pathAttempts.length > 0
        ? Math.round(pathAttempts.reduce((s, a) => s + (a.score / a.totalQuestions), 0) / pathAttempts.length * 100)
        : null;
      pathProgress[path] = { total: pathLessons.length, completed: pathCompleted, quizScore: pathScore };
    }

    // Last lesson
    let lastLesson = null;
    if (progress.length > 0) {
      const lastProgress = progress.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
      const [lesson] = await db.select().from(academyLessonsTable).where(eq(academyLessonsTable.id, lastProgress.lessonId)).limit(1);
      if (lesson) {
        const [course] = await db.select().from(academyCoursesTable).where(eq(academyCoursesTable.id, lesson.courseId)).limit(1);
        lastLesson = { id: lesson.id, title: lesson.title, courseTitle: course?.title ?? "" };
      }
    }

    res.json({
      xp: {
        xp: xpRow?.xp ?? 0, level: xpRow?.level ?? 1, badges: xpRow?.badges ?? [],
        streakDays: xpRow?.streakDays ?? 0, longestStreak: xpRow?.longestStreak ?? 0,
        totalStudyMinutes: xpRow?.totalStudyMinutes ?? 0,
      },
      totalLessonsCompleted: progress.length,
      totalStudyMinutes: xpRow?.totalStudyMinutes ?? 0,
      quizAccuracy,
      notesCreated: Number(noteCount),
      certificatesEarned: certs.length,
      pathProgress,
      recentActivity: [],
      lastLesson,
    });
  } catch (e) {
    logger.error({ err: e }, "GET /academy/dashboard");
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

/* POST /api/academy/ai/chat — AI study assistant */
router.post("/academy/ai/chat", requireAuth, async (req, res): Promise<void> => {
  const { message, lessonContext, history } = req.body as {
    message: string;
    lessonContext?: string;
    history?: Array<{ role: string; content: string }>;
  };

  if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }

  try {
    const client = groqClient();

    const systemPrompt = `You are the Trade Lab Academy AI Tutor — a professional trading educator with decades of experience.

${lessonContext ? `CURRENT LESSON CONTEXT:\n${lessonContext}\n\nYour primary role is to help the student understand THIS specific lesson content. Answer questions based on this material first.` : ""}

GUIDELINES:
- Explain concepts clearly using simple language and real examples
- Use market examples (BTC, EURUSD, gold, etc.) to illustrate points
- Be encouraging but honest — correct misconceptions firmly but kindly
- Keep answers focused and educational, not overwhelming
- If asked to summarize a lesson, provide structured key points
- If asked to quiz the student, create relevant questions with explanations
- Never provide financial advice or specific trade recommendations

TOPICS YOU EXCEL AT: Candlestick analysis, Support/Resistance, Trends, Risk Management, Price Action, Supply/Demand, Market Structure, ICT/SMC Concepts, Order Blocks, FVGs, Liquidity, Trading Psychology`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).slice(-8).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ];

    const chat = await client.chat.completions.create({
      model: GROQ_MODEL, messages, max_tokens: 800,
    });

    res.json({ reply: chat.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again." });
  } catch (e) {
    logger.error({ err: e }, "POST /academy/ai/chat");
    res.status(500).json({ error: "AI tutor unavailable" });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   ADMIN ROUTES
═══════════════════════════════════════════════════════════════════ */

/* POST /api/academy/admin/courses — create course */
router.post("/academy/admin/courses", requireAdmin, async (req, res): Promise<void> => {
  const { title, description, category, difficulty, pathId, thumbnailEmoji, estimatedMinutes, sortOrder } = req.body;
  if (!title || !description || !category || !difficulty || !pathId) {
    res.status(400).json({ error: "title, description, category, difficulty, pathId required" }); return;
  }
  try {
    const [course] = await db.insert(academyCoursesTable).values({
      title, description, category, difficulty, pathId,
      thumbnailEmoji: thumbnailEmoji ?? "📚",
      estimatedMinutes: estimatedMinutes ?? 30,
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.json(course);
  } catch (e) {
    logger.error({ err: e }, "POST /academy/admin/courses");
    res.status(500).json({ error: "Failed to create course" });
  }
});

/* PUT /api/academy/admin/courses/:id — update course */
router.put("/academy/admin/courses/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  try {
    const [updated] = await db.update(academyCoursesTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(academyCoursesTable.id, id)).returning();
    res.json(updated);
  } catch (e) {
    logger.error({ err: e }, "PUT /academy/admin/courses/:id");
    res.status(500).json({ error: "Failed to update course" });
  }
});

/* DELETE /api/academy/admin/courses/:id */
router.delete("/academy/admin/courses/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  try {
    await db.delete(academyLessonsTable).where(eq(academyLessonsTable.courseId, id));
    await db.delete(academyQuizQuestionsTable).where(eq(academyQuizQuestionsTable.courseId, id));
    await db.delete(academyCoursesTable).where(eq(academyCoursesTable.id, id));
    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "DELETE /academy/admin/courses/:id");
    res.status(500).json({ error: "Failed to delete course" });
  }
});

/* POST /api/academy/admin/courses/:id/lessons */
router.post("/academy/admin/courses/:id/lessons", requireAdmin, async (req, res): Promise<void> => {
  const courseId = Number(req.params["id"]);
  const { title, type, content, videoUrl, estimatedMinutes, sortOrder } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  try {
    const [lesson] = await db.insert(academyLessonsTable).values({
      courseId, title, type: type ?? "article", content: content ?? "",
      videoUrl: videoUrl ?? null, estimatedMinutes: estimatedMinutes ?? 10,
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.json(lesson);
  } catch (e) {
    logger.error({ err: e }, "POST /academy/admin/courses/:id/lessons");
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

/* PUT /api/academy/admin/lessons/:id */
router.put("/academy/admin/lessons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  try {
    const [updated] = await db.update(academyLessonsTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(academyLessonsTable.id, id)).returning();
    res.json(updated);
  } catch (e) {
    logger.error({ err: e }, "PUT /academy/admin/lessons/:id");
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

/* DELETE /api/academy/admin/lessons/:id */
router.delete("/academy/admin/lessons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  try {
    await db.delete(academyLessonsTable).where(eq(academyLessonsTable.id, id));
    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "DELETE /academy/admin/lessons/:id");
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

/* POST /api/academy/admin/courses/:id/quiz — add quiz question */
router.post("/academy/admin/courses/:id/quiz", requireAdmin, async (req, res): Promise<void> => {
  const courseId = Number(req.params["id"]);
  const { question, type, options, correctIndex, explanation, sortOrder } = req.body;
  if (!question || !options || correctIndex === undefined) {
    res.status(400).json({ error: "question, options, correctIndex required" }); return;
  }
  try {
    const [q] = await db.insert(academyQuizQuestionsTable).values({
      courseId, question, type: type ?? "mcq", options, correctIndex,
      explanation: explanation ?? "", sortOrder: sortOrder ?? 0,
    }).returning();
    res.json(q);
  } catch (e) {
    logger.error({ err: e }, "POST /academy/admin/courses/:id/quiz");
    res.status(500).json({ error: "Failed to add question" });
  }
});

/* GET /api/academy/admin/analytics */
router.get("/academy/admin/analytics", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [{ totalStudents }] = await db.select({ totalStudents: drizzleCount() }).from(academyXpTable);
    const [{ totalLessonsCompleted }] = await db.select({ totalLessonsCompleted: drizzleCount() }).from(academyUserProgressTable);
    const [{ totalQuizAttempts }] = await db.select({ totalQuizAttempts: drizzleCount() }).from(academyQuizAttemptsTable);
    const [{ totalNotes }] = await db.select({ totalNotes: drizzleCount() }).from(academyNotesTable);
    const [{ totalCerts }] = await db.select({ totalCerts: drizzleCount() }).from(academyCertificatesTable);

    const allAttempts = await db.select().from(academyQuizAttemptsTable);
    const avgScore = allAttempts.length > 0
      ? Math.round(allAttempts.reduce((s, a) => s + (a.score / a.totalQuestions), 0) / allAttempts.length * 100)
      : 0;

    const courses = await db.select().from(academyCoursesTable).where(eq(academyCoursesTable.published, true));

    res.json({
      totalStudents: Number(totalStudents),
      totalLessonsCompleted: Number(totalLessonsCompleted),
      totalQuizAttempts: Number(totalQuizAttempts),
      totalNotes: Number(totalNotes),
      totalCerts: Number(totalCerts),
      averageQuizScore: avgScore,
      totalCourses: courses.length,
    });
  } catch (e) {
    logger.error({ err: e }, "GET /academy/admin/analytics");
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
