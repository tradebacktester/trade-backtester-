import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Star, ArrowUpRight, ArrowDownRight, RefreshCw,
  ChevronRight, Sparkles, Clock, BarChart2, X,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScreenerRow {
  symbol: string; name: string; ticker: string; sector: string;
  assetType: "crypto" | "forex" | "stock" | "index" | "commodity";
  price: number; change24h: number; change7d: number; volume24h: number;
  rsi: number; rsiSignal: string; macd: "bullish" | "bearish" | "neutral";
  trend: "bullish" | "bearish"; bbPosition: number; vwap: number;
  dataSource: "live" | "simulated"; mcapRank: number;
  category?: AssetCategory;
}

// ── Asset Categories ──────────────────────────────────────────────────────────
type AssetCategory =
  | "all"
  | "crypto" | "stocks" | "forex" | "futures" | "indices" | "commodities" | "etfs"
  | "bonds" | "treasury" | "volatility" | "currency-idx" | "crypto-dom"
  | "sector-idx" | "global" | "economic"
  | "agriculture" | "energy" | "livestock" | "soft-comm" | "carbon" | "freight";

interface CatDef { id: AssetCategory; label: string; color: string; }
const CATEGORY_GROUPS: { group: string; label: string; items: CatDef[] }[] = [
  {
    group: "meta", label: "",
    items: [{ id: "all", label: "All", color: "rgba(255,255,255,0.85)" }],
  },
  {
    group: "core", label: "Core",
    items: [
      { id: "crypto",      label: "Crypto",      color: "#f59e0b" },
      { id: "stocks",      label: "Stocks",      color: "#3b82f6" },
      { id: "forex",       label: "Forex",       color: "#10b981" },
      { id: "futures",     label: "Futures",     color: "#8b5cf6" },
      { id: "indices",     label: "Indices",     color: "#06b6d4" },
      { id: "commodities", label: "Commodities", color: "#ef4444" },
      { id: "etfs",        label: "ETFs",        color: "#a78bfa" },
    ],
  },
  {
    group: "advanced", label: "Advanced",
    items: [
      { id: "bonds",        label: "Bonds",           color: "#6366f1" },
      { id: "treasury",     label: "Yields",          color: "#818cf8" },
      { id: "volatility",   label: "Volatility",      color: "#f43f5e" },
      { id: "currency-idx", label: "Currency Idx",    color: "#22d3ee" },
      { id: "crypto-dom",   label: "Crypto Dom",      color: "#fb923c" },
      { id: "sector-idx",   label: "Sector Indices",  color: "#84cc16" },
      { id: "global",       label: "Global Markets",  color: "#e879f9" },
      { id: "economic",     label: "Economic",        color: "#94a3b8" },
    ],
  },
  {
    group: "exotic", label: "Exotic",
    items: [
      { id: "agriculture", label: "Agriculture",      color: "#65a30d" },
      { id: "energy",      label: "Energy",           color: "#ea580c" },
      { id: "livestock",   label: "Livestock",        color: "#92400e" },
      { id: "soft-comm",   label: "Soft Commodities", color: "#d97706" },
      { id: "carbon",      label: "Carbon Credits",   color: "#16a34a" },
      { id: "freight",     label: "Freight Indices",  color: "#475569" },
    ],
  },
];
const ALL_CATS: CatDef[] = CATEGORY_GROUPS.flatMap(g => g.items);
function catColor(id: AssetCategory): string {
  return ALL_CATS.find(c => c.id === id)?.color ?? "rgba(255,255,255,0.85)";
}

// Derive category from screener assetType
function screenerCat(r: ScreenerRow): AssetCategory {
  const m: Record<string, AssetCategory> = { crypto: "crypto", stock: "stocks", forex: "forex", index: "indices", commodity: "commodities" };
  return m[r.assetType] ?? "stocks";
}
function getRowCategory(r: ScreenerRow): AssetCategory {
  return r.category ?? screenerCat(r);
}

// ── Chart Symbol Mapping ──────────────────────────────────────────────────────
// Maps display symbol → chart-compatible symbol (Yahoo Finance or Binance)
const CHART_SYMBOL_MAP: Record<string, string> = {
  // Legacy
  SPX: "SPX500", NDX: "NAS100",
  // Index futures
  "ES1!": "ES=F", "NQ1!": "NQ=F",
  // Commodity futures
  "CL1!": "CL=F", "GC1!": "GC=F", "SI1!": "SI=F",
  // US Indices
  DOWJONES: "^DJI", SP500: "^GSPC", RUSSELL2000: "^RUT",
  // International Indices
  NIFTY50: "^NSEI", BANKNIFTY: "^NSEBANK",
  DAX: "^GDAXI", FTSE100: "^FTSE",
  NIKKEI225: "^N225", HANGSENG: "^HSI",
  CSI300: "000300.SS", KOSPI: "^KS11", ASX200: "^AXJO", SENSEX: "^BSESN",
  CAC40: "^FCHI", IBEX35: "^IBEX", AEX: "^AEX", SMI: "^SSMI",
  // Treasury yields
  US10Y: "^TNX", US02Y: "^IRX", US30Y: "^TYX", US05Y: "^FVX",
  BUND10Y: "^TNX", GILTS10Y: "^TNX",
  // Volatility
  VIX: "^VIX",
  // Currency indices
  DXY: "DX-Y.NYB",
  // Agriculture
  CORN: "ZC=F", WHEAT: "ZW=F", SOYBEANS: "ZS=F",
  COFFEE: "KC=F", SUGAR: "SB=F", COTTON: "CT=F",
  OATS: "ZO=F", RICE: "ZR=F",
  // Energy
  CRUDEOIL: "CL=F", NATGAS: "NG=F", BRENT: "BZ=F",
  HEATINGOIL: "HO=F", GASOIL: "BZ=F", URANIUM: "CL=F",
  // Livestock
  LIVECATTLE: "LE=F", LEANHOGS: "HE=F", FEEDERCATTLE: "GF=F",
  // Soft commodities
  COCOA: "CC=F", OJ: "OJ=F", LUMBER: "LB=F",
  // Metals (commodities)
  GOLD: "GC=F", SILVER: "SI=F", COPPER: "HG=F", PLATINUM: "PL=F", PALLADIUM: "PA=F",
  // Crypto dominance (proxy to underlying)
  "BTC.D": "BTCUSDT", "ETH.D": "ETHUSDT", "ALTCOIN.D": "SOLUSDT",
  // Carbon/Freight (simulated fallback)
  EUA: "GC=F", CA_CARBON: "GC=F", RGGI: "GC=F",
  BDI: "CL=F", CAPESIZE: "CL=F", VLCC: "CL=F",
  // Economic → proxy
  GDP: "SPY", CPI: "TLT", FEDFUNDS: "^TNX",
};
function toChartSymbol(sym: string): string { return CHART_SYMBOL_MAP[sym] ?? sym; }

