import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  alertsTable,
  alertConditionsTable,
  alertNotificationsTable,
  subscriptionsTable,
  subscriptionPlansTable,
} from "@workspace/db";
import type { AlertConditionSpec } from "@workspace/db";
import { verifyJwt } from "../lib/jwt";
import { extractTraderProfile } from "../lib/pattern-extractor";
import { isIndicatorKeySupported, getIndicatorCatalog } from "../lib/indicator-snapshot";
import OpenAI from "openai";
import pino from "pino";

const logger = pino({ level: "info" });
const JWT_SECRET = process.env.JWT_SECRET ?? "";

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth || !JWT_SECRET) return null;
    const token = auth.replace("Bearer ", "").trim();
    const payload = verifyJwt(token, JWT_SECRET);
    return typeof payload?.id === "number" ? payload.id : null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals["userId"] = userId;
  next();
}

function groqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
}

const VALID_ALERT_TYPES = ["price", "indicator", "drawing", "strategy", "ai", "dna"] as const;
type AlertType = (typeof VALID_ALERT_TYPES)[number];
const VALID_OPERATORS = [
  "crossAbove", "crossBelow", "gt", "lt", "eq", "enters", "exits", "signal",
  "touch", "breakAbove", "breakBelow", "enterZone", "exitZone", "fibLevel",
] as const;
const VALID_DRAWING_EVENTS = ["touch", "breakAbove", "breakBelow", "enterZone", "exitZone", "fibLevel"] as const;

const CROSS_OPERATORS = new Set(["crossAbove", "crossBelow"]);
const THRESHOLD_OPERATORS = new Set(["gt", "lt", "eq", "enters", "exits"]);
const DRAWING_OPERATORS = new Set(["touch", "breakAbove", "breakBelow", "enterZone", "exitZone", "fibLevel"]);

interface CreateAlertBody {
  name: string;
  type: AlertType;
  symbol: string;
  timeframe: string;
  conditions: AlertConditionSpec[];
  deliveryChannels: string[];
  triggerOnce: boolean;
}

interface UpdateAlertBody {
  name?: string;
  type?: AlertType;
  symbol?: string;
  timeframe?: string;
  conditions?: AlertConditionSpec[];
  deliveryChannels?: string[];
  isActive?: boolean;
  triggerOnce?: boolean;
}

function isDrawingCondition(cond: Record<string, unknown>): boolean {
  return (
    cond["drawingId"] !== undefined ||
    cond["drawingEvent"] !== undefined ||
    (typeof cond["indicatorId"] === "string" && cond["indicatorId"] === "drawing")
  );
}

