import { pgTable, serial, integer, text, numeric, index } from "drizzle-orm/pg-core";
import { alertsTable } from "./alerts";

export const alertConditionsTable = pgTable("alert_conditions", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => alertsTable.id, { onDelete: "cascade" }),
  conditionType: text("condition_type").notNull().default("indicator"),
  indicatorId: text("indicator_id").notNull(),
  outputKey: text("output_key").notNull().default("value"),
  operator: text("operator").notNull(),
  value: numeric("value", { precision: 24, scale: 8 }),
  targetIndicatorId: text("target_indicator_id"),
  targetOutputKey: text("target_output_key"),
  logicOp: text("logic_op").notNull().default("AND"),
  groupId: integer("group_id").notNull().default(0),
}, (t) => [
  index("alert_conditions_alert_id_idx").on(t.alertId),
]);

export type AlertCondition = typeof alertConditionsTable.$inferSelect;
export type InsertAlertCondition = typeof alertConditionsTable.$inferInsert;
