import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const manualPaymentsTable = pgTable("manual_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull(),
  screenshotData: text("screenshot_data").notNull(),
  screenshotMime: text("screenshot_mime").notNull().default("image/jpeg"),
  utrNote: text("utr_note"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("manual_payments_user_id_idx").on(t.userId),
  index("manual_payments_status_idx").on(t.status),
]);

export type ManualPayment = typeof manualPaymentsTable.$inferSelect;
export type InsertManualPayment = typeof manualPaymentsTable.$inferInsert;
