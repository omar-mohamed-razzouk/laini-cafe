import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const authTokensTable = pgTable("auth_tokens", {
  token: text("token").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export type AuthToken = typeof authTokensTable.$inferSelect;
