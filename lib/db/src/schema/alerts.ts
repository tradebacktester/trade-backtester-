import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const alertTypeEnum = pgEnum("alert_type", ["price", "indicator", "drawing", "strategy", "ai", "dna"]);

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: alertTypeEnum("type").notNull().default("price"),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull().default("1d"),
  conditions: jsonb("conditions").notNull().$type<AlertConditionSpec[]>().default([]),
  deliveryChannels: jsonb("delivery_channels").$type<string[]>().notNull().default(["in_app"]),
  isActive: boolean("is_active").notNull().default(true),
  triggerOnce: boolean("trigger_once").notNull().default(false),
  triggerCount: integer("trigger_count").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export interface DrawingAlertGeometry {
  type: "hline" | "trendline" | "rect" | "fib" | "vline";
  price1?: number;
  price2?: number;
  time1?: number;
  time2?: number;
  fibLevel?: number;
}

export interface AlertConditionSpec {
  indicatorId: string;
  outputKey: string;
  operator: "crossAbove" | "crossBelow" | "gt" | "lt" | "eq" | "enters" | "exits" | "signal" | "touch" | "breakAbove" | "breakBelow" | "enterZone" | "exitZone";
  targetValue?: number;
  targetIndicatorId?: string;
  targetOutputKey?: string;
  logicOp: "AND" | "OR";
  groupId?: number;
  drawingId?: string;
  drawingEvent?: "touch" | "breakAbove" | "breakBelow" | "enterZone" | "exitZone" | "fibLevel";
  drawingGeometry?: DrawingAlertGeometry;
}

export type Alert = typeof alertsTable.$inferSelect;
export type InsertAlert = typeof alertsTable.$inferInsert;
