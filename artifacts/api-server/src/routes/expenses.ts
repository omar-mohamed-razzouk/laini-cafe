import { validateBody } from "../middleware/validate.js";
import { CreateExpenseBody, UpdateExpenseBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { expensesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

function formatExpense(e: typeof expensesTable.$inferSelect) {
  return { ...e, createdAt: e.createdAt.toISOString() };
}

router.get("/expenses", requirePerm("expenses.view"), async (_req, res) => {
  const expenses = await db.select().from(expensesTable).orderBy(expensesTable.date);
  return res.json(expenses.map(formatExpense));
});

router.post("/expenses", requirePerm("expenses.manage"), validateBody(CreateExpenseBody), async (req, res) => {
  const { title, amount, category, date, notes } = req.body;
  if (!title || !amount || !category || !date) {
    return res.status(400).json({ error: "title, amount, category, date required" });
  }
  const [created] = await db.insert(expensesTable).values({ title, amount, category, date, notes }).returning();
  return res.status(201).json(formatExpense(created));
});

router.patch("/expenses/:id", requirePerm("expenses.manage"), validateBody(UpdateExpenseBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  for (const f of ["title", "amount", "category", "date", "notes"]) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  const [updated] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(formatExpense(updated));
});

router.delete("/expenses/:id", requirePerm("expenses.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  return res.status(204).send();
});

export default router;
