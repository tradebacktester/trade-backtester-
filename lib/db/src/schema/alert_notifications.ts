import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { alertsTable } from "./alerts";

export const alertNotificationsTable = pgTable("alert_notifications", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => alertsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
}, (t) => [
  index("alert_notif_user_id_idx").on(t.userId),
  index("alert_notif_alert_id_idx").on(t.alertId),
  index("alert_notif_triggered_at_idx").on(t.triggeredAt),
]);

export type AlertNotification = typeof alertNotificationsTable.$inferSelect;
export type InsertAlertNotification = typeof alertNotificationsTable.$inferInsert;
