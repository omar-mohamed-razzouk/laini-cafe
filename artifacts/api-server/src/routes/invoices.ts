import { validateBody } from "../middleware/validate.js";
import { CreateInvoiceBody, UpdateInvoiceBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, staffTable } from "@workspace/db";
import { eq, and, gte, lt } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

function formatInvoice(inv: typeof invoicesTable.$inferSelect) {
  return {
    ...inv,
    createdAt: inv.createdAt.toISOString(),
  };
}

router.get("/invoices", requirePerm("cashier.view"), async (req, res) => {
  const { date } = req.query as { date?: string };
  let query = db.select().from(invoicesTable).$dynamic();

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    query = query.where(and(gte(invoicesTable.createdAt, start), lt(invoicesTable.createdAt, end)));
  }

  const invoices = await query.orderBy(invoicesTable.createdAt);
  return res.json(invoices.map(inv => ({
    ...formatInvoice(inv),
    staffName: null,
  })));
});

router.post("/invoices", requirePerm("cashier.view"), validateBody(CreateInvoiceBody), async (req, res) => {
  const { sessionId, customerName, discountPercent, amountPaid, paymentMethod, staffId, notes, items } = req.body;

  const subtotal = (items ?? []).reduce((s: number, i: { subtotal: number }) => s + (i.subtotal ?? 0), 0);
  const disc = discountPercent ?? 0;
  const discountAmount = subtotal * disc / 100;
  const tax = 0;
  const total = subtotal - discountAmount + tax;
  const change = amountPaid != null ? amountPaid - total : null;

  const [created] = await db.insert(invoicesTable).values({
    sessionId: sessionId ?? null,
    customerName,
    subtotal, discountAmount, discountPercent: disc,
    tax, total,
    amountPaid: amountPaid ?? null,
    change,
    paymentMethod: paymentMethod ?? "cash",
    status: "open",
    staffId: staffId ?? null,
    notes,
    items: items ?? [],
  }).returning();

  return res.status(201).json({ ...formatInvoice(created), staffName: null });
});

router.get("/invoices/:id", requirePerm("cashier.view"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  if (!inv) return res.status(404).json({ error: "Not found" });

  let staffName: string | null = null;
  if (inv.staffId) {
    const [s] = await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, inv.staffId)).limit(1);
    staffName = s?.name ?? null;
  }

  return res.json({ ...formatInvoice(inv), staffName });
});

router.patch("/invoices/:id", requirePerm("cashier.view"), validateBody(UpdateInvoiceBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.paymentMethod !== undefined) updates.paymentMethod = req.body.paymentMethod;
  if (req.body.notes !== undefined) updates.notes = req.body.notes;
  if (req.body.discountPercent !== undefined) {
    updates.discountPercent = req.body.discountPercent;
  }
  if (req.body.amountPaid !== undefined) updates.amountPaid = req.body.amountPaid;

  const [updated] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json({ ...formatInvoice(updated), staffName: null });
});

export default router;
