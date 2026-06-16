/**
 * Alpaca Markets API client helpers
 *
 * Paper trading base : https://paper-api.alpaca.markets/v2
 * Market data base   : https://data.alpaca.markets/v2
 *
 * Free paper trading account at alpaca.markets
 * Provides real-time IEX data (quotes, trades) on the free plan
 */

const ALPACA_KEY    = () => process.env["ALPACA_KEY_ID"]     ?? "";
const ALPACA_SECRET = () => process.env["ALPACA_SECRET_KEY"] ?? "";

export const ALPACA_CONFIGURED = () =>
  !!(process.env["ALPACA_KEY_ID"] && process.env["ALPACA_SECRET_KEY"]);

const PAPER_BASE = "https://paper-api.alpaca.markets/v2";
const DATA_BASE  = "https://data.alpaca.markets/v2";

function alpacaHeaders(): Record<string, string> {
  return {
    "APCA-API-KEY-ID":     ALPACA_KEY(),
    "APCA-API-SECRET-KEY": ALPACA_SECRET(),
    "Content-Type":        "application/json",
  };
}

// ── Paper trading endpoints ────────────────────────────────────────

export async function alpacaGetAccount(): Promise<Record<string, unknown>> {
  const r = await fetch(`${PAPER_BASE}/account`, {
    headers: alpacaHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Alpaca account error: ${r.status}`);
  return r.json() as Promise<Record<string, unknown>>;
}

export async function alpacaGetPositions(): Promise<Array<Record<string, unknown>>> {
  const r = await fetch(`${PAPER_BASE}/positions`, {
    headers: alpacaHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Alpaca positions error: ${r.status}`);
  return r.json() as Promise<Array<Record<string, unknown>>>;
}

export async function alpacaGetOrders(
  status: "open" | "closed" | "all" = "all",
  limit = 50,
): Promise<Array<Record<string, unknown>>> {
  const r = await fetch(
    `${PAPER_BASE}/orders?status=${status}&limit=${limit}&direction=desc`,
    { headers: alpacaHeaders(), signal: AbortSignal.timeout(8000) },
  );
  if (!r.ok) throw new Error(`Alpaca orders error: ${r.status}`);
  return r.json() as Promise<Array<Record<string, unknown>>>;
}

export interface AlpacaOrderRequest {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  time_in_force: "day" | "gtc" | "ioc" | "fok";
  limit_price?: number;
  stop_price?: number;
}

export async function alpacaPlaceOrder(
  body: AlpacaOrderRequest,
): Promise<Record<string, unknown>> {
  const r = await fetch(`${PAPER_BASE}/orders`, {
    method: "POST",
    headers: alpacaHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Alpaca order error: ${r.status} ${err}`);
  }
  return r.json() as Promise<Record<string, unknown>>;
}

export async function alpacaCancelOrder(
  orderId: string,
): Promise<{ cancelled: boolean; orderId: string }> {
  const r = await fetch(`${PAPER_BASE}/orders/${orderId}`, {
    method: "DELETE",
    headers: alpacaHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok && r.status !== 204)
    throw new Error(`Alpaca cancel error: ${r.status}`);
  return { cancelled: true, orderId };
}

// ── Market data endpoints ──────────────────────────────────────────

export interface AlpacaQuote {
  bp: number;  // bid price
  bs: number;  // bid size  (lots)
  ap: number;  // ask price
  as: number;  // ask size  (lots)
  t:  string;  // timestamp ISO
  ax: string;  // ask exchange
  bx: string;  // bid exchange
}

/**
 * Latest NBBO quote from IEX feed (free tier).
 * Returns null if Alpaca is not configured or the call fails.
 */
export async function alpacaGetLatestQuote(
  symbol: string,
): Promise<AlpacaQuote | null> {
  if (!ALPACA_CONFIGURED()) return null;
  try {
    const r = await fetch(
      `${DATA_BASE}/stocks/${encodeURIComponent(symbol)}/quotes/latest?feed=iex`,
      { headers: alpacaHeaders(), signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return null;
    const d = await r.json() as { quote?: AlpacaQuote };
    return d.quote ?? null;
  } catch { return null; }
}

export interface AlpacaTrade {
  p: number;   // price
  s: number;   // size (shares)
  t: string;   // timestamp ISO
  x: string;   // exchange
  c?: string[]; // conditions
}

/**
 * Recent trades from the IEX feed (free tier, real-time).
 */
export async function alpacaGetRecentTrades(
  symbol: string,
  limit = 1000,
): Promise<AlpacaTrade[]> {
  if (!ALPACA_CONFIGURED()) return [];
  try {
    const r = await fetch(
      `${DATA_BASE}/stocks/${encodeURIComponent(symbol)}/trades?limit=${limit}&feed=iex`,
      { headers: alpacaHeaders(), signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return [];
    const d = await r.json() as { trades?: AlpacaTrade[] };
    return d.trades ?? [];
  } catch { return []; }
}

/** Alpaca IEX WebSocket stream URL (free tier) */
export const ALPACA_WS_URL = "wss://stream.data.alpaca.markets/v2/iex";
