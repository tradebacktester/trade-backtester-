import { pgTable, serial, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const twinProfileTable = pgTable(
  "twin_profile",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
    profileData: jsonb("profile_data").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("twin_profile_user_idx").on(t.userId),
  ],
);

export type TwinProfile = typeof twinProfileTable.$inferSelect;
