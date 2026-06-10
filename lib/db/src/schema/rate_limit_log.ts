import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const rateLimitLogTable = pgTable("rate_limit_log", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
