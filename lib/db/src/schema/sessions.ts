import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  resourceId: integer("resource_id").notNull(),
  resourceName: text("resource_name").notNull(),
  bookingId: integer("booking_id"),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  guestCount: integer("guest_count"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  plannedEndTime: timestamp("planned_end_time", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  currentCost: real("current_cost").notNull().default(0),
  billingMode: text("billing_mode").notNull().default("flat"),
  perPersonRate: real("per_person_rate"),
  timeStoppedAt: timestamp("time_stopped_at", { withTimezone: true }),
  staffId: integer("staff_id").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
