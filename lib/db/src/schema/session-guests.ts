import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per person sitting in a per-person billed session.
// Each guest is billed for their own time window (joinedAt -> leftAt|session end).
export const sessionGuestsTable = pgTable("session_guests", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  name: text("name"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionGuestSchema = createInsertSchema(sessionGuestsTable).omit({ id: true, createdAt: true });
export type InsertSessionGuest = z.infer<typeof insertSessionGuestSchema>;
export type SessionGuest = typeof sessionGuestsTable.$inferSelect;
