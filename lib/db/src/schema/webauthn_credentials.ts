import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const webauthnCredentialsTable = pgTable("webauthn_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("webauthn_user_id_idx").on(t.userId),
]);

export type WebauthnCredential = typeof webauthnCredentialsTable.$inferSelect;
export type InsertWebauthnCredential = typeof webauthnCredentialsTable.$inferInsert;
