import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, sessionsTable, invoicesTable } from "@workspace/db";
import { eq, gte, and, desc } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

router.get("/customers", requirePerm("customers.view"), async (_req, res) => {
  const rows = await db.select().from(customersTable).orderBy(desc(customersTable.totalSpent));
  return res.json(rows.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  })));
});

router.post("/customers", requirePerm("customers.manage"), async (req, res) => {
  const { name, nameAr, phone, email, company, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [created] = await db.insert(customersTable).values({ name, nameAr, phone, email, company, notes }).returning();
  return res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() });
});

router.get("/customers/:id", requirePerm("customers.view"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!customer) return res.status(404).json({ error: "Not found" });
  return res.json({ ...customer, createdAt: customer.createdAt.toISOString(), updatedAt: customer.updatedAt.toISOString() });
});

router.patch("/customers/:id", requirePerm("customers.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, nameAr, phone, email, company, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (nameAr !== undefined) updates.nameAr = nameAr;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (company !== undefined) updates.company = company;
  if (notes !== undefined) updates.notes = notes;
  const [updated] = await db.update(customersTable).set(updates).where(eq(customersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
});

router.delete("/customers/:id", requirePerm("customers.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  return res.status(204).send();
});

router.get("/customers/:id/summary", requirePerm("customers.view"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!customer) return res.status(404).json({ error: "Not found" });

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const allInvoices = await db.select().from(invoicesTable)
    .where(eq(invoicesTable.customerId, id))
    .orderBy(desc(invoicesTable.createdAt));

  const sum = (invs: typeof allInvoices) => invs.reduce((acc, inv) => acc + inv.total, 0);
  const since = (invs: typeof allInvoices, date: Date) => invs.filter((inv) => new Date(inv.createdAt) >= date);

  // All sessions for this customer
  const allSessions = await db.select().from(sessionsTable)
    .where(eq(sessionsTable.customerId, id))
    .orderBy(desc(sessionsTable.startTime));

  return res.json({
    customer: { ...customer, createdAt: customer.createdAt.toISOString(), updatedAt: customer.updatedAt.toISOString() },
    payments: {
      today: sum(since(allInvoices, startOfDay)),
      thisWeek: sum(since(allInvoices, startOfWeek)),
      thisMonth: sum(since(allInvoices, startOfMonth)),
      thisYear: sum(since(allInvoices, startOfYear)),
      allTime: sum(allInvoices),
    },
    invoices: allInvoices.map((inv) => ({ ...inv, createdAt: inv.createdAt.toISOString(), updatedAt: inv.updatedAt.toISOString() })),
    sessions: allSessions.map((s) => ({
      ...s,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime?.toISOString() ?? null,
      plannedEndTime: s.plannedEndTime?.toISOString() ?? null,
    })),
    visitCount: allSessions.length,
    bookingCount: allSessions.filter((s) => s.bookingId).length,
  });
});

export default router;
