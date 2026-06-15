import { db, backtestsTable, tradesTable, journalEntriesTable, paperTradesTable, strategiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export interface SessionStat {
  label: string;
  wins: number;
  losses: number;
  trades: number;
  winRate: number;
  avgPnlPct: number;
}

export interface SymbolStat {
  symbol: string;
  trades: number;
  winRate: number;
  avgReturn: number;
}

export interface StrategyTypeStat {
  type: string;
  count: number;
  avgReturn: number;
  avgWinRate: number;
}

export interface FlatTrade {
  symbol: string;
  side: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  durationDays: number;
  strategyType?: string;
}

export interface TraderProfile {
  userId: number;
  totalTrades: number;
  avgWinRate: number;
  avgReturn: number;
  avgDrawdown: number;
  avgSharpe: number;
  avgHoldingDays: number;
  preferredSide: "long" | "short" | "mixed";
  traderStyle: string;
  topSymbols: SymbolStat[];
  sessionStats: SessionStat[];
  strategyStats: StrategyTypeStat[];
  recentTrades: FlatTrade[];
  winningTrades: FlatTrade[];
  losingTrades: FlatTrade[];
  journalMistakes: { label: string; count: number }[];
  backtestCount: number;
}

function getMarket(symbol: string): string {
  const crypto = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LINK", "USDT"];
  const forex   = ["EUR", "GBP", "USD", "JPY", "AUD", "CAD", "CHF", "NZD"];
  if (crypto.some(c => symbol.includes(c))) return "Crypto";
  if (forex.some(f => symbol.startsWith(f) || symbol.endsWith(f))) return "Forex";
  return "Stocks";
}

function avgOf(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export async function extractTraderProfile(userId: number): Promise<TraderProfile> {
  const [backtests, strategies, journals, paperTrades] = await Promise.all([
    db.select().from(backtestsTable)
      .where(eq(backtestsTable.userId, userId))
      .orderBy(desc(backtestsTable.createdAt))
      .limit(100),
    db.select().from(strategiesTable)
      .where(eq(strategiesTable.userId, userId))
      .limit(50),
    db.select({ mistakes: journalEntriesTable.mistakes, emotionPre: journalEntriesTable.emotionPre })
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId))
      .limit(100),
    db.select().from(paperTradesTable)
      .where(eq(paperTradesTable.userId, userId))
      .limit(200),
  ]);

  const completed = backtests.filter(b => b.status === "complete");

  // Build strategy type lookup
  const stratMap: Record<number, string> = {};
  for (const s of strategies) {
    stratMap[s.id] = (s.parameters as { strategyType?: string } | null)?.strategyType ?? s.name ?? "unknown";
  }

  // Load trades for completed backtests
  let btTrades: FlatTrade[] = [];
  if (completed.length > 0) {
    const tradeRows = await db.select({
      symbol: tradesTable.symbol,
      side: tradesTable.side,
      entryDate: tradesTable.entryDate,
      exitDate: tradesTable.exitDate,
      entryPrice: tradesTable.entryPrice,
      exitPrice: tradesTable.exitPrice,
      pnl: tradesTable.pnl,
      pnlPercent: tradesTable.pnlPercent,
      strategyId: backtestsTable.strategyId,
    })
      .from(tradesTable)
      .innerJoin(backtestsTable, eq(tradesTable.backtestId, backtestsTable.id))
      .where(eq(backtestsTable.userId, userId))
      .limit(500);

    btTrades = tradeRows.map(t => ({
      symbol: t.symbol,
      side: t.side,
      entryDate: t.entryDate,
      exitDate: t.exitDate,
      entryPrice: Number(t.entryPrice),
      exitPrice: Number(t.exitPrice),
      pnl: Number(t.pnl),
      pnlPercent: Number(t.pnlPercent),
      durationDays: Math.max(0, (new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 86400000),
      strategyType: stratMap[t.strategyId] ?? undefined,
    }));
  }

  // Paper trades as flat trades
  const ptFlat: FlatTrade[] = paperTrades
    .filter(t => t.exitPrice != null)
    .map(t => ({
      symbol: t.symbol,
      side: t.side,
      entryDate: new Date(Number(t.entryTime)).toISOString().split("T")[0]!,
      exitDate: new Date(Number(t.exitTime ?? t.entryTime)).toISOString().split("T")[0]!,
      entryPrice: Number(t.entryPrice),
      exitPrice: Number(t.exitPrice ?? t.entryPrice),
      pnl: Number(t.pnl ?? 0),
      pnlPercent: Number(t.pnlPct ?? 0),
      durationDays: Math.max(0, (Number(t.exitTime ?? t.entryTime) - Number(t.entryTime)) / 86400000),
    }));

  const allTrades = [...btTrades, ...ptFlat];
  const totalTrades = allTrades.length;

  const avgWinRate  = avgOf(completed.map(b => Number(b.winRate ?? 0)));
  const avgReturn   = avgOf(completed.map(b => Number(b.totalReturn ?? 0)));
  const avgDrawdown = avgOf(completed.map(b => Number(b.maxDrawdown ?? 0)));
  const avgSharpe   = avgOf(completed.map(b => Number(b.sharpeRatio ?? 0)));
  const avgHoldingDays = allTrades.length > 0 ? avgOf(allTrades.map(t => t.durationDays)) : 0;

  const longs  = allTrades.filter(t => t.side === "long").length;
  const shorts = allTrades.filter(t => t.side === "short").length;
  const preferredSide: "long" | "short" | "mixed" =
    longs > shorts * 1.5 ? "long" :
    shorts > longs * 1.5 ? "short" : "mixed";

  let traderStyle = "Developing";
  if (avgHoldingDays < 1)       traderStyle = "Scalper";
  else if (avgHoldingDays < 7)  traderStyle = "Swing Trader";
  else if (avgHoldingDays < 30) traderStyle = "Position Trader";
  else                          traderStyle = "Long-Term Investor";

  // Symbol stats
  const symbolMap: Record<string, { wins: number; losses: number; returnSum: number }> = {};
  for (const t of allTrades) {
    if (!symbolMap[t.symbol]) symbolMap[t.symbol] = { wins: 0, losses: 0, returnSum: 0 };
    if (t.pnl > 0) symbolMap[t.symbol].wins++;
    else symbolMap[t.symbol].losses++;
    symbolMap[t.symbol].returnSum += t.pnlPercent;
  }
  const topSymbols: SymbolStat[] = Object.entries(symbolMap)
    .map(([symbol, s]) => {
      const total = s.wins + s.losses;
      return { symbol, trades: total, winRate: total ? (s.wins / total) * 100 : 0, avgReturn: total ? s.returnSum / total : 0 };
    })
    .sort((a, b) => b.trades - a.trades)
    .slice(0, 5);

  // Strategy type stats
  const stratTypeMap: Record<string, { count: number; returnSum: number; winRateSum: number; btCount: number }> = {};
  for (const b of completed) {
    const type = stratMap[b.strategyId] ?? "unknown";
    if (!stratTypeMap[type]) stratTypeMap[type] = { count: 0, returnSum: 0, winRateSum: 0, btCount: 0 };
    stratTypeMap[type].count++;
    stratTypeMap[type].returnSum += Number(b.totalReturn ?? 0);
    stratTypeMap[type].winRateSum += Number(b.winRate ?? 0);
    stratTypeMap[type].btCount++;
  }
  const strategyStats: StrategyTypeStat[] = Object.entries(stratTypeMap)
    .map(([type, s]) => ({
      type,
      count: s.count,
      avgReturn: s.btCount ? s.returnSum / s.btCount : 0,
      avgWinRate: s.btCount ? s.winRateSum / s.btCount : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Session stats from trades
  const SESSION_ORDER = ["Asian Session", "London Open", "New York Open", "New York Close"];
  const sessionMap: Record<string, { wins: number; losses: number; pnlSum: number }> = {};
  for (const t of allTrades) {
    const mkt = getMarket(t.symbol);
    const ses = mkt === "Stocks" ? "New York Open" : mkt === "Forex" ? "London Open" : "Asian Session";
    if (!sessionMap[ses]) sessionMap[ses] = { wins: 0, losses: 0, pnlSum: 0 };
    if (t.pnl > 0) sessionMap[ses].wins++;
    else sessionMap[ses].losses++;
    sessionMap[ses].pnlSum += t.pnlPercent;
  }
  const sessionStats: SessionStat[] = Object.entries(sessionMap)
    .map(([label, s]) => {
      const total = s.wins + s.losses;
      return { label, wins: s.wins, losses: s.losses, trades: total, winRate: total ? (s.wins / total) * 100 : 0, avgPnlPct: total ? s.pnlSum / total : 0 };
    })
    .sort((a, b) => SESSION_ORDER.indexOf(a.label) - SESSION_ORDER.indexOf(b.label));

  // Journal mistakes
  const mistakeCounts: Record<string, number> = {};
  for (const j of journals) {
    const arr = j.mistakes as string[] | null;
    if (arr) for (const m of arr) mistakeCounts[m] = (mistakeCounts[m] ?? 0) + 1;
  }
  const journalMistakes = Object.entries(mistakeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const winningTrades = allTrades.filter(t => t.pnl > 0).slice(0, 50);
  const losingTrades  = allTrades.filter(t => t.pnl <= 0).slice(0, 50);
  const recentTrades  = allTrades.slice(0, 20);

  return {
    userId,
    totalTrades,
    avgWinRate,
    avgReturn,
    avgDrawdown,
    avgSharpe,
    avgHoldingDays,
    preferredSide,
    traderStyle,
    topSymbols,
    sessionStats,
    strategyStats,
    recentTrades,
    winningTrades,
    losingTrades,
    journalMistakes,
    backtestCount: completed.length,
  };
}

// Representative archetype trades used as Ghost Mode baseline when a user has no personal history.
// Covers crypto, forex, stocks, and commodities with realistic win/loss distributions.
export const GHOST_ARCHETYPES: Array<{
  symbol: string; side: string; durationDays: number; pnlPercent: number; pnl: number;
  strategyType: string; entryDate: string; exitDate: string; entryPrice: number; exitPrice: number;
}> = [
  { symbol: "BTCUSDT",  side: "long",  durationDays: 3.2, pnlPercent:  8.4,  pnl:  840,  strategyType: "sma_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "BTCUSDT",  side: "long",  durationDays: 1.1, pnlPercent: -2.3,  pnl: -230,  strategyType: "rsi",             entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "BTCUSDT",  side: "short", durationDays: 2.5, pnlPercent:  5.1,  pnl:  510,  strategyType: "macd",            entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "BTCUSDT",  side: "short", durationDays: 0.9, pnlPercent: -3.8,  pnl: -380,  strategyType: "ema_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "ETHUSDT",  side: "long",  durationDays: 5.5, pnlPercent: 12.1,  pnl: 1210,  strategyType: "macd",            entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "ETHUSDT",  side: "long",  durationDays: 0.8, pnlPercent: -3.1,  pnl: -310,  strategyType: "bollinger_bands", entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "ETHUSDT",  side: "short", durationDays: 4.2, pnlPercent:  7.8,  pnl:  780,  strategyType: "ema_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "SOLUSDT",  side: "long",  durationDays: 2.1, pnlPercent: 15.4,  pnl: 1540,  strategyType: "ema_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "SOLUSDT",  side: "long",  durationDays: 1.5, pnlPercent: -4.2,  pnl: -420,  strategyType: "sma_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "BNBUSDT",  side: "long",  durationDays: 4.8, pnlPercent:  6.3,  pnl:  630,  strategyType: "macd",            entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "XRPUSDT",  side: "long",  durationDays: 3.5, pnlPercent:  9.7,  pnl:  970,  strategyType: "rsi",             entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "XRPUSDT",  side: "short", durationDays: 1.2, pnlPercent: -5.6,  pnl: -560,  strategyType: "bollinger_bands", entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "ADAUSDT",  side: "long",  durationDays: 7.1, pnlPercent: 18.2,  pnl: 1820,  strategyType: "sma_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "DOGEUSDT", side: "long",  durationDays: 2.4, pnlPercent: -2.8,  pnl: -280,  strategyType: "macd",            entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "AVAXUSDT", side: "long",  durationDays: 3.9, pnlPercent: 11.5,  pnl: 1150,  strategyType: "ema_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "LINKUSDT", side: "long",  durationDays: 2.7, pnlPercent:  7.2,  pnl:  720,  strategyType: "rsi",             entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "EURUSD",   side: "long",  durationDays: 1.5, pnlPercent:  0.8,  pnl:   80,  strategyType: "ema_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "EURUSD",   side: "short", durationDays: 2.1, pnlPercent: -0.5,  pnl:  -50,  strategyType: "macd",            entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "GBPUSD",   side: "long",  durationDays: 3.2, pnlPercent:  1.2,  pnl:  120,  strategyType: "bollinger_bands", entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "USDJPY",   side: "short", durationDays: 4.5, pnlPercent:  1.8,  pnl:  180,  strategyType: "sma_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "AUDUSD",   side: "long",  durationDays: 2.8, pnlPercent: -0.9,  pnl:  -90,  strategyType: "rsi",             entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "AAPL",     side: "long",  durationDays: 8.3, pnlPercent:  5.4,  pnl:  540,  strategyType: "sma_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "NVDA",     side: "long",  durationDays: 5.1, pnlPercent: 14.2,  pnl: 1420,  strategyType: "macd",            entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "NVDA",     side: "long",  durationDays: 2.4, pnlPercent: -6.8,  pnl: -680,  strategyType: "rsi",             entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "TSLA",     side: "long",  durationDays: 6.2, pnlPercent:  8.9,  pnl:  890,  strategyType: "ema_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "XAUUSD",   side: "long",  durationDays: 3.8, pnlPercent:  2.1,  pnl:  210,  strategyType: "bollinger_bands", entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
  { symbol: "WTIUSD",   side: "short", durationDays: 2.5, pnlPercent:  3.4,  pnl:  340,  strategyType: "sma_crossover",   entryDate: "", exitDate: "", entryPrice: 0, exitPrice: 0 },
];
