/**
 * Alpaca paper-trading brokerage endpoints
 *
 * All endpoints require a valid TradeLab Bearer token.
 * All Alpaca calls are to the FREE paper-trading environment.
 *
 * Routes:
 *   GET  /api/brokerage/status        — is Alpaca configured?
 *   GET  /api/brokerage/account       — paper account equity / cash / buying-power
 *   GET  /api/brokerage/positions     — open paper positions
 *   GET  /api/brokerage/orders        — order history (?status=open|closed|all)
 *   POST /api/brokerage/orders        — place a paper order
 *   DELETE /api/brokerage/orders/:id  — cancel a pending paper order
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { verifyJwt } from "../lib/jwt";
import {
  ALPACA_CONFIGURED,
  alpacaGetAccount,
  alpacaGetPositions,
  alpacaGetOrders,
  alpacaPlaceOrder,
  alpacaCancelOrder,
  type AlpacaOrderRequest,
} from "../lib/alpaca";

const router: IRouter = Router();
const JWT_SECRET = () => process.env["JWT_SECRET"] ?? "";

// ── Auth middleware ───────────────────────────────────────────────

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth || !JWT_SECRET()) return null;
    const token = auth.replace("Bearer ", "").trim();
    const payload = verifyJwt(token, JWT_SECRET());
    return typeof payload?.id === "number" ? payload.id : null;
  } catch { return null; }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!extractUserId(req)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

function requireAlpaca(_req: Request, res: Response, next: NextFunction): void {
  if (!ALPACA_CONFIGURED()) {
    res.status(503).json({
      error: "Live brokerage not configured.",
      configured: false,
      hint: "Set ALPACA_KEY_ID and ALPACA_SECRET_KEY in your Replit secrets to enable paper trading via Alpaca Markets (free at alpaca.markets).",
    });
    return;
  }
  next();
}

// ── Routes ────────────────────────────────────────────────────────

/** GET /api/brokerage/status — no auth required */
router.get("/brokerage/status", (_req, res) => {
  res.json({
    configured: ALPACA_CONFIGURED(),
    provider:   "Alpaca Markets (Paper Trading)",
    dataFeed:   "IEX real-time (free tier)",
    signupUrl:  "https://app.alpaca.markets/signup",
    hint: ALPACA_CONFIGURED()
      ? null
      : "Create a free account at alpaca.markets → Paper Trading → API Keys, then set ALPACA_KEY_ID and ALPACA_SECRET_KEY in your Replit secrets.",
  });
});

/** GET /api/brokerage/account */
router.get("/brokerage/account", requireAuth, requireAlpaca, async (_req, res): Promise<void> => {
  try {
    const acct = await alpacaGetAccount();
    res.json({
      equity:         +parseFloat(String(acct["equity"]         ?? 0)).toFixed(2),
      cash:           +parseFloat(String(acct["cash"]           ?? 0)).toFixed(2),
      buyingPower:    +parseFloat(String(acct["buying_power"]   ?? 0)).toFixed(2),
      portfolioValue: +parseFloat(String(acct["portfolio_value"]?? 0)).toFixed(2),
      daytradeCount:  Number(acct["daytrade_count"] ?? 0),
      status:         acct["status"] as string,
      currency:       (acct["currency"] as string) ?? "USD",
      provider:       "alpaca-paper",
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Alpaca error" });
  }
});

/** GET /api/brokerage/positions */
router.get("/brokerage/positions", requireAuth, requireAlpaca, async (_req, res): Promise<void> => {
  try {
    const positions = await alpacaGetPositions();
    res.json(
      positions.map(p => ({
        symbol:          String(p["symbol"] ?? ""),
        qty:             +parseFloat(String(p["qty"] ?? 0)),
        side:            parseFloat(String(p["qty"] ?? 0)) > 0 ? "long" : "short",
        avgEntryPrice:   +parseFloat(String(p["avg_entry_price"] ?? 0)).toFixed(4),
        currentPrice:    +parseFloat(String(p["current_price"]   ?? 0)).toFixed(4),
        marketValue:     +parseFloat(String(p["market_value"]    ?? 0)).toFixed(2),
        unrealizedPl:    +parseFloat(String(p["unrealized_pl"]   ?? 0)).toFixed(2),
        unrealizedPlPct: +parseFloat(String(p["unrealized_plpc"] ?? 0)).toFixed(4),
        costBasis:       +parseFloat(String(p["cost_basis"]      ?? 0)).toFixed(2),
      })),
    );
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Alpaca error" });
  }
});

/** GET /api/brokerage/orders?status=open|closed|all */
router.get("/brokerage/orders", requireAuth, requireAlpaca, async (req, res): Promise<void> => {
  try {
    const status = (["open", "closed", "all"].includes(String(req.query["status"]))
      ? req.query["status"]
      : "all") as "open" | "closed" | "all";
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "50"), 10) || 50, 500);
    const orders = await alpacaGetOrders(status, limit);
    res.json(
      orders.map(o => ({
        id:             o["id"],
        symbol:         o["symbol"],
        qty:            parseFloat(String(o["qty"]           ?? 0)),
        filledQty:      parseFloat(String(o["filled_qty"]    ?? 0)),
        side:           o["side"],
        type:           o["type"],
        status:         o["status"],
        limitPrice:     o["limit_price"]     ? parseFloat(String(o["limit_price"]))     : null,
        stopPrice:      o["stop_price"]      ? parseFloat(String(o["stop_price"]))      : null,
        filledAvgPrice: o["filled_avg_price"]? parseFloat(String(o["filled_avg_price"])): null,
        submittedAt:    o["submitted_at"],
        filledAt:       o["filled_at"],
      })),
    );
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Alpaca error" });
  }
});

/** POST /api/brokerage/orders */
router.post("/brokerage/orders", requireAuth, requireAlpaca, async (req, res): Promise<void> => {
  try {
    const body = req.body as Partial<AlpacaOrderRequest>;
    const { symbol, qty, side, type } = body;
    if (!symbol || !qty || !side || !type) {
      res.status(400).json({ error: "symbol, qty, side, and type are required" });
      return;
    }
    const order = await alpacaPlaceOrder({
      symbol:        symbol.toUpperCase(),
      qty:           Number(qty),
      side,
      type,
      time_in_force: body.time_in_force ?? "day",
      limit_price:   body.limit_price,
      stop_price:    body.stop_price,
    });
    res.status(201).json(order);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Alpaca error" });
  }
});

/** DELETE /api/brokerage/orders/:id */
router.delete("/brokerage/orders/:id", requireAuth, requireAlpaca, async (req, res): Promise<void> => {
  try {
    const result = await alpacaCancelOrder(String(req.params["id"]));
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Alpaca error" });
  }
});

export default router;
