import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const securityQuestionsTable = pgTable("security_questions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  question1: text("question1").notNull(),
  answerHash1: text("answer_hash1").notNull(),
  question2: text("question2").notNull(),
  answerHash2: text("answer_hash2").notNull(),
  question3: text("question3").notNull(),
  answerHash3: text("answer_hash3").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
