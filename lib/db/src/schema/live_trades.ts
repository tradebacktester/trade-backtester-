import { pgTable, serial, text, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { backtestsTable } from "./backtests";

export const liveTradesTable = pgTable("live_trades", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id").notNull().references(() => backtestsTable.id, { onDelete: "cascade" }),
  tradeDate: text("trade_date").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 6 }),
  pnlAmount: numeric("pnl_amount", { precision: 18, scale: 6 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("live_trades_backtest_id_idx").on(t.backtestId),
]);

export const insertLiveTradeSchema = createInsertSchema(liveTradesTable).omit({ id: true, createdAt: true });
export type InsertLiveTrade = z.infer<typeof insertLiveTradeSchema>;
export type LiveTrade = typeof liveTradesTable.$inferSelect;
