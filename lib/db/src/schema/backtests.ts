import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const backtestsTable = pgTable("backtests", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  symbol: text("symbol").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  initialCapital: numeric("initial_capital", { precision: 18, scale: 4 }).notNull(),
  finalCapital: numeric("final_capital", { precision: 18, scale: 4 }),
  totalReturn: numeric("total_return", { precision: 12, scale: 6 }),
  annualizedReturn: numeric("annualized_return", { precision: 12, scale: 6 }),
  maxDrawdown: numeric("max_drawdown", { precision: 12, scale: 6 }),
  sharpeRatio: numeric("sharpe_ratio", { precision: 12, scale: 6 }),
  winRate: numeric("win_rate", { precision: 12, scale: 6 }),
  totalTrades: integer("total_trades"),
  profitFactor: numeric("profit_factor", { precision: 12, scale: 6 }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBacktestSchema = createInsertSchema(backtestsTable).omit({ id: true, createdAt: true });
export type InsertBacktest = z.infer<typeof insertBacktestSchema>;
export type Backtest = typeof backtestsTable.$inferSelect;
