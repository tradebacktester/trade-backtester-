import { pgTable, serial, integer, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const watchlistItemsTable = pgTable("watchlist_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  symbol: varchar("symbol", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }),
  ticker: varchar("ticker", { length: 50 }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => [
  index("watchlist_user_id_idx").on(t.userId),
  index("watchlist_symbol_idx").on(t.symbol),
]);
