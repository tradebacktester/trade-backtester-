import { pgTable, serial, timestamp, numeric, integer, index, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { backtestsTable } from "./backtests";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id").notNull().references(() => backtestsTable.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryDate: date("entry_date").notNull(),
  exitDate: date("exit_date").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 6 }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
  pnl: numeric("pnl", { precision: 18, scale: 6 }).notNull(),
  pnlPercent: numeric("pnl_percent", { precision: 12, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("trades_backtest_id_idx").on(t.backtestId),
]);

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
