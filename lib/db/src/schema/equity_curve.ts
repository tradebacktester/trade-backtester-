import { pgTable, serial, timestamp, numeric, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const equityCurveTable = pgTable("equity_curve", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id").notNull(),
  date: text("date").notNull(),
  value: numeric("value", { precision: 18, scale: 4 }).notNull(),
  drawdown: numeric("drawdown", { precision: 12, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEquityPointSchema = createInsertSchema(equityCurveTable).omit({ id: true, createdAt: true });
export type InsertEquityPoint = z.infer<typeof insertEquityPointSchema>;
export type EquityPoint = typeof equityCurveTable.$inferSelect;
