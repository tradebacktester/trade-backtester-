import { pgTable, serial, integer, varchar, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const drawingsTable = pgTable("drawings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  symbol: varchar("symbol", { length: 30 }).notNull(),
  interval: varchar("interval", { length: 10 }).notNull(),
  data: jsonb("data").notNull().default("[]"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, t => [
  uniqueIndex("drawings_uid_sym_iv_idx").on(t.userId, t.symbol, t.interval),
  index("drawings_uid_idx").on(t.userId),
]);
