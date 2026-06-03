import { pgTable, serial, timestamp, numeric, integer, index, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { backtestsTable } from "./backtests";

export const equityCurveTable = pgTable("equity_curve", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id").notNull().references(() => backtestsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  value: numeric("value", { precision: 18, scale: 4 }).notNull(),
  drawdown: numeric("drawdown", { precision: 12, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("equity_curve_backtest_id_idx").on(t.backtestId),
]);

export const insertEquityPointSchema = createInsertSchema(equityCurveTable).omit({ id: true, createdAt: true });
export type InsertEquityPoint = z.infer<typeof insertEquityPointSchema>;
export type EquityPoint = typeof equityCurveTable.$inferSelect;
