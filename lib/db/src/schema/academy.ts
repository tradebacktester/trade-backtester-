import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const academyCoursesTable = pgTable("academy_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(), // beginner | intermediate | advanced | professional
  pathId: text("path_id").notNull(),        // beginner | intermediate | advanced | professional
  thumbnailEmoji: text("thumbnail_emoji").notNull().default("📚"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(30),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyLessonsTable = pgTable("academy_lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("article"), // article | video
  content: text("content").notNull().default(""),
  videoUrl: text("video_url"),
  imageUrls: jsonb("image_urls").$type<string[]>().default([]),
  estimatedMinutes: integer("estimated_minutes").notNull().default(10),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyUserProgressTable = pgTable("academy_user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  timeSpentMinutes: integer("time_spent_minutes").notNull().default(0),
});

export const academyQuizQuestionsTable = pgTable("academy_quiz_questions", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  question: text("question").notNull(),
  type: text("type").notNull().default("mcq"), // mcq | true_false
  options: jsonb("options").$type<string[]>().notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const academyQuizAttemptsTable = pgTable("academy_quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  answers: jsonb("answers").$type<number[]>().notNull(),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyNotesTable = pgTable("academy_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  isShared: boolean("is_shared").notNull().default(false),
  lessonId: integer("lesson_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyCertificatesTable = pgTable("academy_certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  pathId: text("path_id").notNull(),
  score: integer("score").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academyXpTable = pgTable("academy_xp", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  badges: jsonb("badges").$type<string[]>().notNull().default([]),
  streakDays: integer("streak_days").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  totalStudyMinutes: integer("total_study_minutes").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
