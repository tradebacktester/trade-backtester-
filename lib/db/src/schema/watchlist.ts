import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";

export const watchlistItemsTable = pgTable("watchlist_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: varchar("symbol", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }),
  ticker: varchar("ticker", { length: 50 }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});
