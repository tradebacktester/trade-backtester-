import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const rateLimitLogTable = pgTable("rate_limit_log", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("rate_limit_log_key_idx").on(t.key),
  index("rate_limit_log_key_created_idx").on(t.key, t.createdAt),
]);
