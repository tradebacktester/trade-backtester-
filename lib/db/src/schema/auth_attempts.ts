import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const authAttemptsTable = pgTable("auth_attempts", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