// ── Static Asset Registry ─────────────────────────────────────────────────────
// Covers all categories NOT served by the live screener API.
// Prices are realistic approximations as of mid-2026.
function sa(
  symbol: string, ticker: string, name: string, category: AssetCategory,
  price: number, c24: number, c7d: number, vol: number,
  rsi: number, macd: "bullish" | "bearish" | "neutral",
  trend: "bullish" | "bearish", bb: number, rank: number
): ScreenerRow {
  return {
    symbol, ticker, name, sector: category, assetType: "stock",
    price, change24h: c24, change7d: c7d, volume24h: vol,
    rsi, rsiSignal: rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral",
    macd, trend, bbPosition: bb, vwap: price * 0.998,
    dataSource: "simulated", mcapRank: rank, category,
  };
}

const STATIC_ASSETS: ScreenerRow[] = [
  // ── Futures ───────────────────────────────────────────────────────────────
  sa("ES1!", "ES1!", "S&P 500 E-Mini",      "futures", 5280,  0.42, 1.85, 280_000_000_000, 56, "bullish", "bullish", 60, 1),
  sa("NQ1!", "NQ1!", "NASDAQ 100 E-Mini",   "futures", 18620, 0.68, 2.40, 180_000_000_000, 58, "bullish", "bullish", 63, 2),
  sa("CL1!", "CL1!", "Crude Oil Futures",   "futures", 78.20, -0.31, -1.2, 95_000_000_000,  48, "neutral", "bearish", 45, 3),
  sa("GC1!", "GC1!", "Gold Futures",        "futures", 2345, 0.28, 1.10,  58_000_000_000,  52, "bullish", "bullish", 55, 4),
  sa("SI1!", "SI1!", "Silver Futures",      "futures", 28.40, 0.55, 2.30, 18_000_000_000,  54, "bullish", "bullish", 58, 5),
  sa("BTCPERP", "BTC-PERP", "BTC Perpetual Futures", "futures", 67500, 2.1, 5.4, 980_000_000, 58, "bullish", "bullish", 62, 6),
  sa("ETHPERP", "ETH-PERP", "ETH Perpetual Futures", "futures", 3530, 1.4, 3.2, 450_000_000, 54, "bullish", "bullish", 55, 7),
  sa("SOLPERP", "SOL-PERP", "SOL Perpetual Futures", "futures", 183, 3.2, 8.1, 180_000_000, 62, "bullish", "bullish", 68, 8),

  // ── ETFs ──────────────────────────────────────────────────────────────────
  sa("SPY",  "SPY",  "SPDR S&P 500 ETF",          "etfs", 524.80, 0.38, 1.72, 25_000_000_000, 57, "bullish", "bullish", 61, 1),
  sa("QQQ",  "QQQ",  "Invesco NASDAQ-100 ETF",    "etfs", 451.20, 0.61, 2.35, 18_000_000_000, 59, "bullish", "bullish", 64, 2),
  sa("VTI",  "VTI",  "Vanguard Total Market ETF", "etfs", 262.40, 0.31, 1.55, 4_500_000_000,  55, "bullish", "bullish", 58, 3),
  sa("DIA",  "DIA",  "SPDR Dow Jones ETF",        "etfs", 401.80, 0.22, 0.98, 3_200_000_000,  53, "neutral", "bullish", 54, 4),
  sa("IWM",  "IWM",  "iShares Russell 2000 ETF",  "etfs", 202.50, -0.18, -0.8, 8_100_000_000, 46, "neutral", "bearish", 44, 5),
  sa("GLD",  "GLD",  "SPDR Gold Shares ETF",      "etfs", 219.40, 0.28, 1.08, 2_800_000_000,  52, "bullish", "bullish", 55, 6),
  sa("TLT",  "TLT",  "iShares 20+ Year Treasury", "etfs", 93.20, -0.45, -1.2, 2_200_000_000,  41, "bearish", "bearish", 38, 7),
  sa("XLF",  "XLF",  "Financial Sector SPDR",     "etfs", 42.30, 0.52, 1.80, 3_500_000_000,  58, "bullish", "bullish", 62, 8),
  sa("ARKK", "ARKK", "ARK Innovation ETF",        "etfs", 55.80, 1.18, 4.20, 920_000_000,    63, "bullish", "bullish", 68, 9),
  sa("SQQQ", "SQQQ", "ProShares UltraPro Short",  "etfs", 9.80, -1.85, -7.1, 1_400_000_000,  38, "bearish", "bearish", 32, 10),
  sa("UVXY", "UVXY", "ProShares Ultra VIX Short", "etfs", 6.40, 2.30, 8.50, 750_000_000,    65, "bullish", "bearish", 55, 11),
  sa("BND",  "BND",  "Vanguard Total Bond Market", "etfs", 74.20, -0.12, -0.4, 870_000_000,  48, "neutral", "bearish", 46, 12),

  // ── Bonds ─────────────────────────────────────────────────────────────────
  sa("US10Y",   "US10Y",  "US 10-Year Treasury",     "bonds", 4.48, 0.02, 0.08, 580_000_000_000, 50, "bearish", "bearish", 48, 1),
  sa("US02Y",   "US02Y",  "US 2-Year Treasury",      "bonds", 4.91, -0.01, 0.02, 420_000_000_000, 52, "neutral", "bearish", 52, 2),
  sa("US30Y",   "US30Y",  "US 30-Year Treasury",     "bonds", 4.63, 0.03, 0.12, 180_000_000_000, 48, "bearish", "bearish", 45, 3),
  sa("BUND10Y", "BUND",   "German 10-Year Bund",     "bonds", 2.51, 0.01, 0.05, 85_000_000_000,  49, "neutral", "bearish", 50, 4),
  sa("GILTS10Y","GILTS",  "UK 10-Year Gilts",        "bonds", 4.22, 0.02, 0.06, 72_000_000_000,  48, "neutral", "bearish", 47, 5),
  sa("JGB10Y",  "JGB",    "Japan 10-Year JGB",       "bonds", 0.93, 0.01, 0.04, 68_000_000_000,  51, "neutral", "bearish", 52, 6),
  sa("OAT10Y",  "OAT",    "French 10-Year OAT",      "bonds", 3.12, 0.02, 0.07, 52_000_000_000,  50, "neutral", "bearish", 50, 7),

  // ── Treasury Yields ───────────────────────────────────────────────────────
  sa("US01Y",   "1Y",     "US 1-Year Treasury Yield",  "treasury", 5.08, -0.02, -0.05, 140_000_000_000, 52, "neutral", "bearish", 52, 1),
  sa("US05Y",   "5Y",     "US 5-Year Treasury Yield",  "treasury", 4.61, 0.01, 0.04,  210_000_000_000, 50, "neutral", "bearish", 50, 2),
  sa("US10Y_Y", "10Y",    "US 10-Year Treasury Yield", "treasury", 4.48, 0.02, 0.08,  580_000_000_000, 50, "bearish", "bearish", 48, 3),
  sa("US30Y_Y", "30Y",    "US 30-Year Treasury Yield", "treasury", 4.63, 0.03, 0.12,  180_000_000_000, 48, "bearish", "bearish", 45, 4),
  sa("FEDFUNDS","FFR",    "Federal Funds Rate",        "treasury", 5.25, 0.00, 0.00,  0,               50, "neutral", "bearish", 50, 5),
  sa("EURIBOR", "EURIBOR","EURIBOR 3-Month",           "treasury", 3.62, -0.01, -0.04, 0,              49, "neutral", "bearish", 48, 6),
  sa("SOFR",    "SOFR",   "Secured Overnight Rate",    "treasury", 5.31, 0.00, 0.00,  0,               50, "neutral", "bearish", 50, 7),

  // ── Volatility Indices ────────────────────────────────────────────────────
  sa("VIX",     "VIX",    "CBOE Volatility Index",    "volatility", 14.52, -3.8, -8.2,  1_800_000_000, 38, "bearish", "bearish", 32, 1),
  sa("VIX9D",   "VIX9D",  "CBOE 9-Day VIX",           "volatility", 12.80, -2.4, -5.5, 380_000_000,   35, "bearish", "bearish", 30, 2),
  sa("SKEW",    "SKEW",   "CBOE Skew Index",           "volatility", 138.4, 0.80, 2.10, 0,             50, "neutral", "neutral", 50, 3),
  sa("VVIX",    "VVIX",   "VIX of VIX",               "volatility", 84.20, -1.5, -3.2, 0,             42, "bearish", "bearish", 40, 4),
  sa("MOVE",    "MOVE",   "MOVE Bond Volatility Idx",  "volatility", 92.10, 1.20, 3.50, 0,             55, "neutral", "bullish", 55, 5),
  sa("OVX",     "OVX",    "Oil Volatility Index",      "volatility", 28.40, -0.9, -2.1, 0,             44, "neutral", "bearish", 42, 6),
  sa("GVZ",     "GVZ",    "Gold Volatility Index",     "volatility", 16.80, -0.5, -1.2, 0,             46, "neutral", "bearish", 45, 7),

  // ── Currency Indices ──────────────────────────────────────────────────────
  sa("DXY",    "DXY",    "US Dollar Index",          "currency-idx", 104.18, 0.12, 0.45, 6_500_000_000, 55, "bullish", "bullish", 58, 1),
  sa("EXY",    "EXY",    "Euro Currency Index",      "currency-idx", 102.40, -0.08, -0.32, 2_200_000_000, 45, "neutral", "bearish", 44, 2),
  sa("GBPX",   "GBPX",   "British Pound Index",      "currency-idx", 101.80, 0.05, 0.18, 1_400_000_000, 52, "neutral", "bullish", 52, 3),
  sa("JPYX",   "JPYX",   "Japanese Yen Index",       "currency-idx", 94.20, -0.22, -0.80, 1_100_000_000, 38, "bearish", "bearish", 35, 4),
  sa("AUDX",   "AUDX",   "Australian Dollar Index",  "currency-idx", 100.60, -0.10, -0.40, 680_000_000,  47, "neutral", "bearish", 46, 5),
  sa("CADX",   "CADX",   "Canadian Dollar Index",    "currency-idx", 101.20, 0.04, 0.15, 720_000_000,   51, "neutral", "neutral", 51, 6),

  // ── Crypto Dominance ──────────────────────────────────────────────────────
  sa("BTC.D",      "BTC.D",     "Bitcoin Dominance",   "crypto-dom", 55.24, 0.42, 1.20, 0, 58, "bullish", "bullish", 62, 1),
  sa("ETH.D",      "ETH.D",     "Ethereum Dominance",  "crypto-dom", 17.85, -0.18, -0.55, 0, 44, "neutral", "bearish", 42, 2),
  sa("ALTCOIN.D",  "ALT.D",     "Altcoin Dominance",   "crypto-dom", 26.91, -0.24, -0.65, 0, 46, "neutral", "bearish", 44, 3),
  sa("STABLECOIN.D","STABLE.D", "Stablecoin Dominance","crypto-dom", 6.82, 0.01, 0.04, 0,   50, "neutral", "neutral", 50, 4),
  sa("DEFI.D",     "DEFI.D",    "DeFi Dominance",      "crypto-dom", 3.92, 0.08, 0.22, 0,   52, "bullish", "bullish", 55, 5),
  sa("OTHERS.D",   "OTHERS.D",  "Others (excl. top10)","crypto-dom", 12.40, -0.12, -0.35, 0, 45, "neutral", "bearish", 44, 6),

  // ── Sector Indices ────────────────────────────────────────────────────────
  sa("XLK",  "XLK",  "Technology Select Sector",   "sector-idx", 232.50, 0.82, 2.90, 4_200_000_000, 61, "bullish", "bullish", 65, 1),
  sa("XLV",  "XLV",  "Health Care Select Sector",  "sector-idx", 143.80, 0.14, 0.55, 1_800_000_000, 53, "neutral", "bullish", 54, 2),
  sa("XLE",  "XLE",  "Energy Select Sector",       "sector-idx", 89.60, -0.38, -1.40, 2_100_000_000, 46, "neutral", "bearish", 43, 3),
  sa("XLI",  "XLI",  "Industrials Select Sector",  "sector-idx", 128.40, 0.30, 1.10, 1_200_000_000, 56, "bullish", "bullish", 60, 4),
  sa("XLC",  "XLC",  "Communication Services",     "sector-idx", 95.20, 0.55, 2.00, 980_000_000,   58, "bullish", "bullish", 62, 5),
  sa("XLRE", "XLRE", "Real Estate Select Sector",  "sector-idx", 38.90, -0.22, -0.85, 720_000_000,  44, "neutral", "bearish", 42, 6),
  sa("XLP",  "XLP",  "Consumer Staples Sector",    "sector-idx", 79.20, 0.08, 0.30, 1_050_000_000,  51, "neutral", "neutral", 51, 7),
  sa("XLB",  "XLB",  "Materials Select Sector",    "sector-idx", 92.80, 0.20, 0.75, 850_000_000,   54, "neutral", "bullish", 55, 8),
  sa("XLU",  "XLU",  "Utilities Select Sector",    "sector-idx", 71.40, -0.15, -0.55, 680_000_000,  47, "neutral", "bearish", 45, 9),
  sa("XLY",  "XLY",  "Consumer Discretionary",     "sector-idx", 210.60, 0.45, 1.65, 1_350_000_000, 57, "bullish", "bullish", 61, 10),

  // ── Global Markets ────────────────────────────────────────────────────────
  sa("NIFTY50",   "NIFTY",    "NIFTY 50 (India)",        "global", 23_485, 0.48, 1.82, 8_200_000_000, 57, "bullish", "bullish", 61, 1),
  sa("BANKNIFTY", "BANKNIFTY","Bank NIFTY (India)",      "global", 50_820, 0.62, 2.20, 5_400_000_000, 59, "bullish", "bullish", 64, 2),
  sa("DAX",       "DAX",      "DAX 40 (Germany)",        "global", 18_840, 0.35, 1.25, 6_800_000_000, 55, "bullish", "bullish", 59, 3),
  sa("FTSE100",   "FTSE",     "FTSE 100 (UK)",           "global", 8_220, 0.18, 0.65, 5_100_000_000, 53, "neutral", "bullish", 55, 4),
  sa("NIKKEI225", "N225",     "Nikkei 225 (Japan)",      "global", 38_510, -0.42, -1.20, 7_200_000_000, 47, "neutral", "bearish", 44, 5),
  sa("HANGSENG",  "HSI",      "Hang Seng (Hong Kong)",   "global", 18_480, 0.85, 2.85, 6_500_000_000, 55, "bullish", "neutral", 58, 6),
  sa("CSI300",    "CSI300",   "CSI 300 (China)",         "global", 3_920, 0.42, 1.52, 9_800_000_000, 53, "neutral", "bullish", 55, 7),
  sa("KOSPI",     "KOSPI",    "KOSPI (South Korea)",     "global", 2_742, 0.28, 0.95, 4_200_000_000, 52, "neutral", "bullish", 54, 8),
  sa("ASX200",    "ASX200",   "ASX 200 (Australia)",     "global", 8_082, 0.22, 0.80, 3_100_000_000, 54, "neutral", "bullish", 56, 9),
  sa("SENSEX",    "SENSEX",   "BSE Sensex (India)",      "global", 77_400, 0.51, 1.90, 4_800_000_000, 57, "bullish", "bullish", 61, 10),
  sa("CAC40",     "CAC40",    "CAC 40 (France)",         "global", 8_092, 0.28, 1.02, 4_200_000_000, 54, "neutral", "bullish", 56, 11),
  sa("IBEX35",    "IBEX35",   "IBEX 35 (Spain)",         "global", 11_980, 0.32, 1.15, 2_800_000_000, 55, "bullish", "bullish", 58, 12),
  sa("AEX",       "AEX",      "AEX Index (Netherlands)", "global", 916, 0.40, 1.42, 1_900_000_000, 56, "bullish", "bullish", 59, 13),
  sa("SMI",       "SMI",      "Swiss Market Index",      "global", 12_280, 0.15, 0.55, 1_600_000_000, 52, "neutral", "bullish", 53, 14),
  sa("TSX",       "TSX",      "S&P/TSX Composite (CA)",  "global", 24_820, 0.20, 0.72, 3_500_000_000, 53, "neutral", "bullish", 55, 15),
  sa("BOVESPA",   "IBOV",     "IBOVESPA (Brazil)",       "global", 131_200, 0.38, 1.35, 5_200_000_000, 54, "neutral", "bullish", 57, 16),

  // ── Economic Indicators ───────────────────────────────────────────────────
  sa("US_GDP",      "GDP",      "US GDP Growth Rate",      "economic", 2.80, 0.00, 0.00, 0, 50, "neutral", "bullish", 55, 1),
  sa("US_CPI",      "CPI",      "US CPI (YoY)",            "economic", 3.20, 0.00, 0.00, 0, 50, "bearish", "bearish", 45, 2),
  sa("US_UNEMP",    "UNEMP",    "US Unemployment Rate",    "economic", 3.90, 0.00, 0.00, 0, 50, "neutral", "neutral", 50, 3),
  sa("FEDRATE",     "FEDRATE",  "Federal Funds Rate",      "economic", 5.25, 0.00, 0.00, 0, 50, "neutral", "bearish", 48, 4),
  sa("US_PMI",      "PMI",      "US Manufacturing PMI",    "economic", 51.8, 0.00, 0.00, 0, 54, "bullish", "bullish", 58, 5),
  sa("US_RETAIL",   "RETAIL",   "US Retail Sales (MoM)",   "economic", 0.40, 0.00, 0.00, 0, 52, "neutral", "bullish", 54, 6),
  sa("US_HOUSING",  "HOUSING",  "US Housing Starts",       "economic", 1.36, 0.00, 0.00, 0, 50, "neutral", "neutral", 50, 7),
  sa("EU_CPI",      "EU_CPI",   "EU CPI (YoY)",            "economic", 2.40, 0.00, 0.00, 0, 50, "neutral", "neutral", 50, 8),
  sa("CN_PMI",      "CN_PMI",   "China Manufacturing PMI", "economic", 50.3, 0.00, 0.00, 0, 51, "neutral", "neutral", 52, 9),
  sa("JP_CPI",      "JP_CPI",   "Japan CPI (YoY)",         "economic", 2.20, 0.00, 0.00, 0, 50, "neutral", "neutral", 50, 10),

  // ── Agriculture ───────────────────────────────────────────────────────────
  sa("CORN",     "CORN",    "Corn Futures (ZC=F)",     "agriculture", 441.25, -0.62, -2.1, 2_800_000_000, 44, "neutral", "bearish", 42, 1),
  sa("WHEAT",    "WHEAT",   "Wheat Futures (ZW=F)",    "agriculture", 592.80, 0.38, 1.25, 2_100_000_000, 48, "neutral", "neutral", 48, 2),
  sa("SOYBEANS", "SOY",     "Soybean Futures (ZS=F)",  "agriculture", 1185.50, -0.28, -0.95, 3_500_000_000, 46, "neutral", "bearish", 44, 3),
  sa("COFFEE",   "COFFEE",  "Coffee Futures (KC=F)",   "agriculture", 218.40, 1.20, 4.20, 1_200_000_000, 62, "bullish", "bullish", 68, 4),
  sa("SUGAR",    "SUGAR",   "Sugar Futures (SB=F)",    "agriculture", 19.82, -0.42, -1.50, 1_800_000_000, 43, "neutral", "bearish", 40, 5),
  sa("COTTON",   "COTTON",  "Cotton Futures (CT=F)",   "agriculture", 76.40, -0.18, -0.65, 920_000_000,   47, "neutral", "bearish", 45, 6),
  sa("OATS",     "OATS",    "Oat Futures (ZO=F)",      "agriculture", 332.50, 0.22, 0.80, 280_000_000,    50, "neutral", "neutral", 51, 7),
  sa("RICE",     "RICE",    "Rough Rice (ZR=F)",       "agriculture", 15.62, 0.08, 0.28, 180_000_000,     50, "neutral", "neutral", 50, 8),
  sa("PALMOIL",  "PALM",    "Palm Oil Futures",        "agriculture", 3_842, 0.35, 1.20, 580_000_000,     52, "neutral", "bullish", 53, 9),

  // ── Energy ────────────────────────────────────────────────────────────────
  sa("CRUDEOIL",    "WTI",     "WTI Crude Oil (CL=F)",   "energy", 78.20, -0.31, -1.20, 95_000_000_000, 48, "neutral", "bearish", 45, 1),
  sa("BRENT",       "BRENT",   "Brent Crude Oil (BZ=F)", "energy", 82.40, -0.28, -1.05, 82_000_000_000, 49, "neutral", "bearish", 47, 2),
  sa("NATGAS",      "NATGAS",  "Natural Gas (NG=F)",     "energy", 2.82, -1.05, -3.80, 18_000_000_000,  38, "bearish", "bearish", 34, 3),
  sa("HEATINGOIL",  "HO",      "Heating Oil (HO=F)",     "energy", 2.48, -0.22, -0.85, 5_200_000_000,   47, "neutral", "bearish", 44, 4),
  sa("GASOIL",      "GASOIL",  "Gas Oil (ICE)",          "energy", 712.50, -0.35, -1.25, 8_400_000_000,  48, "neutral", "bearish", 45, 5),
  sa("URANIUM",     "UX1!",    "Uranium Futures",        "energy", 88.20, 0.62, 2.20, 420_000_000,      58, "bullish", "bullish", 62, 6),
  sa("ETHANOL",     "ETHANOL", "Corn Ethanol Futures",   "energy", 1.82, -0.18, -0.65, 180_000_000,     46, "neutral", "bearish", 44, 7),

  // ── Livestock ─────────────────────────────────────────────────────────────
  sa("LIVECATTLE",   "LC",    "Live Cattle (LE=F)",      "livestock", 182.40, 0.42, 1.52, 1_200_000_000, 56, "bullish", "bullish", 60, 1),
  sa("LEANHOGS",     "LH",    "Lean Hogs (HE=F)",        "livestock", 92.80,  0.28, 1.02, 820_000_000,   53, "neutral", "bullish", 55, 2),
  sa("FEEDERCATTLE", "FC",    "Feeder Cattle (GF=F)",    "livestock", 248.60, 0.38, 1.38, 580_000_000,   55, "bullish", "bullish", 58, 3),
  sa("PORK",         "PORK",  "Pork Belly Futures",      "livestock", 88.20,  0.15, 0.52, 280_000_000,   51, "neutral", "neutral", 52, 4),

  // ── Soft Commodities ─────────────────────────────────────────────────────
  sa("COCOA",   "COCOA",  "Cocoa Futures (CC=F)",    "soft-comm", 8_420, 2.82, 9.50, 2_800_000_000, 72, "bullish", "bullish", 78, 1),
  sa("OJ",      "OJ",     "Orange Juice (OJ=F)",     "soft-comm", 428.40, 1.52, 5.20, 580_000_000,   68, "bullish", "bullish", 72, 2),
  sa("LUMBER",  "LBR",    "Lumber Futures (LB=F)",   "soft-comm", 528.80, -0.85, -2.90, 380_000_000, 42, "neutral", "bearish", 38, 3),
  sa("RUBBER",  "RUBBER", "Rubber Futures (Tokyo)",  "soft-comm", 228.40, 0.42, 1.48, 920_000_000,   54, "neutral", "bullish", 56, 4),
  sa("WOOL",    "WOOL",   "Wool Futures",            "soft-comm", 12.82, 0.08, 0.28, 120_000_000,    50, "neutral", "neutral", 50, 5),
  sa("SISAL",   "SISAL",  "Sisal Fiber",             "soft-comm", 1_420, 0.18, 0.62, 48_000_000,     51, "neutral", "neutral", 51, 6),

  // ── Carbon Credits ────────────────────────────────────────────────────────
  sa("EUA",       "EUA",     "EU Allowance (Carbon)",   "carbon", 64.82, -1.20, -4.20, 1_800_000_000, 42, "bearish", "bearish", 38, 1),
  sa("CA_CARBON", "CACO2",   "California Carbon",       "carbon", 28.40, -0.42, -1.52, 480_000_000,   44, "neutral", "bearish", 41, 2),
  sa("RGGI",      "RGGI",    "RGGI Carbon Allowance",   "carbon", 13.82, -0.22, -0.82, 180_000_000,   45, "neutral", "bearish", 43, 3),
  sa("NZU",       "NZU",     "New Zealand Carbon Unit", "carbon", 52.80, 0.28, 1.02, 120_000_000,     52, "neutral", "neutral", 52, 4),
  sa("VCS",       "VCS",     "Voluntary Carbon (VCU)",  "carbon", 8.40, 0.35, 1.28, 85_000_000,      53, "neutral", "bullish", 55, 5),

  // ── Freight Indices ───────────────────────────────────────────────────────
  sa("BDI",       "BDI",     "Baltic Dry Index",         "freight", 1_452, -0.82, -2.90, 0, 42, "bearish", "bearish", 38, 1),
  sa("CAPESIZE",  "BCI",     "Baltic Capesize Index",    "freight", 2_284, -1.05, -3.80, 0, 40, "bearish", "bearish", 35, 2),
  sa("PANAMAX",   "BPI",     "Baltic Panamax Index",     "freight", 1_682, -0.62, -2.20, 0, 43, "bearish", "bearish", 40, 3),
  sa("SUPRAMAX",  "BSI",     "Baltic Supramax Index",    "freight", 1_128, -0.38, -1.35, 0, 44, "neutral", "bearish", 42, 4),
  sa("VLCC",      "VLCC",    "VLCC Tanker Rate ($/day)", "freight", 42_800, 0.82, 2.92, 0, 55, "bullish", "bullish", 58, 5),
  sa("HANDY",     "BHI",     "Baltic Handysize Index",   "freight", 682, -0.28, -1.02, 0, 45, "neutral", "bearish", 43, 6),
];

