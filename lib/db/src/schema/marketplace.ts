import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const marketplaceListingsTable = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  strategyType: text("strategy_type").notNull(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  parameters: jsonb("parameters").notNull().$type<Record<string, unknown>>(),
  avgSharpe: numeric("avg_sharpe", { precision: 12, scale: 6 }),
  avgReturn: numeric("avg_return", { precision: 12, scale: 6 }),
  avgWinRate: numeric("avg_win_rate", { precision: 12, scale: 6 }),
  avgMaxDrawdown: numeric("avg_max_drawdown", { precision: 12, scale: 6 }),
  totalBacktests: integer("total_backtests").notNull().default(0),
  votes: integer("votes").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketplaceVotesTable = pgTable("marketplace_votes", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("marketplace_votes_user_listing_idx").on(t.userId, t.listingId),
]);

export type MarketplaceListing = typeof marketplaceListingsTable.$inferSelect;
export type MarketplaceVote = typeof marketplaceVotesTable.$inferSelect;
