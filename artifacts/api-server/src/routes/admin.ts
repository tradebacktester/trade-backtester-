import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db, usersTable, policiesTable, subscriptionPlansTable, subscriptionsTable, paymentsTable, adminAttemptsTable } from "@workspace/db";
import { eq, and, desc, gt, lt, count as drizzleCount } from "drizzle-orm";
import { ensurePlans } from "./subscription";

const ADMIN_ID = process.env.ADMIN_ID ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_ID_2 = process.env.ADMIN_ID_2 ?? "";
const ADMIN_PASSWORD_2 = process.env.ADMIN_PASSWORD_2 ?? "";
const HMAC_SECRET = `${ADMIN_ID}:${ADMIN_PASSWORD}:${ADMIN_ID_2}:${ADMIN_PASSWORD_2}`;

const DEFAULT_POLICIES = [
  { slug: "privacy_policy", title: "Privacy Policy", content: "We collect information you provide when signing up, including name and email. This data is used solely to manage your account and is never sold to third parties. You may request deletion of your data at any time." },
  { slug: "terms_and_conditions", title: "Terms & Conditions", content: "By using this platform, you agree to use it for educational and personal research purposes only. We reserve the right to suspend accounts that violate these terms. All features are provided 'as is' without warranty." },
  { slug: "financial_disclaimer", title: "Financial Disclaimer", content: "All content on this platform is for informational and educational purposes only. Nothing on this platform constitutes financial advice, investment recommendations, or solicitation to buy or sell any financial instrument. Past performance is not indicative of future results." },
  { slug: "risk_disclosure", title: "Risk Disclosure", content: "Trading financial instruments carries significant risk of loss. You may lose some or all of your invested capital. Markets can be volatile and unpredictable. Only trade with money you can afford to lose. This platform uses simulated and algorithmically generated data for backtesting purposes only." },
  { slug: "no_broker_relationship", title: "No Broker Relationship Statement", content: "This platform does not act as a broker, dealer, investment advisor, portfolio manager, or any financial intermediary. We do not execute real trades, hold client funds, manage investments, or provide personalised investment advice on behalf of users." },
  { slug: "data_accuracy_disclaimer", title: "Data Accuracy Disclaimer", content: "Historical price data used for backtesting is simulated and generated algorithmically. It may not reflect actual market conditions, prices, or volumes. We make no guarantees about the accuracy, completeness, or timeliness of any data provided on this platform." },
  { slug: "no_refund_policy", title: "No Refund Policy", content: "All purchases or subscriptions are final and non-refundable except where required by applicable law. Please thoroughly review all features and terms before subscribing. Contacting support does not automatically entitle you to a refund." },
  { slug: "account_deletion_policy", title: "Account Deletion Policy", content: "You may request account deletion at any time by contacting support or using the account settings page. Upon deletion, your personal data will be permanently removed within 30 days, subject to any legal retention requirements. Deleted accounts cannot be recovered." },
  { slug: "ai_disclosure", title: "AI Disclosure", content: "This platform uses artificial intelligence models to provide market analysis, pattern recognition, and trading insights. AI-generated content is experimental, may contain errors, and should not be relied upon as the sole basis for any financial decision. Always consult a qualified financial professional before making investment decisions." },
];

function makeAdminToken(): string {
  return createHmac("sha256", HMAC_SECRET).update("admin-session-v1").digest("hex");
}

function verifyAdminToken(token: string): boolean {
  if (!ADMIN_ID || !ADMIN_PASSWORD) return false;
  const expected = makeAdminToken();
  try {
    return (
      token.length === expected.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    );
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

async function ensurePolicies() {
  const count = await db.select().from(policiesTable);
  if (count.length === 0) {
    await db.insert(policiesTable).values(DEFAULT_POLICIES);
  }
}

const router: IRouter = Router();

async function checkAdminRateLimit(ip: string): Promise<boolean> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000);
  const [{ cnt }] = await db
    .select({ cnt: drizzleCount(adminAttemptsTable.id) })
    .from(adminAttemptsTable)
    .where(and(eq(adminAttemptsTable.ip, ip), gt(adminAttemptsTable.createdAt, fifteenMinutesAgo)));
  if (cnt >= 10) return false;
  await db.insert(adminAttemptsTable).values({ ip });
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  await db.delete(adminAttemptsTable).where(lt(adminAttemptsTable.createdAt, oneHourAgo));
  return true;
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";

  if (!await checkAdminRateLimit(ip)) {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }

  const { id, password, id2, password2 } = req.body;
  if (!id || !password || !id2 || !password2) {
    res.status(400).json({ error: "Both authentication credentials are required" });
    return;
  }

  function safeCmp(a: string, b: string): boolean {
    const aLen = Math.max(a.length, b.length);
    const bufA = Buffer.from(a.padEnd(aLen, "\0").slice(0, aLen));
    const bufB = Buffer.from(b.padEnd(aLen, "\0").slice(0, aLen));
    return timingSafeEqual(bufA, bufB) && a === b;
  }

  const cred1Ok = ADMIN_ID.length > 0 && safeCmp(String(id), ADMIN_ID) && safeCmp(String(password), ADMIN_PASSWORD);
  const cred2Ok = ADMIN_ID_2.length > 0 && safeCmp(String(id2), ADMIN_ID_2) && safeCmp(String(password2), ADMIN_PASSWORD_2);

  if (!cred1Ok || !cred2Ok) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  await db.delete(adminAttemptsTable).where(eq(adminAttemptsTable.ip, ip));
  res.json({ token: makeAdminToken() });
});

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    banned: usersTable.banned,
    bannedReason: usersTable.bannedReason,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

