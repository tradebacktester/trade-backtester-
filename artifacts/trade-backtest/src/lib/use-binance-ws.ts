import { useEffect, useRef, useState, useCallback } from "react";

export type BinanceTicker = {
  price: number;
  change24h: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
};

function isBinanceSymbol(s: string) {
  return /^[A-Z0-9]+(USDT|BTC|ETH|BNB)$/i.test(s);
}

/**
 * Subscribe to live price updates for multiple symbols via Binance combined stream.
 * Only subscribes to Binance-listed USDT/BTC/ETH pairs; non-Binance symbols are ignored.
 */
export function useBinancePrices(symbols: string[]): Record<string, BinanceTicker> {
  const [prices, setPrices] = useState<Record<string, BinanceTicker>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const binanceSymbols = symbols.filter(isBinanceSymbol);
  const streamsKey = binanceSymbols.join(",");

  const connect = useCallback(() => {
    if (!mountedRef.current || binanceSymbols.length === 0) return;
    const streams = binanceSymbols.map(s => `${s.toLowerCase()}@miniTicker`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { data?: { s?: string; c?: string; o?: string; h?: string; l?: string; v?: string } };
        const d = msg.data;
        if (!d?.s) return;
        const price = parseFloat(d.c ?? "0");
        const open = parseFloat(d.o ?? "0");
        setPrices(prev => ({
          ...prev,
          [d.s!]: {
            price,
            change24h: price - open,
            changePct24h: open > 0 ? ((price - open) / open) * 100 : 0,
            high24h: parseFloat(d.h ?? "0"),
            low24h: parseFloat(d.l ?? "0"),
            volume24h: parseFloat(d.v ?? "0"),
          },
        }));
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      if (mountedRef.current) timerRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamsKey]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return prices;
}

/**
 * Subscribe to live price for a single chart symbol.
 * Uses real Binance WebSocket for USDT pairs; falls back to simulated random-walk for
 * non-Binance symbols (forex, indices, stocks, futures).
 */
export function useBinanceLivePrice(symbol: string, isSim: boolean, fallback: number): number {
  const [price, setPrice] = useState(fallback);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { setPrice(fallback); }, [symbol, fallback]);

  useEffect(() => {
    mountedRef.current = true;

    if (isSim || !isBinanceSymbol(symbol)) {
      const id = setInterval(() => {
        setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p));
      }, 300);
      return () => { mountedRef.current = false; clearInterval(id); };
    }

    function connect() {
      if (!mountedRef.current) return;
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@miniTicker`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data as string) as { c?: string };
          if (d.c) setPrice(parseFloat(d.c));
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
  }, [symbol, isSim]);

  return price;
}
