import WebSocket from "ws";
import { type PriceLevel } from "./footprint-engine";
import type { FootprintCandle } from "./footprint-engine";

interface LiveTick {
  price: number;
  qty: number;
  isBuyerMaker: boolean;
  timestamp: number;
}

export interface LiveCandleState {
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

type UpdateCallback = (candle: Partial<FootprintCandle>) => void;

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
};

const TICK_SIZE_DIVISOR = 200;

function getPriceKey(price: number, tickSize: number): string {
  return (Math.floor(price / tickSize) * tickSize).toFixed(8);
}

class BinanceFootprintAggregator {
  private wsMap = new Map<string, WebSocket>();
  private candleMap = new Map<string, LiveCandleState>();
  private subscribers = new Map<string, Set<UpdateCallback>>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Track which symbol subscriptions are active (for auto-start lifecycle) */
  private activeSymbols = new Map<string, Set<string>>(); // symbol → Set<timeframe>

  /**
   * Subscribe to live footprint updates for a symbol+timeframe.
   * Automatically establishes the WebSocket if not already connected.
   * Returns an unsubscribe function.
   */
  subscribe(symbol: string, timeframe: string, cb: UpdateCallback): () => void {
    const wsSymbol = symbol.toLowerCase();
    const key = `${wsSymbol}:${timeframe}`;
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key)!.add(cb);

    // Auto-start WS for this symbol if not running
    if (!this.wsMap.has(wsSymbol)) {
      this.connectWs(symbol, timeframe);
    }

    // Track active symbols/timeframes
    if (!this.activeSymbols.has(wsSymbol)) this.activeSymbols.set(wsSymbol, new Set());
    this.activeSymbols.get(wsSymbol)!.add(timeframe);