function validateCondition(c: unknown): string | null {
  if (!c || typeof c !== "object") return "Condition must be an object";
  const cond = c as Record<string, unknown>;

  const indicatorId = cond["indicatorId"];
  const outputKey = cond["outputKey"];
  const operator = cond["operator"];
  const logicOp = cond["logicOp"];
  const targetValue = cond["targetValue"];
  const targetIndicatorId = cond["targetIndicatorId"];
  const targetOutputKey = cond["targetOutputKey"];

  if (!indicatorId || typeof indicatorId !== "string") return "condition.indicatorId is required";
  if (!outputKey || typeof outputKey !== "string") return "condition.outputKey is required";
  if (!VALID_OPERATORS.includes(operator as any)) {
    return `condition.operator must be one of: ${VALID_OPERATORS.join(", ")}`;
  }
  if (logicOp !== "AND" && logicOp !== "OR") return "condition.logicOp must be AND or OR";

  if (isDrawingCondition(cond)) {
    if (cond["drawingEvent"] !== undefined && !VALID_DRAWING_EVENTS.includes(cond["drawingEvent"] as any)) {
      return `condition.drawingEvent must be one of: ${VALID_DRAWING_EVENTS.join(", ")}`;
    }
    if (!DRAWING_OPERATORS.has(operator as string) && operator !== "signal") {
      return `Drawing conditions must use a drawing operator: ${[...DRAWING_OPERATORS].join(", ")}`;
    }
    return null;
  }

  if (!isIndicatorKeySupported(indicatorId as string, outputKey as string)) {
    return `condition indicator "${indicatorId}_${outputKey}" is not supported. Use one of the documented indicator keys.`;
  }

  if (targetValue !== undefined && (typeof targetValue !== "number" || !isFinite(targetValue))) {
    return "condition.targetValue must be a finite number";
  }

  const hasTargetIndicator = targetIndicatorId !== undefined;
  const hasTargetOutputKey = targetOutputKey !== undefined;
  if (hasTargetIndicator !== hasTargetOutputKey) {
    return "condition.targetIndicatorId and condition.targetOutputKey must both be present or both absent";
  }
  if (hasTargetIndicator) {
    if (typeof targetIndicatorId !== "string" || typeof targetOutputKey !== "string") {
      return "condition.targetIndicatorId and targetOutputKey must be strings";
    }
    if (!isIndicatorKeySupported(targetIndicatorId as string, targetOutputKey as string)) {
      return `condition target indicator "${targetIndicatorId}_${targetOutputKey}" is not supported`;
    }
  }

  if (CROSS_OPERATORS.has(operator as string)) {
    if (targetValue === undefined && !hasTargetIndicator) {
      return `operator "${operator}" requires either targetValue or targetIndicatorId+targetOutputKey`;
    }
  } else if (THRESHOLD_OPERATORS.has(operator as string)) {
    if (targetValue === undefined && !hasTargetIndicator) {
      return `operator "${operator}" requires either targetValue or targetIndicatorId+targetOutputKey`;
    }
  }

  return null;
}

function validatePriceLevelConditions(conditions: AlertConditionSpec[]): string | null {
  for (const c of conditions) {
    if (c.indicatorId !== "price") {
      return `Free-plan price alerts only allow conditions on the price indicator (indicatorId must be "price", got "${c.indicatorId}")`;
    }
    if (!["open", "high", "low", "close", "volume"].includes(c.outputKey)) {
      return `Free-plan price alerts only allow price outputs: open, high, low, close, volume`;
    }
    if (c.targetIndicatorId) {
      return "Free-plan price alerts cannot compare to another indicator; use a numeric targetValue";
    }
    if (c.targetValue === undefined || typeof c.targetValue !== "number") {
      return "Free-plan price alerts require a numeric targetValue";
    }
    const allowed = ["gt", "lt", "eq", "crossAbove", "crossBelow"];
    if (!allowed.includes(c.operator)) {
      return `Free-plan price alerts only support operators: ${allowed.join(", ")}`;
    }
  }
  return null;
}

function validateCreateAlert(body: unknown): { data: CreateAlertBody } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Request body is required" };
  const b = body as Record<string, unknown>;
  if (!b["name"] || typeof b["name"] !== "string" || b["name"].trim().length === 0) return { error: "name is required" };
  if ((b["name"] as string).length > 100) return { error: "name must be at most 100 characters" };
  if (!b["symbol"] || typeof b["symbol"] !== "string" || b["symbol"].trim().length === 0) return { error: "symbol is required" };
  if (b["type"] !== undefined && !VALID_ALERT_TYPES.includes(b["type"] as AlertType)) {
    return { error: `type must be one of: ${VALID_ALERT_TYPES.join(", ")}` };
  }
  if (!Array.isArray(b["conditions"]) || b["conditions"].length === 0) {
    return { error: "conditions must be a non-empty array" };
  }
  for (const cond of b["conditions"]) {
    const err = validateCondition(cond);
    if (err) return { error: err };
  }
  return {
    data: {
      name: (b["name"] as string).trim(),
      type: (b["type"] as AlertType | undefined) ?? "price",
      symbol: (b["symbol"] as string).trim(),
      timeframe: typeof b["timeframe"] === "string" ? b["timeframe"] : "1d",
      conditions: b["conditions"] as AlertConditionSpec[],
      deliveryChannels: Array.isArray(b["deliveryChannels"]) ? (b["deliveryChannels"] as string[]) : ["in_app"],
      triggerOnce: typeof b["triggerOnce"] === "boolean" ? b["triggerOnce"] : false,
    },
  };
}

