import { validateBody } from "../middleware/validate.js";
import { CreateTableBody, UpdateTableBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { tablesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

router.get("/tables", async (_req, res) => {
  const tables = await db.select().from(tablesTable).orderBy(tablesTable.number);
  return res.json(tables);
});

router.post("/tables", requirePerm("tables.manage"), validateBody(CreateTableBody), async (req, res) => {
  const { number, capacity, type, posX, posY, minOrderAmount, hourlyRate } = req.body;
  if (!number || !capacity || !type) {
    return res.status(400).json({ error: "number, capacity, type required" });
  }
  const [created] = await db.insert(tablesTable).values({
    number,
    capacity,
    type,
    hourlyRate: hourlyRate ?? 0,
    posX: posX ?? 0,
    posY: posY ?? 0,
    minOrderAmount: minOrderAmount ?? null,
    status: "available",
  }).returning();
  return res.status(201).json(created);
});

router.get("/tables/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [t] = await db.select().from(tablesTable).where(eq(tablesTable.id, id)).limit(1);
  if (!t) return res.status(404).json({ error: "Not found" });
  return res.json(t);
});

router.patch("/tables/:id", requirePerm("tables.manage"), validateBody(UpdateTableBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  const fields = ["number", "capacity", "status", "type", "posX", "posY", "minOrderAmount", "hourlyRate"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  const [updated] = await db.update(tablesTable).set(updates).where(eq(tablesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

router.delete("/tables/:id", requirePerm("tables.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(tablesTable).where(eq(tablesTable.id, id));
  return res.status(204).send();
});

export default router;
