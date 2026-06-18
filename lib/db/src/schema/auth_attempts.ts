import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const authAttemptsTable = pgTable("auth_attempts", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("auth_attempts_ip_idx").on(t.ip),
  index("auth_attempts_created_at_idx").on(t.createdAt),
]);
