import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";


export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  likes: integer("likes").notNull().default(0),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedByAdmin: boolean("deleted_by_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("community_posts_user_id_idx").on(t.userId),
]);

export const communityReportsTable = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  reporterName: text("reporter_name").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("community_reports_post_id_idx").on(t.postId),
]);

export const communityMessagesTable = pgTable("community_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("community_messages_created_at_idx").on(t.createdAt),
  index("community_messages_user_id_idx").on(t.userId),
]);

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fromName: text("from_name").notNull(),
  toUserId: integer("to_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  toName: text("to_name").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("dm_from_user_idx").on(t.fromUserId),
  index("dm_to_user_idx").on(t.toUserId),
  index("dm_created_at_idx").on(t.createdAt),
]);

export type CommunityPost = typeof communityPostsTable.$inferSelect;
export type CommunityReport = typeof communityReportsTable.$inferSelect;
export type CommunityMessage = typeof communityMessagesTable.$inferSelect;
export type DirectMessage = typeof directMessagesTable.$inferSelect;
