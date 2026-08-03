import { validateBody } from "../middleware/validate.js";
import { CreateBookingBody, UpdateBookingBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable } from "@workspace/db";
import { eq, and, gte, lt, sql } from "drizzle-orm";

const router = Router();

router.get("/bookings", async (req, res) => {
  const { date, status } = req.query as { date?: string; status?: string };
  let query = db.select().from(bookingsTable).$dynamic();

  const conditions = [];
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    conditions.push(gte(bookingsTable.startTime, start));
    conditions.push(lt(bookingsTable.startTime, end));
  }
  if (status) conditions.push(eq(bookingsTable.status, status));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const bookings = await query.orderBy(bookingsTable.startTime);
  return res.json(bookings.map(b => ({
    ...b,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    createdAt: b.createdAt.toISOString(),
  })));
});

router.post("/bookings", validateBody(CreateBookingBody), async (req, res) => {
  const { type, resourceId, customerName, customerPhone, startTime, endTime, guestCount, includesDrinks, needsProjector, needsMicrophone, notes } = req.body;
  if (!type || !resourceId || !customerName || !startTime || !endTime || !guestCount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // get resource name
  let resourceName = `Resource ${resourceId}`;
  try {
    if (type === "table") {
      const { tablesTable } = await import("@workspace/db");
      const [t] = await db.select().from(tablesTable).where(eq(tablesTable.id, resourceId)).limit(1);
      if (t) resourceName = `Table ${t.number}`;
    } else if (type === "room" || type === "football") {
      const { roomsTable } = await import("@workspace/db");
      const [r] = await db.select().from(roomsTable).where(eq(roomsTable.id, resourceId)).limit(1);
      if (r) resourceName = r.name;
    }
  } catch {  }

  const [created] = await db.insert(bookingsTable).values({
    type, resourceId, resourceName,
    customerName, customerPhone,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    guestCount,
    totalAmount: 0,
    status: "pending",
    includesDrinks: includesDrinks ?? false,
    needsProjector: needsProjector ?? false,
    needsMicrophone: needsMicrophone ?? false,
    notes,
  }).returning();

  return res.status(201).json({
    ...created,
    startTime: created.startTime.toISOString(),
    endTime: created.endTime.toISOString(),
    createdAt: created.createdAt.toISOString(),
  });
});

router.get("/bookings/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [b] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!b) return res.status(404).json({ error: "Not found" });
  return res.json({
    ...b,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    createdAt: b.createdAt.toISOString(),
  });
});

router.patch("/bookings/:id", validateBody(UpdateBookingBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  for (const f of ["status", "guestCount", "includesDrinks", "needsProjector", "needsMicrophone", "notes"]) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.startTime) updates.startTime = new Date(req.body.startTime);
  if (req.body.endTime) updates.endTime = new Date(req.body.endTime);

  const [updated] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json({
    ...updated,
    startTime: updated.startTime.toISOString(),
    endTime: updated.endTime.toISOString(),
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/bookings/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(bookingsTable).where(eq(bookingsTable.id, id));
  return res.status(204).send();
});

export default router;
