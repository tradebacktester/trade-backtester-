import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const policiesTable = pgTable("policies", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Policy = typeof policiesTable.$inferSelect;
