import { pgTable, serial, integer, numeric, text, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const paperTradesTable = pgTable("paper_trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 6 }).notNull(),
  units: numeric("units", { precision: 18, scale: 6 }).notNull(),
  pnl: numeric("pnl", { precision: 18, scale: 6 }).notNull(),
  pnlPct: numeric("pnl_pct", { precision: 10, scale: 4 }).notNull(),
  entryTime: bigint("entry_time", { mode: "number" }).notNull(),
  exitTime: bigint("exit_time", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("paper_trades_user_id_idx").on(t.userId),
]);

export type PaperTrade = typeof paperTradesTable.$inferSelect;
export type InsertPaperTrade = typeof paperTradesTable.$inferInsert;
