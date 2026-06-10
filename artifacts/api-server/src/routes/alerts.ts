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
import { isIndicatorKeySupported } from "../lib/indicator-snapshot";

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

const VALID_ALERT_TYPES = ["price", "indicator", "drawing", "strategy", "ai", "dna"] as const;
type AlertType = (typeof VALID_ALERT_TYPES)[number];
const VALID_OPERATORS = ["crossAbove", "crossBelow", "gt", "lt", "eq", "enters", "exits", "signal"] as const;

const CROSS_OPERATORS = new Set(["crossAbove", "crossBelow"]);
const THRESHOLD_OPERATORS = new Set(["gt", "lt", "eq", "enters", "exits"]);

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

const ALERT_PLAN_LIMITS: Record<string, { maxAlerts: number; allowedTypes: string[] }> = {
  free: {
    maxAlerts: 5,
    allowedTypes: ["price"],
  },
  pro: {
    maxAlerts: 100,
    allowedTypes: ["price", "indicator", "drawing", "strategy"],
  },
  elite: {
    maxAlerts: -1,
    allowedTypes: ["price", "indicator", "drawing", "strategy", "ai", "dna"],
  },
};

async function getUserPlanSlug(userId: number): Promise<string> {
  const [activeSub] = await db
    .select({ planId: subscriptionsTable.planId })
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  if (!activeSub) return "free";

  const [plan] = await db
    .select({ slug: subscriptionPlansTable.slug })
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, activeSub.planId))
    .limit(1);

  return plan?.slug ?? "free";
}

async function syncConditionRows(alertId: number, conditions: AlertConditionSpec[]): Promise<void> {
  await db.delete(alertConditionsTable).where(eq(alertConditionsTable.alertId, alertId));
  if (conditions.length === 0) return;
  await db.insert(alertConditionsTable).values(
    conditions.map((c) => ({
      alertId,
      conditionType: c.targetIndicatorId ? "indicator_cross" : c.targetValue !== undefined ? "price_level" : "indicator",
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

router.use("/alerts", requireAuth);

router.get("/alerts", async (_req, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const alerts = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.userId, userId))
    .orderBy(desc(alertsTable.createdAt));

  res.json(
    alerts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      lastTriggeredAt: a.lastTriggeredAt?.toISOString() ?? null,
    })),
  );
});

router.post("/alerts", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals["userId"] as number;

  const parsed = validateCreateAlert(req.body as unknown);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const data = parsed.data;
  const planSlug = await getUserPlanSlug(userId);
  const limits = ALERT_PLAN_LIMITS[planSlug] ?? ALERT_PLAN_LIMITS["free"]!;

  if (!limits.allowedTypes.includes(data.type)) {
    res.status(403).json({
      error: `Alert type "${data.type}" is not available on your current plan. Upgrade to access this feature.`,
    });
    return;
  }

  if (planSlug === "free" && data.type === "price") {
    const priceLevelError = validatePriceLevelConditions(data.conditions);
    if (priceLevelError) {
      res.status(403).json({ error: priceLevelError });
      return;
    }
  }

  if (limits.maxAlerts !== -1) {
    const [countRow] = await db
      .select({ count: db.$count(alertsTable) })
      .from(alertsTable)
      .where(eq(alertsTable.userId, userId));
    const existing = Number(countRow?.count ?? 0);
    if (existing >= limits.maxAlerts) {
      res.status(403).json({
        error: `You have reached the maximum of ${limits.maxAlerts} alerts on your current plan. Upgrade for more.`,
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

  const planSlug = await getUserPlanSlug(userId);

  if (data.type && data.type !== existing.type) {
    const limits = ALERT_PLAN_LIMITS[planSlug] ?? ALERT_PLAN_LIMITS["free"]!;
    if (!limits.allowedTypes.includes(data.type)) {
      res.status(403).json({
        error: `Alert type "${data.type}" is not available on your current plan.`,
      });
      return;
    }
  }

  if (data.conditions !== undefined) {
    const effectiveType = data.type ?? existing.type;
    if (planSlug === "free" && effectiveType === "price") {
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

router.get("/alerts/stream", requireAuth, (req: Request, res: Response): void => {
  const userId = res.locals["userId"] as number;

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
