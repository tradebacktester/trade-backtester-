import { useState, useEffect, useRef } from "react";

function isBinanceSymbol(symbol: string): boolean {
  return symbol.endsWith("USDT") || symbol.endsWith("USDC") || symbol.endsWith("BTC") || symbol.endsWith("ETH") || symbol.endsWith("BNB");
}

/**
 * Subscribe to live prices for multiple symbols (used by mini-ticker widgets).
 */
export function useBinancePrices(symbols: string[]): Map<string, number> {
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());

  useEffect(() => {
    const binanceSyms = symbols.filter(isBinanceSymbol);
    if (!binanceSyms.length) return;

    binanceSyms.forEach((symbol) => {
      if (wsRefs.current.has(symbol)) return;
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@miniTicker`);
      wsRefs.current.set(symbol, ws);
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data as string) as { c?: string };
          if (d.c) setPrices(prev => { const m = new Map(prev); m.set(symbol, parseFloat(d.c!)); return m; });
        } catch { /* ignore */ }
      };
      ws.onerror = () => ws.close();
    });

    return () => {
      wsRefs.current.forEach(ws => ws.close());
      wsRefs.current.clear();
    };
  }, [symbols.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return prices;
}

/**
 * Subscribe to live price for a single chart symbol.
 * - Binance USDT pairs: real WebSocket stream
 * - Non-Binance (stocks, forex, indices, commodities): polls /api/market/quote every 5s
 * - Sim symbols: random-walk fallback (isSim=true)
 *
 * Returns { price, stale, lastUpdated } so callers can show a staleness badge.
 */
export function useBinanceLivePrice(
  symbol: string,
  isSim: boolean,
  fallback: number,
): { price: number; stale: boolean; lastUpdated: number } {
  const [price, setPrice] = useState(fallback);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { setPrice(fallback); }, [symbol, fallback]);

  useEffect(() => {
    mountedRef.current = true;

    if (isSim) {
      const id = setInterval(() => {
        setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p));
      }, 300);
      return () => { mountedRef.current = false; clearInterval(id); };
    }

    if (isBinanceSymbol(symbol)) {
      function connect() {
        if (!mountedRef.current) return;
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@miniTicker`);
        wsRef.current = ws;
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data as string) as { c?: string };
            if (d.c) {
              setPrice(parseFloat(d.c));
              setStale(false);
              setLastUpdated(Date.now());
            }
          } catch { /* ignore */ }
        };
        ws.onclose = () => {
          if (mountedRef.current) timerRef.current = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
      }

      connect();
      return () => {
        mountedRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        wsRef.current?.close();
      };
    }

    // Non-Binance: poll /api/market/quote every 5 seconds
    let cancelled = false;

    async function fetchQuote() {
      try {
        const resp = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`);
        if (resp.ok) {
          const data = await resp.json() as { price?: number; stale?: boolean; fetchedAt?: number };
          if (!cancelled && typeof data.price === "number" && data.price > 0) {
            setPrice(data.price);
            setStale(data.stale ?? false);
            setLastUpdated(data.fetchedAt ?? Date.now());
          }
        }
      } catch { /* ignore network errors */ }
    }

    fetchQuote();
    const pollId = setInterval(fetchQuote, 5_000);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(pollId);
    };
  }, [symbol, isSim]);

  return { price, stale, lastUpdated };
}