function validateUpdateAlert(body: unknown): { data: UpdateAlertBody } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Request body is required" };
  const b = body as Record<string, unknown>;
  if (b["name"] !== undefined && (typeof b["name"] !== "string" || b["name"].trim().length === 0)) {
    return { error: "name must be a non-empty string" };
  }
  if (b["name"] !== undefined && (b["name"] as string).length > 100) {
    return { error: "name must be at most 100 characters" };
  }
  if (b["type"] !== undefined && !VALID_ALERT_TYPES.includes(b["type"] as AlertType)) {
    return { error: `type must be one of: ${VALID_ALERT_TYPES.join(", ")}` };
  }
  if (b["conditions"] !== undefined && (!Array.isArray(b["conditions"]) || b["conditions"].length === 0)) {
    return { error: "conditions must be a non-empty array" };
  }
  if (b["conditions"] !== undefined) {
    for (const cond of b["conditions"] as unknown[]) {
      const err = validateCondition(cond);
      if (err) return { error: err };
    }
  }
  return {
    data: {
      name: typeof b["name"] === "string" ? b["name"].trim() : undefined,
      type: b["type"] as AlertType | undefined,
      symbol: typeof b["symbol"] === "string" ? b["symbol"].trim() : undefined,
      timeframe: typeof b["timeframe"] === "string" ? b["timeframe"] : undefined,
      conditions: Array.isArray(b["conditions"]) ? (b["conditions"] as AlertConditionSpec[]) : undefined,
      deliveryChannels: Array.isArray(b["deliveryChannels"]) ? (b["deliveryChannels"] as string[]) : undefined,
      isActive: typeof b["isActive"] === "boolean" ? b["isActive"] : undefined,
      triggerOnce: typeof b["triggerOnce"] === "boolean" ? b["triggerOnce"] : undefined,
    },
  };
}

// Fallback limits used only when subscription_plans.features does not contain the keys
const FALLBACK_PLAN_LIMITS: Record<string, { maxAlerts: number; allowedTypes: string[] }> = {
  free:  { maxAlerts: 5,   allowedTypes: ["price"] },
  pro:   { maxAlerts: 100, allowedTypes: ["price", "indicator", "drawing", "strategy"] },
  elite: { maxAlerts: -1,  allowedTypes: ["price", "indicator", "drawing", "strategy", "ai", "dna"] },
};

interface PlanInfo {
  slug: string;
  maxAlerts: number;
  allowedTypes: string[];
}

async function getUserPlan(userId: number): Promise<PlanInfo> {
  const [activeSub] = await db
    .select({ planId: subscriptionsTable.planId })
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  if (!activeSub) return { slug: "free", ...FALLBACK_PLAN_LIMITS["free"]! };

  const [plan] = await db
    .select({ slug: subscriptionPlansTable.slug, features: subscriptionPlansTable.features })
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, activeSub.planId))
    .limit(1);

  const slug = plan?.slug ?? "free";
  const features = (plan?.features ?? {}) as Record<string, unknown>;
  const fallback = FALLBACK_PLAN_LIMITS[slug] ?? FALLBACK_PLAN_LIMITS["free"]!;

  return {
    slug,
    maxAlerts:    typeof features["maxAlerts"] === "number" ? features["maxAlerts"] : fallback.maxAlerts,
    allowedTypes: Array.isArray(features["alertTypes"]) ? (features["alertTypes"] as string[]) : fallback.allowedTypes,
  };
}

// Keep the old helper for callers that only need the slug
async function getUserPlanSlug(userId: number): Promise<string> {
  return (await getUserPlan(userId)).slug;
}

