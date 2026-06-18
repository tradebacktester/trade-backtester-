import { pgTable, serial, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  adminId: text("admin_id").notNull(),
  targetUserId: integer("target_user_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("admin_audit_log_created_at_idx").on(t.createdAt),
  index("admin_audit_log_action_idx").on(t.action),
  index("admin_audit_log_admin_id_idx").on(t.adminId),
]);
