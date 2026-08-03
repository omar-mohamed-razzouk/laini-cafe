import { validateBody } from "../middleware/validate.js";
import { CreateInventoryItemBody, UpdateInventoryItemBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

function formatItem(item: typeof inventoryTable.$inferSelect) {
  return {
    ...item,
    isLow: item.currentQuantity <= item.minQuantity,
    lastRestocked: item.lastRestocked?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}

router.get("/inventory", requirePerm("inventory.view"), async (_req, res) => {
  const items = await db.select().from(inventoryTable).orderBy(inventoryTable.name);
  return res.json(items.map(formatItem));
});

router.post("/inventory", requirePerm("inventory.manage"), validateBody(CreateInventoryItemBody), async (req, res) => {
  const { name, unit, currentQuantity, minQuantity, costPerUnit } = req.body;
  if (!name || !unit || currentQuantity == null || minQuantity == null || costPerUnit == null) {
    return res.status(400).json({ error: "All fields required" });
  }
  const [created] = await db.insert(inventoryTable).values({ name, unit, currentQuantity, minQuantity, costPerUnit }).returning();
  return res.status(201).json(formatItem(created));
});

router.patch("/inventory/:id", requirePerm("inventory.manage"), validateBody(UpdateInventoryItemBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  for (const f of ["name", "unit", "currentQuantity", "minQuantity", "costPerUnit"]) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.currentQuantity !== undefined) updates.lastRestocked = new Date();

  const [updated] = await db.update(inventoryTable).set(updates).where(eq(inventoryTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(formatItem(updated));
});

router.delete("/inventory/:id", requirePerm("inventory.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
  return res.status(204).send();
});

export default router;