async function syncConditionRows(alertId: number, conditions: AlertConditionSpec[]): Promise<void> {
  await db.delete(alertConditionsTable).where(eq(alertConditionsTable.alertId, alertId));
  if (conditions.length === 0) return;
  await db.insert(alertConditionsTable).values(
    conditions.map((c) => ({
      alertId,
      conditionType: c.drawingId ? "drawing" : c.targetIndicatorId ? "indicator_cross" : c.targetValue !== undefined ? "price_level" : "indicator",
      indicatorId: c.indicatorId,
      outputKey: c.outputKey,
      operator: c.operator,
      value: c.targetValue !== undefined ? String(c.targetValue) : null,
      targetIndicatorId: c.targetIndicatorId ?? null,
      targetOutputKey: c.targetOutputKey ?? null,
      logicOp: c.logicOp,
      groupId: c.groupId ?? 0,
    })),
  );
}

const router: IRouter = Router();

// ── Public route (no auth) ────────────────────────────────────────────────
router.get("/alerts/catalog", (_req, res: Response): void => {
  const catalog = getIndicatorCatalog();
  const categories = [
    { id: "price", label: "Price", icon: "DollarSign" },
    { id: "trend", label: "Trend", icon: "TrendingUp" },
    { id: "momentum", label: "Momentum", icon: "Zap" },
    { id: "volatility", label: "Volatility", icon: "Activity" },
    { id: "volume", label: "Volume", icon: "BarChart2" },
    { id: "drawing", label: "Drawing Tools", icon: "Pencil" },
  ];
  res.json({ catalog, categories });
});

// ── Auth middleware — all /alerts/* except stream (stream does its own JWT check) ──
router.use("/alerts", (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === "/stream") { next(); return; }
  requireAuth(req, res, next);
});

router.get("/alerts", async (_req, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;

  const [alerts, notifications, plan] = await Promise.all([
    db.select().from(alertsTable).where(eq(alertsTable.userId, userId)).orderBy(desc(alertsTable.createdAt)),
    db.select({ id: alertNotificationsTable.id, isRead: alertNotificationsTable.isRead })
      .from(alertNotificationsTable)
      .where(eq(alertNotificationsTable.userId, userId)),
    getUserPlan(userId),
  ]);

  const total = alerts.length;
  const active = alerts.filter(a => a.isActive).length;
  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  res.json({
    alerts: alerts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      lastTriggeredAt: a.lastTriggeredAt?.toISOString() ?? null,
    })),
    planSlug: plan.slug,
    maxAlerts: plan.maxAlerts,
    allowedTypes: plan.allowedTypes,
    total,
    active,
    unreadNotifications,
  });
});

router.post("/alerts", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;

  const parsed = validateCreateAlert(req.body as unknown);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const data = parsed.data;
  const plan = await getUserPlan(userId);

  if (!plan.allowedTypes.includes(data.type)) {
    res.status(403).json({
      error: `Alert type "${data.type}" is not available on your current plan. Upgrade to access this feature.`,
    });
    return;
  }

  if (plan.slug === "free" && data.type === "price") {
    const priceLevelError = validatePriceLevelConditions(data.conditions);
    if (priceLevelError) {
      res.status(403).json({ error: priceLevelError });
      return;
    }
  }

  if (plan.maxAlerts !== -1) {
    const [countRow] = await db
      .select({ count: db.$count(alertsTable) })
      .from(alertsTable)
      .where(and(eq(alertsTable.userId, userId), eq(alertsTable.isActive, true)));
    const existing = Number(countRow?.count ?? 0);
    if (existing >= plan.maxAlerts) {
      res.status(403).json({
        error: `You have reached the maximum of ${plan.maxAlerts} alerts on your current plan. Upgrade for more.`,
      });
      return;
    }
  }

  const [alert] = await db
    .insert(alertsTable)
    .values({
      userId,
      name: data.name,
      type: data.type,
      symbol: data.symbol,
      timeframe: data.timeframe,
      conditions: data.conditions as AlertConditionSpec[],
      deliveryChannels: data.deliveryChannels,
      triggerOnce: data.triggerOnce,
    })
    .returning();

  await syncConditionRows(alert!.id, data.conditions);

  res.status(201).json({
    ...alert!,
    createdAt: alert!.createdAt.toISOString(),
    updatedAt: alert!.updatedAt.toISOString(),
    lastTriggeredAt: null,
  });
});

