import { pgTable, serial, integer, varchar, index } from "drizzle-orm/pg-core";

export const aiUsageTable = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [index("ai_usage_user_date_idx").on(t.userId, t.date)],
);
