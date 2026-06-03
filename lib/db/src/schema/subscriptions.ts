import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { subscriptionPlansTable } from "./subscription_plans";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  grantedByAdmin: boolean("granted_by_admin").notNull().default(false),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("subscriptions_user_id_idx").on(t.userId),
  index("subscriptions_plan_id_idx").on(t.planId),
]);

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
