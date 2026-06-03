import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const liveTradesTable = pgTable("live_trades", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id").notNull(),
  tradeDate: text("trade_date").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 6 }),
  pnlAmount: numeric("pnl_amount", { precision: 18, scale: 6 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLiveTradeSchema = createInsertSchema(liveTradesTable).omit({ id: true, createdAt: true });
export type InsertLiveTrade = z.infer<typeof insertLiveTradeSchema>;
export type LiveTrade = typeof liveTradesTable.$inferSelect;
