import { useState, useEffect, useRef } from "react";

/**
 * Real-time price hook.
 *
 * When `symbol` is provided, polls /api/tools/live-quote every 5 seconds
 * for a live price (Binance for crypto, Yahoo Finance for everything else).
 *
 * Falls back to a small random walk only when no symbol is given, so existing
 * call-sites that pass just a `base` price still work without breaking.
 */
export function useSimPrice(base: number, symbol?: string) {
  const [price, setPrice] = useState(base);
  const cancelRef = useRef(false);

  useEffect(() => {
    setPrice(base);
  }, [base]);

  useEffect(() => {
    cancelRef.current = false;

    if (!symbol) {
      const id = setInterval(
        () => setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p)),
        300,
      );
      return () => { cancelRef.current = true; clearInterval(id); };
    }

    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/tools/live-quote?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const data = await res.json() as { price?: number };
        if (!cancelRef.current && typeof data.price === "number" && data.price > 0) {
          setPrice(data.price);
        }
      } catch { /* keep current price */ }
    };

    fetchLive();
    const id = setInterval(fetchLive, 5_000);
    return () => { cancelRef.current = true; clearInterval(id); };
  }, [symbol]);

  return price;
}
