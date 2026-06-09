import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const coachCacheTable = pgTable(
  "coach_cache",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    date: text("date", ).notNull(),
    briefingData: jsonb("briefing_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("coach_cache_user_date_idx").on(t.userId, t.date),
  ],
);

export type CoachCache = typeof coachCacheTable.$inferSelect;
