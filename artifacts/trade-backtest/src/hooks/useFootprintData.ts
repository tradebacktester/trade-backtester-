import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

export interface PriceLevel {
  price: number;
  bidVol: number;
  askVol: number;
  delta: number;
  totalVol: number;
  isImbalance: boolean;
  isBuyAbsorption: boolean;
  isSellAbsorption: boolean;
}

export interface FootprintCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta: number;
  cvd: number;
  levels: PriceLevel[];
  isExhaustion: boolean;
  isDivergence: boolean;
  sessionTag: string | null;
}

const POLL_INTERVALS: Record<string, number> = {
  "1m":  15_000,
  "5m":  30_000,
  "15m": 30_000,
  "1h":  60_000,
  "4h":  120_000,
  "1d":  300_000,
};

export interface FootprintDataState {
  candles: FootprintCandle[];
  loading: boolean;
  error: string | null;
  /** null = not checked yet, "pro" | "elite" = upgrade required */
  requiresPlan: "pro" | "elite" | null;
  isLive: boolean;
  planSlug: string;
  hasLiveData: boolean;
  refresh: () => void;
}

export function useFootprintData(
  symbol: string,
  timeframe: string,
  session: string = "all",
  limit: number = 50,
): FootprintDataState {
  const { token } = useAuth();
  const [candles, setCandles] = useState<FootprintCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPlan, setRequiresPlan] = useState<"pro" | "elite" | null>(null);
  const [planSlug, setPlanSlug] = useState<string>("free");
  const [isLive, setIsLive] = useState(false);
  const [hasLiveData, setHasLiveData] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchCandles = useCallback(async (isBackground = false) => {
    if (!token) { setLoading(false); return; }
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ symbol, timeframe, limit: String(limit), session });
      const res = await fetch(`${API_BASE}/api/footprint/candles?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as {
        candles?: FootprintCandle[];
        planSlug?: string;
        hasLiveData?: boolean;
        error?: string;
        requiresPlan?: "pro" | "elite";
        limitReached?: boolean;
      };
      if (!mountedRef.current) return;

      if (res.status === 403) {
        setRequiresPlan(data.requiresPlan ?? "pro");
        setError(data.error ?? "Upgrade required");
        setIsLive(false);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load footprint data");
      }

      setRequiresPlan(null);
      setCandles(data.candles ?? []);
      setPlanSlug(data.planSlug ?? "free");
      setHasLiveData(data.hasLiveData ?? false);
      setIsLive(true);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load data");
      setIsLive(false);
    } finally {
      if (!mountedRef.current) return;
      if (!isBackground) setLoading(false);
    }
  }, [token, symbol, timeframe, limit, session]);

  useEffect(() => {
    mountedRef.current = true;
    // Reset state on symbol/timeframe change
    setCandles([]);
    setRequiresPlan(null);
    setError(null);
    setIsLive(false);
    void fetchCandles(false);

    const interval = POLL_INTERVALS[timeframe] ?? 60_000;
    timerRef.current = setInterval(() => { void fetchCandles(true); }, interval);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCandles, timeframe]);

  const refresh = useCallback(() => { void fetchCandles(false); }, [fetchCandles]);

  return { candles, loading, error, requiresPlan, isLive, planSlug, hasLiveData, refresh };
}
