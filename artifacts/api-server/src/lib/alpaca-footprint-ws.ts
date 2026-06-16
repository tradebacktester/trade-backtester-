/**
 * Alpaca IEX WebSocket aggregator for stock/ETF footprint charts.
 *
 * Mirrors the pattern in binance-footprint-ws.ts but connects to
 * wss://stream.data.alpaca.markets/v2/iex using Alpaca paper trading credentials
 * (free tier, covers IEX exchange — real-time US equity trades).
 *
 * Buy/sell direction is inferred via the tick rule:
 *   uptick  → buyer aggressor (ask volume)
 *   downtick → seller aggressor (bid volume)
 */

import WebSocket from "ws";
import { ALPACA_WS_URL } from "./alpaca";

// ── Types (matches binance-footprint-ws LiveCandleState exactly) ───

export interface AlpacaLiveCandleState {
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta: number;
  levelMap: Map<string, { bidVol: number; askVol: number }>;
  openTime: number;
  closeTime: number;
}

// ── Constants ──────────────────────────────────────────────────────

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

const TICK_SIZE_DIVISOR = 200;

function getPriceKey(price: number, tickSize: number): string {
  return (Math.floor(price / tickSize) * tickSize).toFixed(4);
}

// ── Aggregator singleton ───────────────────────────────────────────

class AlpacaFootprintAggregator {
  private ws: WebSocket | null = null;
  private candleMap = new Map<string, AlpacaLiveCandleState>();
  private subscribedSymbols = new Set<string>();
  private activeTimeframes = new Map<string, string>(); // symbol → latest timeframe
  private lastPrice = new Map<string, number>();        // for tick rule
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;

  // ── WebSocket lifecycle ──────────────────────────────────────────

  private connectWs(): void {
    if (!process.env["ALPACA_KEY_ID"] || !process.env["ALPACA_SECRET_KEY"]) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const ws = new WebSocket(ALPACA_WS_URL);
    this.ws = ws;
    this.authenticated = false;

    ws.on("open", () => {
      ws.send(JSON.stringify({
        action: "auth",
        key:    process.env["ALPACA_KEY_ID"] ?? "",
        secret: process.env["ALPACA_SECRET_KEY"] ?? "",
      }));
    });

    ws.on("message", (raw: Buffer) => {
      try {
        const msgs = JSON.parse(raw.toString()) as Array<Record<string, unknown>>;
        for (const msg of msgs) {
          // Alpaca sends array responses
          if (msg["T"] === "success" && msg["msg"] === "authenticated") {
            this.authenticated = true;
            this.resubscribeAll();
          } else if (msg["T"] === "t") {
            // Trade message
            this.processTrade(
              msg["S"] as string,
              Number(msg["p"]),
              Number(msg["s"]),
              String(msg["t"]),
            );
          }
        }
      } catch { /* ignore malformed */ }
    });

    ws.on("close", () => {
      this.authenticated = false;
      this.ws = null;
      // Reconnect with back-off
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connectWs(), 5_000);
    });

    ws.on("error", () => {
      ws.terminate();
    });
  }

  private resubscribeAll(): void {
    if (!this.authenticated || !this.ws || this.subscribedSymbols.size === 0) return;
    this.ws.send(JSON.stringify({
      action: "subscribe",
      trades: Array.from(this.subscribedSymbols),
    }));
  }

  // ── Trade processing ─────────────────────────────────────────────

  private processTrade(symbol: string, price: number, size: number, isoTime: string): void {
    if (!price || !size) return;
    const tf = this.activeTimeframes.get(symbol);
    if (!tf) return;

    const tradeMs  = new Date(isoTime).getTime() || Date.now();
    const tfMs     = TIMEFRAME_MS[tf] ?? 3_600_000;
    const openTime = Math.floor(tradeMs / tfMs) * tfMs;
    const closeTime = openTime + tfMs - 1;
    const key      = `${symbol}:${tf}`;

    let candle = this.candleMap.get(key);
    if (!candle || openTime > candle.openTime) {
      candle = {
        symbol, timeframe: tf,
        open: price, high: price, low: price, close: price,
        volume: 0, delta: 0,
        levelMap: new Map(),
        openTime, closeTime,
      };
      this.candleMap.set(key, candle);
    }

    candle.high  = Math.max(candle.high, price);
    candle.low   = Math.min(candle.low,  price);
    candle.close = price;
    candle.volume += size;

    // Tick rule: uptick = buy aggressor (ask vol), downtick = sell (bid vol)
    const lastP = this.lastPrice.get(symbol) ?? price;
    const isBuy = price >= lastP;
    this.lastPrice.set(symbol, price);

    if (isBuy)  candle.delta += size;
    else        candle.delta -= size;

    // Cluster into price-level buckets
    const tickSize = Math.max(price / TICK_SIZE_DIVISOR, 0.01);
    const priceKey = getPriceKey(price, tickSize);
    const level = candle.levelMap.get(priceKey) ?? { bidVol: 0, askVol: 0 };
    if (isBuy) level.askVol += size;
    else       level.bidVol += size;
    candle.levelMap.set(priceKey, level);
  }

  // ── Public API ───────────────────────────────────────────────────

  subscribe(symbol: string, timeframe: string): void {
    this.activeTimeframes.set(symbol, timeframe);

    if (!this.subscribedSymbols.has(symbol)) {
      this.subscribedSymbols.add(symbol);

      if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
        this.connectWs();
      } else if (this.authenticated && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: "subscribe", trades: [symbol] }));
      }
    }
  }

  getLiveCandle(symbol: string, timeframe: string): AlpacaLiveCandleState | null {
    return this.candleMap.get(`${symbol}:${timeframe}`) ?? null;
  }
}

// ── Module-level singleton ─────────────────────────────────────────

const aggregator = new AlpacaFootprintAggregator();

export function ensureAlpacaFootprintSubscribed(symbol: string, timeframe: string): void {
  if (!process.env["ALPACA_KEY_ID"] || !process.env["ALPACA_SECRET_KEY"]) return;
  aggregator.subscribe(symbol.toUpperCase(), timeframe);
}

export function getAlpacaLiveCandle(
  symbol: string,
  timeframe: string,
): AlpacaLiveCandleState | null {
  return aggregator.getLiveCandle(symbol.toUpperCase(), timeframe);
}