    return () => {
      this.subscribers.get(key)?.delete(cb);
      if ((this.subscribers.get(key)?.size ?? 0) === 0) {
        this.activeSymbols.get(wsSymbol)?.delete(timeframe);
        if ((this.activeSymbols.get(wsSymbol)?.size ?? 0) === 0) {
          this.disconnectWs(symbol);
        }
      }
    };
  }

  /**
   * Ensure a symbol is actively subscribed (idempotent — safe to call multiple times).
   * Used by the candles endpoint to warm up the aggregator on first request.
   */
  ensureSubscribed(symbol: string, timeframe: string): void {
    const wsSymbol = symbol.toLowerCase();
    if (!this.wsMap.has(wsSymbol)) {
      this.connectWs(symbol, timeframe);
    }
    if (!this.activeSymbols.has(wsSymbol)) this.activeSymbols.set(wsSymbol, new Set());
    this.activeSymbols.get(wsSymbol)!.add(timeframe);
  }

  /**
   * Unsubscribe / stop streaming a symbol+timeframe entirely.
   * Exported as a named helper per the API contract.
   */
  unsubscribe(symbol: string, timeframe: string): void {
    const wsSymbol = symbol.toLowerCase();
    const key = `${wsSymbol}:${timeframe}`;
    this.subscribers.delete(key);
    this.activeSymbols.get(wsSymbol)?.delete(timeframe);
    if ((this.activeSymbols.get(wsSymbol)?.size ?? 0) === 0) {
      this.disconnectWs(symbol);
    }
  }

  getCurrentCandle(symbol: string, timeframe: string): LiveCandleState | undefined {
    return this.candleMap.get(`${symbol.toLowerCase()}:${timeframe}`);
  }

  isConnected(symbol: string): boolean {
    const ws = this.wsMap.get(symbol.toLowerCase());
    return ws?.readyState === WebSocket.OPEN;
  }

  private connectWs(symbol: string, timeframe: string) {
    const wsSymbol = symbol.toLowerCase();
    const url = `wss://stream.binance.com:9443/ws/${wsSymbol}@aggTrade`;

    try {
      const ws = new WebSocket(url);

      ws.on("open", () => {
        this.initCandle(wsSymbol, timeframe);
      });

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            p: string; q: string; m: boolean; T: number;
          };
          // Process for all active timeframes for this symbol
          const tfs = this.activeSymbols.get(wsSymbol) ?? new Set([timeframe]);
          for (const tf of tfs) {
            this.processTick(wsSymbol, tf, {
              price: parseFloat(msg.p),
              qty: parseFloat(msg.q),
              isBuyerMaker: msg.m,
              timestamp: msg.T,
            });
          }
        } catch { /* ignore malformed */ }
      });

      ws.on("error", () => { ws.terminate(); });

      ws.on("close", () => {
        this.wsMap.delete(wsSymbol);
        const tfs = this.activeSymbols.get(wsSymbol);
        if (tfs && tfs.size > 0) {
          const tf = Array.from(tfs)[0] ?? timeframe;
          const timer = setTimeout(() => {
            this.reconnectTimers.delete(`${wsSymbol}:${tf}`);
            this.connectWs(symbol, tf);
          }, 5000);
          this.reconnectTimers.set(`${wsSymbol}:${tf}`, timer);
        }
      });

      this.wsMap.set(wsSymbol, ws);
    } catch {
      // WebSocket unavailable (non-crypto, offline env) — silent failure
    }
  }

  private disconnectWs(symbol: string) {
    const wsSymbol = symbol.toLowerCase();
    const ws = this.wsMap.get(wsSymbol);
    if (ws) { ws.terminate(); this.wsMap.delete(wsSymbol); }
    for (const [key, timer] of this.reconnectTimers.entries()) {
      if (key.startsWith(wsSymbol + ":")) {
        clearTimeout(timer);
        this.reconnectTimers.delete(key);
      }
    }
  }

  private initCandle(symbol: string, timeframe: string) {
    const now = Date.now();
    const tfMs = TIMEFRAME_MS[timeframe] ?? 3_600_000;
    const openTime = Math.floor(now / tfMs) * tfMs;
    this.candleMap.set(`${symbol}:${timeframe}`, {
      symbol, timeframe,
      open: 0, high: 0, low: 0, close: 0,
      volume: 0, delta: 0,
      levelMap: new Map(),
      openTime,
      closeTime: openTime + tfMs - 1,
    });
  }

  private processTick(symbol: string, timeframe: string, tick: LiveTick) {
    const key = `${symbol}:${timeframe}`;
    let state = this.candleMap.get(key);
    const tfMs = TIMEFRAME_MS[timeframe] ?? 3_600_000;

    if (!state || tick.timestamp > state.closeTime) {
      this.initCandle(symbol, timeframe);
      state = this.candleMap.get(key)!;
    }

    if (state.open === 0) { state.open = tick.price; state.high = tick.price; state.low = tick.price; }
    state.close = tick.price;
    state.high = Math.max(state.high, tick.price);
    state.low = Math.min(state.low, tick.price);
    state.volume += tick.qty;
    state.delta += tick.isBuyerMaker ? -tick.qty : tick.qty;

    const range = Math.max(state.high - state.low, state.open * 0.001);
    const tickSize = range / TICK_SIZE_DIVISOR;
    const priceKey = getPriceKey(tick.price, tickSize || 0.01);
    const existing = state.levelMap.get(priceKey) ?? { bidVol: 0, askVol: 0 };
    if (tick.isBuyerMaker) existing.bidVol += tick.qty;
    else existing.askVol += tick.qty;
    state.levelMap.set(priceKey, existing);

    this.notifySubscribers(key, state);
    void tfMs;
  }

  private notifySubscribers(key: string, state: LiveCandleState) {
    const subs = this.subscribers.get(key);
    if (!subs || subs.size === 0) return;

    const levels: PriceLevel[] = Array.from(state.levelMap.entries())
      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
      .map(([priceStr, { bidVol, askVol }]) => {
        const price = parseFloat(priceStr);
        const delta = askVol - bidVol;
        const totalVol = bidVol + askVol;
        const ratio = askVol / Math.max(bidVol, 0.001);
        const ratioInv = bidVol / Math.max(askVol, 0.001);
        return {
          price, bidVol, askVol, delta, totalVol,
          isImbalance: ratio >= 3 || ratioInv >= 3,
          isBuyAbsorption: state.delta < 0 && askVol > bidVol * 2.5,
          isSellAbsorption: state.delta > 0 && bidVol > askVol * 2.5,
        };
      });

    const partial: Partial<FootprintCandle> = {
      date: new Date(state.openTime).toISOString(),
      open: state.open, high: state.high, low: state.low, close: state.close,
      volume: state.volume, delta: state.delta, levels,
      isExhaustion: Math.abs(state.delta) > state.volume * 0.4,
      isDivergence: false, sessionTag: null,
    };

    for (const cb of subs) { try { cb(partial); } catch { /* ignore */ } }
  }
}

export const binanceFootprintAggregator = new BinanceFootprintAggregator();

/** Subscribe to live tick aggregation and get an unsubscribe closure. */
export function subscribeFootprint(symbol: string, timeframe: string, cb: UpdateCallback): () => void {
  return binanceFootprintAggregator.subscribe(symbol, timeframe, cb);
}

/** Stop streaming a symbol+timeframe — named export per API contract. */
export function unsubscribeFootprint(symbol: string, timeframe: string): void {
  binanceFootprintAggregator.unsubscribe(symbol, timeframe);
}

/**
 * Warm up the Binance aggregator for a symbol/timeframe on first API request.
 * Idempotent — safe to call on every candles request.
 */
export function ensureFootprintSubscribed(symbol: string, timeframe: string): void {
  binanceFootprintAggregator.ensureSubscribed(symbol, timeframe);
}

/** Get the current in-progress live candle (returns undefined if WS not yet connected). */
export function getLiveCandle(symbol: string, timeframe: string): LiveCandleState | undefined {
  return binanceFootprintAggregator.getCurrentCandle(symbol.toLowerCase(), timeframe);
}

/** Returns true if the WebSocket for this symbol is currently OPEN. */
export function isFootprintConnected(symbol: string): boolean {
  return binanceFootprintAggregator.isConnected(symbol);
}