router.post("/admin/users/:id/ban", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params["id"] as string, 10);
  const { banned, reason } = req.body;
  const [updated] = await db.update(usersTable)
    .set({ banned: banned ?? true, bannedReason: reason ?? null })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ id: updated.id, banned: updated.banned, bannedReason: updated.bannedReason });
});

router.get("/admin/policies", requireAdmin, async (_req, res): Promise<void> => {
  await ensurePolicies();
  const policies = await db.select().from(policiesTable).orderBy(policiesTable.id);
  res.json(policies.map(p => ({ ...p, updatedAt: p.updatedAt.toISOString() })));
});

router.put("/admin/policies/:slug", requireAdmin, async (req, res): Promise<void> => {
  const slug = req.params["slug"] as string;
  const { content, title } = req.body;
  const [updated] = await db.update(policiesTable)
    .set({ content, title, updatedAt: new Date() })
    .where(eq(policiesTable.slug, slug))
    .returning();
  if (!updated) { res.status(404).json({ error: "Policy not found" }); return; }
  res.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
});

router.get("/policies", async (_req, res): Promise<void> => {
  await ensurePolicies();
  const policies = await db.select().from(policiesTable).orderBy(policiesTable.id);
  res.json(policies.map(p => ({ ...p, updatedAt: p.updatedAt.toISOString() })));
});

// ── Subscription plan management ─────────────────────────────────────

router.get("/admin/plans", requireAdmin, async (_req, res): Promise<void> => {
  await ensurePlans();
  const plans = await db.select().from(subscriptionPlansTable).orderBy(subscriptionPlansTable.sortOrder);
  res.json(plans.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })));
});

router.post("/admin/plans", requireAdmin, async (req, res): Promise<void> => {
  const { name, slug, description, priceMonthly, currency, features, sortOrder } = req.body;
  if (!name || !slug) { res.status(400).json({ error: "name and slug are required" }); return; }
  const [plan] = await db.insert(subscriptionPlansTable).values({
    name, slug, description: description ?? "", priceMonthly: priceMonthly ?? 0,
    currency: currency ?? "INR", features: features ?? {}, sortOrder: sortOrder ?? 0,
    isActive: true, isDefault: false,
  }).returning();
  res.status(201).json({ ...plan, createdAt: plan!.createdAt.toISOString(), updatedAt: plan!.updatedAt.toISOString() });
});

router.patch("/admin/plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { name, description, priceMonthly, features, isActive, sortOrder } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (priceMonthly !== undefined) updates.priceMonthly = priceMonthly;
  if (features !== undefined) updates.features = features;
  if (isActive !== undefined) updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  const [updated] = await db.update(subscriptionPlansTable)
    .set(updates as Partial<typeof subscriptionPlansTable.$inferInsert>)
    .where(eq(subscriptionPlansTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
});

// ── Subscriber management ────────────────────────────────────────────

router.get("/admin/subscriptions", requireAdmin, async (_req, res): Promise<void> => {
  const subs = await db
    .select({
      id: subscriptionsTable.id,
      userId: subscriptionsTable.userId,
      planId: subscriptionsTable.planId,
      status: subscriptionsTable.status,
      grantedByAdmin: subscriptionsTable.grantedByAdmin,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      createdAt: subscriptionsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      planName: subscriptionPlansTable.name,
      planSlug: subscriptionPlansTable.slug,
    })
    .from(subscriptionsTable)
    .leftJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
    .leftJoin(subscriptionPlansTable, eq(subscriptionsTable.planId, subscriptionPlansTable.id))
    .orderBy(desc(subscriptionsTable.createdAt));

  res.json(subs.map(s => ({
    ...s,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/admin/grant-premium", requireAdmin, async (req, res): Promise<void> => {
  const { userId, planId, months } = req.body as { userId: number; planId: number; months?: number };
  if (!userId || !planId) { res.status(400).json({ error: "userId and planId required" }); return; }

  await db.update(subscriptionsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")));

  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + (months ?? 1));

  const [sub] = await db.insert(subscriptionsTable).values({
    userId,
    planId,
    status: "active",
    grantedByAdmin: true,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  }).returning();

  res.status(201).json({ ...sub, currentPeriodStart: sub!.currentPeriodStart?.toISOString(), currentPeriodEnd: sub!.currentPeriodEnd?.toISOString(), createdAt: sub!.createdAt.toISOString() });
});

router.patch("/admin/subscriptions/:id/revoke", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const [updated] = await db.update(subscriptionsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.json({ success: true });
});

// ── Payment records ───────────────────────────────────────────────────

router.get("/admin/payments", requireAdmin, async (_req, res): Promise<void> => {
  const pmts = await db
    .select({
      id: paymentsTable.id,
      userId: paymentsTable.userId,
      planId: paymentsTable.planId,
      razorpayOrderId: paymentsTable.razorpayOrderId,
      razorpayPaymentId: paymentsTable.razorpayPaymentId,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      createdAt: paymentsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      planName: subscriptionPlansTable.name,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .leftJoin(subscriptionPlansTable, eq(paymentsTable.planId, subscriptionPlansTable.id))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(200);

  res.json(pmts.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

export default router;
