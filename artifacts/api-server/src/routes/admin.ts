import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac } from "crypto";
import { db, usersTable, policiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ADMIN_ID = process.env.ADMIN_ID ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const HMAC_SECRET = `${ADMIN_ID}:adivasu:admin`;

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
  return token === makeAdminToken();
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

router.post("/admin/login", async (req, res): Promise<void> => {
  const { id, password } = req.body;
  if (!id || !password) {
    res.status(400).json({ error: "ID and password are required" });
    return;
  }
  if (String(id) !== ADMIN_ID || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }
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
  const userId = parseInt(req.params.id, 10);
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
  const { slug } = req.params;
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

export default router;
