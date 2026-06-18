import { pgTable, text, serial, integer, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const academyCoursesTable = pgTable("academy_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  pathId: text("path_id").notNull(),
  thumbnailEmoji: text("thumbnail_emoji").notNull().default("📚"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(30),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("academy_courses_path_id_idx").on(t.pathId),
  index("academy_courses_published_idx").on(t.published),
]);

export const academyLessonsTable = pgTable("academy_lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => academyCoursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("article"),
  content: text("content").notNull().default(""),
  videoUrl: text("video_url"),
  imageUrls: jsonb("image_urls").$type<string[]>().default([]),
  estimatedMinutes: integer("estimated_minutes").notNull().default(10),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("academy_lessons_course_id_idx").on(t.courseId),
  index("academy_lessons_published_idx").on(t.published),
]);

export const academyUserProgressTable = pgTable("academy_user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull().references(() => academyLessonsTable.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  timeSpentMinutes: integer("time_spent_minutes").notNull().default(0),
}, (t) => [
  uniqueIndex("academy_progress_user_lesson_idx").on(t.userId, t.lessonId),
  index("academy_progress_user_id_idx").on(t.userId),
]);

export const academyQuizQuestionsTable = pgTable("academy_quiz_questions", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => academyCoursesTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  type: text("type").notNull().default("mcq"),
  options: jsonb("options").$type<string[]>().notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  index("academy_quiz_q_course_id_idx").on(t.courseId),
]);

export const academyQuizAttemptsTable = pgTable("academy_quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => academyCoursesTable.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  answers: jsonb("answers").$type<number[]>().notNull(),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("academy_quiz_attempts_user_id_idx").on(t.userId),
  index("academy_quiz_attempts_course_id_idx").on(t.courseId),
]);

export const academyNotesTable = pgTable("academy_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  isShared: boolean("is_shared").notNull().default(false),
  lessonId: integer("lesson_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("academy_notes_user_id_idx").on(t.userId),
]);

export const academyCertificatesTable = pgTable("academy_certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  pathId: text("path_id").notNull(),
  score: integer("score").notNull(),
  verificationCode: text("verification_code").notNull().default(""),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("academy_certs_user_id_idx").on(t.userId),
  index("academy_certs_path_id_idx").on(t.pathId),
]);

export const academyXpTable = pgTable("academy_xp", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  badges: jsonb("badges").$type<string[]>().notNull().default([]),
  streakDays: integer("streak_days").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  totalStudyMinutes: integer("total_study_minutes").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
