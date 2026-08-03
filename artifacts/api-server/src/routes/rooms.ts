import { validateBody } from "../middleware/validate.js";
import { CreateRoomBody, UpdateRoomBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

router.get("/rooms", async (_req, res) => {
  const rooms = await db.select().from(roomsTable).orderBy(roomsTable.id);
  return res.json(rooms);
});

router.post("/rooms", requirePerm("rooms.manage"), validateBody(CreateRoomBody), async (req, res) => {
  const { name, capacity, type, hourlyRate, hasProjector, hasMicrophone, hasWhiteboard } = req.body;
  if (!name || !capacity || !type) {
    return res.status(400).json({ error: "name, capacity, type required" });
  }
  const [created] = await db.insert(roomsTable).values({
    name, capacity, type,
    hourlyRate: hourlyRate ?? 0,
    hasProjector: hasProjector ?? false,
    hasMicrophone: hasMicrophone ?? false,
    hasWhiteboard: hasWhiteboard ?? false,
    status: "available",
  }).returning();
  return res.status(201).json(created);
});

router.get("/rooms/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [r] = await db.select().from(roomsTable).where(eq(roomsTable.id, id)).limit(1);
  if (!r) return res.status(404).json({ error: "Not found" });
  return res.json(r);
});

router.patch("/rooms/:id", requirePerm("rooms.manage"), validateBody(UpdateRoomBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "capacity", "type", "status", "hourlyRate", "hasProjector", "hasMicrophone", "hasWhiteboard"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  const [updated] = await db.update(roomsTable).set(updates).where(eq(roomsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

router.delete("/rooms/:id", requirePerm("rooms.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(roomsTable).where(eq(roomsTable.id, id));
  return res.status(204).send();
});

export default router;
