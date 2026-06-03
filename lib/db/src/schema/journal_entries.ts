import { pgTable, text, serial, timestamp, integer, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { backtestsTable } from "./backtests";
import { usersTable } from "./users";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id").notNull().references(() => backtestsTable.id, { onDelete: "cascade" }),
  tradeId: integer("trade_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  note: text("note").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  session: text("session").notNull().default(""),
  emotionPre: text("emotion_pre").notNull().default(""),
  emotionPost: text("emotion_post").notNull().default(""),
  confidence: integer("confidence").notNull().default(0),
  mistakes: jsonb("mistakes").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("journal_entries_bt_trade_user_uniq").on(t.backtestId, t.tradeId, t.userId),
  index("journal_entries_backtest_id_idx").on(t.backtestId),
  index("journal_entries_user_id_idx").on(t.userId),
]);

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
