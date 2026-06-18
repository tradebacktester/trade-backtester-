import { pgTable, serial, integer, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const psychAlertEventsTable = pgTable("psych_alert_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  isRead: boolean("is_read").notNull().default(false),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("psych_alert_events_user_id_idx").on(t.userId),
  index("psych_alert_events_user_detected_idx").on(t.userId, t.detectedAt),
]);

export type PsychAlertEvent = typeof psychAlertEventsTable.$inferSelect;
export type InsertPsychAlertEvent = typeof psychAlertEventsTable.$inferInsert;