// Symbol set for fast lookup
const STATIC_SYMBOLS = new Set(STATIC_ASSETS.map(r => r.symbol));

// ── Seeded Sparkline ──────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function genSparkline(symbol: string, change24h: number, n = 14): number[] {
  const rng = mulberry32(strSeed(symbol + Math.floor(Date.now() / 3_600_000)));
  const pts: number[] = [50];
  for (let i = 1; i < n; i++) {
    pts.push(Math.max(2, Math.min(98, pts[i - 1] + (change24h / n) * 0.35 + (rng() - 0.48) * 9)));
  }
  return pts;
}
function Sparkline({ symbol, change24h, w = 70, h = 30 }: { symbol: string; change24h: number; w?: number; h?: number }) {
  const pts = useMemo(() => genSparkline(symbol, change24h), [symbol, change24h]);
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * w);
  const ys = pts.map(p => h - ((p - min) / range) * (h - 5) - 2);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const color = change24h >= 0 ? "#4ade80" : "#f87171";
  const uid = `sg-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${uid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── AI Intelligence ───────────────────────────────────────────────────────────
function computeAiScore(r: ScreenerRow): number {
  let s = 50;
  if (r.trend === "bullish") s += 15; else s -= 10;
  if (r.macd === "bullish") s += 15; else if (r.macd === "bearish") s -= 10;
  if (r.rsi >= 48 && r.rsi < 68) s += 10;
  else if (r.rsi >= 68) s -= 8;
  else if (r.rsi <= 32) s += 5;
  else s -= 5;
  if (r.bbPosition >= 35 && r.bbPosition <= 72) s += 8;
  else if (r.bbPosition > 80) s -= 5;
  return Math.max(5, Math.min(98, Math.round(s)));
}
function scoreColor(s: number) { return s >= 72 ? "#4ade80" : s >= 52 ? "#fbbf24" : "#f87171"; }
function bestTf(r: ScreenerRow) {
  if (r.rsi > 68 || r.rsi < 32) return "1H";
  if (r.trend === "bullish" && r.macd === "bullish") return "4H";
  return "1D";
}
function dnaMatch(r: ScreenerRow): { label: string; color: string } {
  const n = (r.trend === "bullish" ? 1 : 0) + (r.macd === "bullish" ? 1 : 0);
  if (n === 2) return { label: "High Match", color: "#4ade80" };
  if (n === 1) return { label: "Med Match",  color: "#fbbf24" };
  return { label: "Low Match", color: "#f87171" };
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtP(v: number) {
  if (v < 0.00001) return v.toFixed(8);
  if (v < 0.01) return v.toFixed(6);
  if (v < 1) return v.toFixed(4);
  if (v < 100) return v.toFixed(2);
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtV(v: number) {
  if (!v || v === 0) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

// ── Persistence ───────────────────────────────────────────────────────────────
const LS = { FAV: "ms_favs", REC: "ms_recents", LAST: "market_sel_last_symbol" };
const loadFavs = (): string[] => { try { return JSON.parse(localStorage.getItem(LS.FAV) || "[]"); } catch { return []; } };
const loadRecents = (): string[] => { try { return JSON.parse(localStorage.getItem(LS.REC) || "[]"); } catch { return []; } };
function pushRecent(sym: string) {
  const r = [sym, ...loadRecents().filter(s => s !== sym)].slice(0, 10);
  localStorage.setItem(LS.REC, JSON.stringify(r));
}

// ── Asset Card ────────────────────────────────────────────────────────────────
interface CardProps { row: ScreenerRow; isFav: boolean; onFav: (s: string) => void; onSelect: (r: ScreenerRow) => void; catColor: string; }
function AssetCard({ row, isFav, onFav, onSelect, catColor }: CardProps) {
  const score = computeAiScore(row);
  const sc = scoreColor(score);
  const tf = bestTf(row);
  const dna = dnaMatch(row);
  const pos = row.change24h >= 0;
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onSelect(row)}
      style={{
        background: hov ? "var(--card-bg-hover, var(--card-bg))" : "var(--card-bg)",
        border: `1px solid ${hov ? catColor + "44" : "var(--glass-border)"}`,
        borderRadius: "18px",
        padding: "15px 16px 13px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease, border-color 0.18s ease",
        transform: hov ? "translateY(-3px)" : "none",
        boxShadow: hov ? `0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px ${catColor}22` : "var(--shadow-card)",
        minWidth: 0,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${catColor}99 0%, ${catColor}00 100%)`, borderRadius: "18px 18px 0 0" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", fontFamily: "var(--app-font-display)", lineHeight: 1 }}>
              {row.ticker}
            </span>
            {row.dataSource === "live" && (
              <span style={{ fontSize: "7.5px", fontWeight: 700, padding: "2px 5px", borderRadius: "999px", background: "rgba(74,222,128,0.13)", color: "#4ade80", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 5px rgba(74,222,128,0.8)", display: "inline-block" }} />
                LIVE
              </span>
            )}
          </div>
          <span style={{ fontSize: "10.5px", color: "var(--muted-foreground)", letterSpacing: "0.01em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onFav(row.symbol); }}
          style={{ width: "32px", height: "32px", borderRadius: "10px", border: `1px solid ${isFav ? "#fbbf2444" : "var(--glass-border)"}`, background: isFav ? "rgba(251,191,36,0.1)" : "transparent", color: isFav ? "#fbbf24" : "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s ease" }}
        >
          <Star style={{ width: "13px", height: "13px", fill: isFav ? "#fbbf24" : "none", strokeWidth: 1.8 }} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-0.045em", color: "var(--foreground)", fontFamily: "var(--app-font-mono, 'JetBrains Mono', monospace)", lineHeight: 1, marginBottom: "3px" }}>
            {fmtP(row.price)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            {pos ? <ArrowUpRight style={{ width: "11px", height: "11px", color: "#4ade80", flexShrink: 0 }} />
                 : <ArrowDownRight style={{ width: "11px", height: "11px", color: "#f87171", flexShrink: 0 }} />}
            <span style={{ fontSize: "12px", fontWeight: 650, color: pos ? "#4ade80" : "#f87171", letterSpacing: "-0.01em" }}>
              {pos ? "+" : ""}{row.change24h.toFixed(2)}%
            </span>
            <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", letterSpacing: "0.02em" }}>24H</span>
          </div>
        </div>
        <Sparkline symbol={row.symbol} change24h={row.change24h} w={68} h={30} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "9px" }}>
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
          Vol <strong style={{ color: "var(--foreground)", fontWeight: 600 }}>{fmtV(row.volume24h)}</strong>
        </span>
        <span style={{ width: "2px", height: "2px", borderRadius: "50%", background: "var(--muted-foreground)", opacity: 0.35, flexShrink: 0 }} />
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
          RSI <strong style={{ color: row.rsi > 70 ? "#f87171" : row.rsi < 30 ? "#4ade80" : "var(--foreground)", fontWeight: 600 }}>{row.rsi.toFixed(0)}</strong>
        </span>
        <span style={{ width: "2px", height: "2px", borderRadius: "50%", background: "var(--muted-foreground)", opacity: 0.35, flexShrink: 0 }} />
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
          7D <strong style={{ color: row.change7d >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>{row.change7d >= 0 ? "+" : ""}{row.change7d.toFixed(1)}%</strong>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "8px", background: `${sc}18`, color: sc, display: "flex", alignItems: "center", gap: "3px", letterSpacing: "0.02em", flexShrink: 0 }}>
          <Sparkles style={{ width: "8px", height: "8px" }} />{score}
        </span>
        <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "8px", background: `${dna.color}14`, color: dna.color, flexShrink: 0 }}>
          {dna.label}
        </span>
        <span style={{ fontSize: "9.5px", fontWeight: 600, padding: "3px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)", marginLeft: "auto", letterSpacing: "0.03em", flexShrink: 0 }}>
          {tf}
        </span>
        <ChevronRight style={{ width: "12px", height: "12px", color: catColor, opacity: hov ? 1 : 0.4, transition: "opacity 0.15s", flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── Mini Chip (Recents / Favorites) ───────────────────────────────────────────
function AssetChip({ row, onSelect, onRemove, color }: { row: ScreenerRow; onSelect: (r: ScreenerRow) => void; onRemove?: (s: string) => void; color: string }) {
  const pos = row.change24h >= 0;
  return (
    <div
      onClick={() => onSelect(row)}
      style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 11px", borderRadius: "12px", background: "var(--card-bg)", border: "1px solid var(--glass-border)", cursor: "pointer", flexShrink: 0, transition: "border-color 0.15s", minWidth: "110px" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = color + "55"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border)"}
    >
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)", fontFamily: "var(--app-font-display)", lineHeight: 1, marginBottom: "1px" }}>{row.ticker}</div>
        <div style={{ fontSize: "10px", fontWeight: 600, color: pos ? "#4ade80" : "#f87171" }}>{pos ? "+" : ""}{row.change24h.toFixed(1)}%</div>
      </div>
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(row.symbol); }}
          style={{ width: "18px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <X style={{ width: "9px", height: "9px" }} />
        </button>
      )}
    </div>
  );
}

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortKey = "mcapRank" | "volume24h" | "change24h" | "aiScore";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "mcapRank", label: "Rank" },
  { key: "volume24h", label: "Volume" },
  { key: "change24h", label: "Change" },
  { key: "aiScore", label: "AI Score" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketSelectionPage() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState<AssetCategory>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mcapRank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const [recents, setRecents] = useState<string[]>(loadRecents);

  const { data: screenerData, isLoading, refetch, isFetching } = useQuery<ScreenerRow[]>({
    queryKey: ["ms-screener"],
    queryFn: () => fetch(`${API_BASE}/api/tools/screener`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  function toggleFav(sym: string) {
    setFavs(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [sym, ...prev];
      localStorage.setItem(LS.FAV, JSON.stringify(next));
      return next;
    });
  }
  function removeRecent(sym: string) {
    setRecents(prev => {
      const next = prev.filter(s => s !== sym);
      localStorage.setItem(LS.REC, JSON.stringify(next));
      return next;
    });
  }
  function handleSelect(row: ScreenerRow) {
    pushRecent(row.symbol);
    setRecents(loadRecents());
    localStorage.setItem(LS.LAST, row.symbol);
    navigate(`/chart?symbol=${toChartSymbol(row.symbol)}`);
  }

  // Merged screener + static, de-duplicated (screener takes priority)
  const allRows = useMemo<ScreenerRow[]>(() => {
    const base = screenerData ?? [];
    const screenerSyms = new Set(base.map(r => r.symbol));
    const supplemental = STATIC_ASSETS.filter(r => !screenerSyms.has(r.symbol));
    return [...base, ...supplemental];
  }, [screenerData]);

  // Category counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of allRows) {
      const cat = getRowCategory(r);
      c[cat] = (c[cat] ?? 0) + 1;
    }
    c.all = allRows.length;
    return c;
  }, [allRows]);

  // Row lookup (for recents/favorites)
  const rowMap = useMemo<Map<string, ScreenerRow>>(() => {
    const m = new Map<string, ScreenerRow>();
    for (const r of allRows) m.set(r.symbol, r);
    return m;
  }, [allRows]);

  // Filtered + sorted grid rows
  const gridRows = useMemo<ScreenerRow[]>(() => {
    let rows = category === "all"
      ? allRows
      : allRows.filter(r => getRowCategory(r) === category);

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.ticker.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        (r.sector ?? "").toLowerCase().includes(q)
      );
    }

    return [...rows].sort((a, b) => {
      const av = sortKey === "aiScore" ? computeAiScore(a) : (a[sortKey] as number);
      const bv = sortKey === "aiScore" ? computeAiScore(b) : (b[sortKey] as number);
      return (av - bv) * (sortDir === "asc" ? 1 : -1);
    });
  }, [allRows, category, search, sortKey, sortDir]);

  const favRows = useMemo(() => favs.map(s => rowMap.get(s)).filter(Boolean) as ScreenerRow[], [favs, rowMap]);
  const recentRows = useMemo(() => recents.map(s => rowMap.get(s)).filter(Boolean) as ScreenerRow[], [recents, rowMap]);

  const activeCatColor = catColor(category);
  const sub = "var(--muted-foreground)";
  const text = "var(--foreground)";
  const skeletons = Array.from({ length: 8 });

  return (
    <div style={{ minHeight: "calc(100vh - 120px)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.04em", color: text, fontFamily: "var(--app-font-display)", lineHeight: 1, marginBottom: "4px" }}>Markets</h1>
          <p style={{ fontSize: "12px", color: sub, letterSpacing: "0.01em" }}>
            {gridRows.length} assets · {isFetching ? "Updating…" : `${allRows.length} total`}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 13px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--card-bg)", color: sub, cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
          <RefreshCw style={{ width: "12px", height: "12px", animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: sub, pointerEvents: "none" }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search all markets — BTC, AAPL, VIX, Corn, DAX…"
          style={{ width: "100%", boxSizing: "border-box", height: "44px", paddingLeft: "40px", paddingRight: search ? "40px" : "16px", borderRadius: "14px", border: "1px solid var(--glass-border)", background: "var(--card-bg)", color: text, fontSize: "14px", fontFamily: "var(--app-font-display)", outline: "none" }}
        />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: "10px", height: "10px" }} />
          </button>
        )}
      </div>

      {/* ── Category Pills (grouped) ────────────────────────────────────── */}
      <div style={{ overflowX: "auto", marginBottom: "20px", scrollbarWidth: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", paddingBottom: "2px", minWidth: "max-content" }}>
          {CATEGORY_GROUPS.map((grp, gi) => (
            <React.Fragment key={grp.group}>
              {gi > 0 && (
                <div style={{ width: "1px", height: "20px", background: "var(--glass-border)", flexShrink: 0, margin: "0 3px" }} />
              )}
              {grp.label && (
                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", color: sub, textTransform: "uppercase", opacity: 0.5, paddingRight: "1px" }}>
                  {grp.label}
                </span>
              )}
              {grp.items.map(cat => {
                const active = category === cat.id;
                const count = counts[cat.id] ?? 0;
                return (
                  <button key={cat.id} onClick={() => setCategory(cat.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "6px 12px", borderRadius: "11px",
                      border: `1px solid ${active ? cat.color + "55" : "var(--glass-border)"}`,
                      background: active ? `${cat.color}14` : "var(--card-bg)",
                      color: active ? cat.color : sub,
                      cursor: "pointer", fontSize: "12px", fontWeight: active ? 600 : 500,
                      fontFamily: "var(--app-font-display)", transition: "all 0.15s ease",
                      flexShrink: 0, boxShadow: active ? `0 0 0 1px ${cat.color}22` : "none",
                      letterSpacing: "-0.01em",
                    }}>
                    {cat.label}
                    {count > 0 && (
                      <span style={{ fontSize: "9.5px", padding: "1px 5px", borderRadius: "6px", background: active ? `${cat.color}22` : "rgba(255,255,255,0.06)", color: active ? cat.color : sub, fontWeight: 600 }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Recents ────────────────────────────────────────────────────── */}
      {recentRows.length > 0 && !search && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <Clock style={{ width: "12px", height: "12px", color: sub }} />
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: sub, textTransform: "uppercase" }}>Recent</span>
          </div>
          <div style={{ display: "flex", gap: "7px", overflowX: "auto", paddingBottom: "2px", scrollbarWidth: "none" }}>
            {recentRows.map(row => (
              <AssetChip key={row.symbol} row={row} onSelect={handleSelect} onRemove={removeRecent}
                color={catColor(getRowCategory(row))} />
            ))}
          </div>
        </div>
      )}

      {/* ── Favorites ──────────────────────────────────────────────────── */}
      {favRows.length > 0 && !search && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <Star style={{ width: "12px", height: "12px", color: "#fbbf24", fill: "#fbbf24" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: sub, textTransform: "uppercase" }}>Favorites</span>
          </div>
          <div style={{ display: "flex", gap: "7px", overflowX: "auto", paddingBottom: "2px", scrollbarWidth: "none" }}>
            {favRows.map(row => (
              <AssetChip key={row.symbol} row={row} onSelect={handleSelect} color="#fbbf24" />
            ))}
          </div>
        </div>
      )}

      {/* ── Sort bar ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: sub, letterSpacing: "0.04em", marginRight: "2px" }}>Sort:</span>
        {SORTS.map(s => {
          const active = sortKey === s.key;
          return (
            <button key={s.key}
              onClick={() => { if (active) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(s.key); setSortDir(s.key === "volume24h" || s.key === "aiScore" ? "desc" : "asc"); } }}
              style={{ display: "flex", alignItems: "center", gap: "3px", padding: "5px 11px", borderRadius: "9px", border: `1px solid ${active ? "var(--nav-active-border)" : "var(--glass-border)"}`, background: active ? "var(--nav-active-bg)" : "transparent", color: active ? text : sub, cursor: "pointer", fontSize: "11.5px", fontWeight: active ? 600 : 500, transition: "all 0.14s ease" }}>
              {s.label}
              {active && <span style={{ fontSize: "9px", opacity: 0.7 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Asset Grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {skeletons.map((_, i) => (
            <div key={i} style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", borderRadius: "18px", height: "170px", animation: "pulse 1.8s ease-in-out infinite", opacity: 0.6 }} />
          ))}
        </div>
      ) : gridRows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <BarChart2 style={{ width: "36px", height: "36px", color: sub, margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ color: sub, fontSize: "14px" }}>No assets found</p>
          {search && <button onClick={() => setSearch("")} style={{ marginTop: "10px", fontSize: "13px", color: activeCatColor, background: "none", border: "none", cursor: "pointer" }}>Clear search</button>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))", gap: "12px" }}>
          {gridRows.map(row => (
            <AssetCard
              key={row.symbol}
              row={row}
              isFav={favs.includes(row.symbol)}
              onFav={toggleFav}
              onSelect={handleSelect}
              catColor={catColor(getRowCategory(row))}
            />
          ))}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <p style={{ fontSize: "10.5px", color: sub, marginTop: "24px", letterSpacing: "0.02em", opacity: 0.55 }}>
        {allRows.length} assets across {ALL_CATS.length - 1} markets · Crypto via Binance · Equities & FX via Yahoo Finance · Futures, Bonds & Exotic markets are simulated · AI scores computed locally
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
