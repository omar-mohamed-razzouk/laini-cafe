import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  resourceId: integer("resource_id").notNull(),
  resourceName: text("resource_name").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  guestCount: integer("guest_count").notNull().default(1),
  totalAmount: real("total_amount").notNull().default(0),
  includesDrinks: boolean("includes_drinks").default(false),
  needsProjector: boolean("needs_projector").default(false),
  needsMicrophone: boolean("needs_microphone").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
