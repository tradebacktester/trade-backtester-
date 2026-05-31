import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  likes: integer("likes").notNull().default(0),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedByAdmin: boolean("deleted_by_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityReportsTable = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  reporterName: text("reporter_name").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CommunityPost = typeof communityPostsTable.$inferSelect;
export type CommunityReport = typeof communityReportsTable.$inferSelect;
