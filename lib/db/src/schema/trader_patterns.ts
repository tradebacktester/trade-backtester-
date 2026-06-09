import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const traderPatternsTable = pgTable(
  "trader_patterns",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    patternType: text("pattern_type").notNull().default("ghost_cache"),
    patternData: jsonb("pattern_data").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trader_patterns_user_type_idx").on(t.userId, t.patternType),
  ],
);

export type TraderPattern = typeof traderPatternsTable.$inferSelect;
