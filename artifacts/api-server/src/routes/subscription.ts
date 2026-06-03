import { Router, type IRouter, type Request, type Response } from "express";
import { verifyJwt } from "../lib/jwt";
import { createHmac } from "crypto";
import { db, subscriptionPlansTable, subscriptionsTable, paymentsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "rzp_test_placeholder";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "secret_placeholder";

let Razorpay: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Razorpay = require("razorpay");
} catch {
  Razorpay = null;
}

function getRazorpayInstance() {
  if (!Razorpay) return null;
  if (RAZORPAY_KEY_ID === "rzp_test_placeholder") return null;
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

const DEFAULT_PLANS = [
  {
    name: "Free",
    slug: "free",
    description: "Get started with basic trading tools and limited backtests.",
    priceMonthly: 0,
    currency: "INR",
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    features: {
      maxBacktestsPerMonth: 5,
      aiQueriesPerDay: 0,
      maxLeverage: 5,
      communityPost: false,
      replayMode: false,
      multiTfView: false,
      dataExport: false,
      priorityBadge: false,
      allIndicators: false,
    },
  },
  {
    name: "Pro",
    slug: "pro",
    description: "Unlimited backtests, all indicators, AI assistance, and replay mode.",
    priceMonthly: 49900,
    currency: "INR",
    isDefault: false,
    isActive: true,
    sortOrder: 1,
    features: {
      maxBacktestsPerMonth: -1,
      aiQueriesPerDay: 50,
      maxLeverage: 25,
      communityPost: true,
      replayMode: true,
      multiTfView: true,
      dataExport: false,
      priorityBadge: false,
      allIndicators: true,
    },
  },
  {
    name: "Elite",
    slug: "elite",
    description: "Everything in Pro plus unlimited AI, data export, and priority badge.",
    priceMonthly: 99900,
    currency: "INR",
    isDefault: false,
    isActive: true,
    sortOrder: 2,
    features: {
      maxBacktestsPerMonth: -1,
      aiQueriesPerDay: -1,
      maxLeverage: 100,
      communityPost: true,
      replayMode: true,
      multiTfView: true,
      dataExport: true,
      priorityBadge: true,
      allIndicators: true,
    },
  },
];

async function ensurePlans() {
  const existing = await db.select().from(subscriptionPlansTable);
  if (existing.length === 0) {
    await db.insert(subscriptionPlansTable).values(DEFAULT_PLANS);
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "";

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth) return null;
    const token = auth.replace("Bearer ", "").trim();
    if (!JWT_SECRET) return null;
    const payload = verifyJwt(token, JWT_SECRET);
    return typeof payload?.id === "number" ? payload.id : null;
  } catch { return null; }
}

const router: IRouter = Router();

router.get("/subscription/plans", async (_req, res): Promise<void> => {
  await ensurePlans();
  const plans = await db.select().from(subscriptionPlansTable).orderBy(subscriptionPlansTable.sortOrder);
  res.json(plans);
});

router.get("/subscription/status", async (req, res): Promise<void> => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await ensurePlans();

  const [active] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  if (!active) {
    const [freePlan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.isDefault, true)).limit(1);
    res.json({ subscription: null, plan: freePlan ?? null });
    return;
  }

  const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, active.planId)).limit(1);
  res.json({
    subscription: {
      ...active,
      currentPeriodStart: active.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: active.currentPeriodEnd?.toISOString() ?? null,
      cancelledAt: active.cancelledAt?.toISOString() ?? null,
      createdAt: active.createdAt.toISOString(),
    },
    plan: plan ?? null,
  });
});

router.post("/subscription/create-order", async (req, res): Promise<void> => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { planId } = req.body as { planId: number };
  if (!planId) { res.status(400).json({ error: "planId required" }); return; }

  const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId)).limit(1);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  if (!plan.isActive) { res.status(400).json({ error: "Plan is not available" }); return; }
  if (plan.priceMonthly === 0) { res.status(400).json({ error: "Free plan requires no payment" }); return; }

  const razorpay = getRazorpayInstance();

  let razorpayOrderId: string;
  if (razorpay) {
    const order = await razorpay.orders.create({
      amount: plan.priceMonthly,
      currency: plan.currency,
      receipt: `order_${userId}_${planId}_${Date.now()}`,
    });
    razorpayOrderId = order.id;
  } else {
    razorpayOrderId = `order_mock_${Date.now()}`;
  }

  await db.insert(paymentsTable).values({
    userId,
    planId,
    razorpayOrderId,
    amount: plan.priceMonthly,
    currency: plan.currency,
    status: "pending",
  });

  res.json({
    orderId: razorpayOrderId,
    amount: plan.priceMonthly,
    currency: plan.currency,
    keyId: RAZORPAY_KEY_ID,
    planName: plan.name,
  });
});

router.post("/subscription/verify", async (req, res): Promise<void> => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId } = req.body as {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    planId: number;
  };

  // Fail closed: if Razorpay is not configured, reject ALL verify requests.
  // Never skip signature verification in production (HIGH-008 fix).
  if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET === "secret_placeholder") {
    res.status(503).json({ error: "Payment verification is not configured on this server." });
    return;
  }
  const expectedSig = createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  if (expectedSig !== razorpaySignature) {
    res.status(400).json({ error: "Payment verification failed" });
    return;
  }

  const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId)).limit(1);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

  await db.update(paymentsTable)
    .set({ razorpayPaymentId, status: "captured" })
    .where(eq(paymentsTable.razorpayOrderId, razorpayOrderId));

  await db.update(subscriptionsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")));

  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [sub] = await db.insert(subscriptionsTable).values({
    userId,
    planId,
    status: "active",
    razorpayOrderId,
    razorpayPaymentId,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    grantedByAdmin: false,
  }).returning();

  await db.update(paymentsTable)
    .set({ subscriptionId: sub!.id })
    .where(eq(paymentsTable.razorpayOrderId, razorpayOrderId));

  res.json({ success: true, subscription: sub });
});

router.post("/subscription/cancel", async (req, res): Promise<void> => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.update(subscriptionsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")));

  res.json({ success: true });
});

router.get("/subscription/payments", async (req, res): Promise<void> => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const payments = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(20);

  res.json(payments.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

export default router;
export { ensurePlans, DEFAULT_PLANS };
