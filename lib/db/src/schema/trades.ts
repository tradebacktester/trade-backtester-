import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryDate: text("entry_date").notNull(),
  exitDate: text("exit_date").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 6 }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
  pnl: numeric("pnl", { precision: 18, scale: 6 }).notNull(),
  pnlPercent: numeric("pnl_percent", { precision: 12, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
