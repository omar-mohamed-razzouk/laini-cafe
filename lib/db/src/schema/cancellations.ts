import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";

export const cancellationsTable = pgTable("cancellations", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),                 // "order" | "session"
  action: text("action").notNull().default("cancelled"), // "cancelled" | "deleted"
  resourceType: text("resource_type"),          // session: table/room/football/work; order: null
  refId: integer("ref_id"),                     // order id or session id
  label: text("label").notNull(),               // human-readable description
  amount: real("amount").notNull().default(0),  // monetary value cancelled/forgone
  reason: text("reason"),
  staffId: integer("staff_id"),
  staffName: text("staff_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