router.patch("/alerts/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const alertId = parseInt((req.params as Record<string, string>)["id"] ?? "");

  if (isNaN(alertId)) {
    res.status(400).json({ error: "Invalid alert id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(alertsTable)
    .where(and(eq(alertsTable.id, alertId), eq(alertsTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  const parsed = validateUpdateAlert(req.body as unknown);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const data = parsed.data;

  const plan = await getUserPlan(userId);

  if (data.type && data.type !== existing.type) {
    if (!plan.allowedTypes.includes(data.type)) {
      res.status(403).json({
        error: `Alert type "${data.type}" is not available on your current plan.`,
      });
      return;
    }
  }

  if (data.conditions !== undefined) {
    const effectiveType = data.type ?? existing.type;
    if (plan.slug === "free" && effectiveType === "price") {
      const priceLevelError = validatePriceLevelConditions(data.conditions);
      if (priceLevelError) {
        res.status(403).json({ error: priceLevelError });
        return;
      }
    }
  }

  const updatePayload: Partial<typeof alertsTable.$inferInsert> = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.symbol !== undefined) updatePayload.symbol = data.symbol;
  if (data.timeframe !== undefined) updatePayload.timeframe = data.timeframe;
  if (data.conditions !== undefined) updatePayload.conditions = data.conditions as AlertConditionSpec[];
  if (data.deliveryChannels !== undefined) updatePayload.deliveryChannels = data.deliveryChannels;
  if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
  if (data.triggerOnce !== undefined) updatePayload.triggerOnce = data.triggerOnce;

  const [updated] = await db
    .update(alertsTable)
    .set(updatePayload)
    .where(and(eq(alertsTable.id, alertId), eq(alertsTable.userId, userId)))
    .returning();

  if (data.conditions !== undefined) {
    await syncConditionRows(alertId, data.conditions);
  }

  res.json({
    ...updated!,
    createdAt: updated!.createdAt.toISOString(),
    updatedAt: updated!.updatedAt.toISOString(),
    lastTriggeredAt: updated!.lastTriggeredAt?.toISOString() ?? null,
  });
});

router.delete("/alerts/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const alertId = parseInt((req.params as Record<string, string>)["id"] ?? "");

  if (isNaN(alertId)) {
    res.status(400).json({ error: "Invalid alert id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(alertsTable)
    .where(and(eq(alertsTable.id, alertId), eq(alertsTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  await db
    .delete(alertsTable)
    .where(and(eq(alertsTable.id, alertId), eq(alertsTable.userId, userId)));

  res.status(204).send();
});

router.get("/alerts/notifications", async (_req, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const notifications = await db
    .select()
    .from(alertNotificationsTable)
    .where(eq(alertNotificationsTable.userId, userId))
    .orderBy(desc(alertNotificationsTable.triggeredAt))
    .limit(50);

  res.json(
    notifications.map((n) => ({
      ...n,
      triggeredAt: n.triggeredAt.toISOString(),
    })),
  );
});

router.patch("/alerts/notifications/:id/read", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const notifId = parseInt((req.params as Record<string, string>)["id"] ?? "");

  if (isNaN(notifId)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  await db
    .update(alertNotificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(alertNotificationsTable.id, notifId),
        eq(alertNotificationsTable.userId, userId),
      ),
    );

  res.json({ success: true });
});

router.post("/alerts/ai-suggest", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const planSlug = await getUserPlanSlug(userId);

  if (planSlug !== "elite") {
    res.status(403).json({ error: "AI alert suggestions require an Elite plan." });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const symbol = typeof b["symbol"] === "string" ? b["symbol"] : "BTCUSDT";
  const timeframe = typeof b["timeframe"] === "string" ? b["timeframe"] : "1d";
  const alertType = typeof b["alertType"] === "string" ? b["alertType"] : "indicator";
  const context = typeof b["context"] === "string" ? b["context"] : "";

  // ── Trader DNA context (Elite feature — personalise suggestions) ────
  let dnaContext = "";
  try {
    const profile = await extractTraderProfile(userId);
    const topMistakes = (profile.journalMistakes ?? []).slice(0, 3).map(m => `• ${m.label} (${m.count}x)`).join("\n");
    const topStrategies = (profile.strategyStats ?? []).slice(0, 2).map(s => `• ${s.type} (win rate ${s.avgWinRate.toFixed(0)}%)`).join("\n");
    const tradeStyle = profile.traderStyle ?? "";
    const preferredSide = profile.preferredSide ?? "mixed";
    if (topMistakes || topStrategies) {
      dnaContext = `\n\nTrader DNA (personalise suggestions to this trader's history):
Trade style: ${tradeStyle || "unknown"}, preferred side: ${preferredSide}
Top mistakes: ${topMistakes || "none recorded"}
Best-performing strategies: ${topStrategies || "none recorded"}
Use this DNA to suggest alerts that guard against the trader's known weaknesses and reinforce their winning setups.`;
    }
  } catch { /* best-effort — proceed without DNA if unavailable */ }

  const catalog = getIndicatorCatalog()
    .filter(e => e.category !== "drawing")
    .slice(0, 20)
    .map(e => `${e.key}: ${e.label} (${e.category})`).join("\n");

  const systemPrompt = `You are an expert algorithmic trading alert designer. Suggest 2-3 precise, actionable alert conditions tailored to the trader's history.
Available indicator keys:
${catalog}${dnaContext}

Respond ONLY with valid JSON in this format:
{
  "name": "<concise alert name>",
  "rationale": "<1-2 sentence explanation personalised to this trader's DNA>",
  "conditions": [
    {
      "indicatorId": "<indicatorId from catalog>",
      "outputKey": "<outputKey from catalog>",
      "operator": "crossAbove|crossBelow|gt|lt|eq",
      "targetValue": <number or null>,
      "targetIndicatorId": "<optional>",
      "targetOutputKey": "<optional>",
      "logicOp": "AND|OR",
      "groupId": 0
    }
  ]
}`;

  const userMsg = `Symbol: ${symbol}, Timeframe: ${timeframe}, Alert type: ${alertType}${context ? `, Context: ${context}` : ""}. Suggest smart alert conditions that match this trader's strengths and guard against their weaknesses.`;

  try {
    const client = groqClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      max_tokens: 500,
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let suggestion: Record<string, unknown> = {};
    try { suggestion = JSON.parse(raw); } catch { suggestion = {}; }

    if (!Array.isArray(suggestion["conditions"]) || (suggestion["conditions"] as unknown[]).length === 0) {
      res.status(500).json({ error: "AI returned an empty suggestion. Please try again." });
      return;
    }

    res.json(suggestion);
  } catch (err) {
    logger.error(err, "alerts/ai-suggest error");
    res.status(500).json({ error: "AI service temporarily unavailable." });
  }
});

router.get("/alerts/stream", (req: Request, res: Response): void => {
  // EventSource cannot send headers — accept token via query param for SSE only
  let userId: number | null = null;
  const queryToken = (req.query as Record<string, string>)["token"];
  if (queryToken && JWT_SECRET) {
    try {
      const payload = verifyJwt(queryToken, JWT_SECRET);
      userId = typeof payload?.id === "number" ? payload.id : null;
    } catch { /* invalid token */ }
  }
  if (!userId) {
    userId = extractUserId(req);
  }
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write("data: {\"type\":\"connected\"}\n\n");

  const sseClients = (req.app as any)._alertSseClients as Map<number, Set<Response>> | undefined;
  if (sseClients) {
    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId)!.add(res);
  }

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 25_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    if (sseClients) {
      sseClients.get(userId)?.delete(res);
    }
  });
});

export default router;
