import { pgTable, serial, timestamp, numeric, integer, index, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { strategiesTable } from "./strategies";

export const backtestsTable = pgTable("backtests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  strategyId: integer("strategy_id").notNull().references(() => strategiesTable.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  initialCapital: numeric("initial_capital", { precision: 18, scale: 4 }).notNull(),
  commission: numeric("commission", { precision: 8, scale: 4 }),
  slippage: numeric("slippage", { precision: 8, scale: 4 }),
  finalCapital: numeric("final_capital", { precision: 18, scale: 4 }),
  totalReturn: numeric("total_return", { precision: 12, scale: 6 }),
  annualizedReturn: numeric("annualized_return", { precision: 12, scale: 6 }),
  maxDrawdown: numeric("max_drawdown", { precision: 12, scale: 6 }),
  sharpeRatio: numeric("sharpe_ratio", { precision: 12, scale: 6 }),
  sortinoRatio: numeric("sortino_ratio", { precision: 12, scale: 6 }),
  calmarRatio: numeric("calmar_ratio", { precision: 12, scale: 6 }),
  benchmarkReturn: numeric("benchmark_return", { precision: 12, scale: 6 }),
  winRate: numeric("win_rate", { precision: 12, scale: 6 }),
  totalTrades: integer("total_trades"),
  profitFactor: numeric("profit_factor", { precision: 12, scale: 6 }),
  consecutiveWins: integer("consecutive_wins"),
  consecutiveLosses: integer("consecutive_losses"),
  dataSource: text("data_source"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("backtests_user_id_idx").on(t.userId),
  index("backtests_strategy_id_idx").on(t.strategyId),
]);

export const insertBacktestSchema = createInsertSchema(backtestsTable).omit({ id: true, createdAt: true });
export type InsertBacktest = z.infer<typeof insertBacktestSchema>;
export type Backtest = typeof backtestsTable.$inferSelect;
