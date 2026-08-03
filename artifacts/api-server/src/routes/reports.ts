import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, expensesTable, ordersTable, staffTable, orderItemsTable, cancellationsTable, sessionsTable } from "@workspace/db";
import { gte, lt, eq, and, sql } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

function getPeriodRange(period: string, dateStr?: string): { start: Date; end: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();
  base.setHours(0, 0, 0, 0);

  if (period === "daily") {
    const end = new Date(base);
    end.setDate(end.getDate() + 1);
    return { start: base, end };
  } else if (period === "weekly") {
    const start = new Date(base);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  } else if (period === "monthly") {
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    return { start, end };
  } else {
    // yearly
    const start = new Date(base.getFullYear(), 0, 1);
    const end = new Date(base.getFullYear() + 1, 0, 1);
    return { start, end };
  }
}

router.get("/reports/summary", requirePerm("reports.view"), async (req, res) => {
  const { period = "daily", date } = req.query as { period?: string; date?: string };
  const { start, end } = getPeriodRange(period, date);

  const invoices = await db.select().from(invoicesTable)
    .where(and(gte(invoicesTable.createdAt, start), lt(invoicesTable.createdAt, end), eq(invoicesTable.status, "paid")));

  const expenses = await db.select().from(expensesTable)
    .where(and(gte(expensesTable.date, start.toISOString().split("T")[0]), lt(expensesTable.date, end.toISOString().split("T")[0])));

  const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // build revenue by day
  const dayMap = new Map<string, { revenue: number; expenses: number }>();
  for (const inv of invoices) {
    const day = inv.createdAt.toISOString().split("T")[0];
    const existing = dayMap.get(day) ?? { revenue: 0, expenses: 0 };
    dayMap.set(day, { ...existing, revenue: existing.revenue + inv.total });
  }
  for (const exp of expenses) {
    const day = exp.date;
    const existing = dayMap.get(day) ?? { revenue: 0, expenses: 0 };
    dayMap.set(day, { ...existing, expenses: existing.expenses + exp.amount });
  }

  const revenueByDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => ({ date: d, ...v }));

  return res.json({
    period,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    invoiceCount: invoices.length,
    guestCount: 0,
    avgOrderValue: invoices.length > 0 ? Math.round(totalRevenue / invoices.length * 100) / 100 : 0,
    revenueByDay,
  });
});

// Full transactions log: every paid invoice in the period with its line items,
// session context, and aggregated breakdowns (time revenue vs product sales, top items).
router.get("/reports/transactions", requirePerm("reports.view"), async (req, res) => {
  const { period = "daily", date } = req.query as { period?: string; date?: string };
  const { start, end } = getPeriodRange(period, date);

  const invoices = await db.select().from(invoicesTable)
    .where(and(gte(invoicesTable.createdAt, start), lt(invoicesTable.createdAt, end), eq(invoicesTable.status, "paid")))
    .orderBy(invoicesTable.createdAt);

  const staffRows = await db.select({ id: staffTable.id, name: staffTable.name }).from(staffTable);
  const staffMap = new Map(staffRows.map((s) => [s.id, s.name]));

  const sessionIds = [...new Set(invoices.map((i) => i.sessionId).filter((x): x is number => x != null))];
  const sessionMap = new Map<number, { resourceName: string; guestCount: number | null; startTime: Date; endTime: Date | null; type: string }>();
  for (const sid of sessionIds) {
    const [s] = await db.select({
      resourceName: sessionsTable.resourceName, guestCount: sessionsTable.guestCount,
      startTime: sessionsTable.startTime, endTime: sessionsTable.endTime, type: sessionsTable.type,
    }).from(sessionsTable).where(eq(sessionsTable.id, sid)).limit(1);
    if (s) sessionMap.set(sid, s);
  }

  type Item = { description: string; quantity: number; unitPrice: number; subtotal: number };
  const isTimeItem = (d: string) => d.startsWith("حجز") || d.startsWith("وقت");
  const isAdjustment = (d: string) => d.startsWith("تعديل السعر");

  let timeRevenue = 0;
  let productRevenue = 0;
  let adjustments = 0;
  let totalDiscounts = 0;
  const itemAgg = new Map<string, { quantity: number; total: number }>();

  const details = invoices.map((inv) => {
    const items = (Array.isArray(inv.items) ? inv.items : []) as Item[];
    for (const it of items) {
      if (isAdjustment(it.description)) { adjustments += it.subtotal; continue; }
      if (isTimeItem(it.description)) { timeRevenue += it.subtotal; continue; }
      productRevenue += it.subtotal;
      const agg = itemAgg.get(it.description) ?? { quantity: 0, total: 0 };
      agg.quantity += it.quantity;
      agg.total += it.subtotal;
      itemAgg.set(it.description, agg);
    }
    totalDiscounts += inv.discountAmount ?? 0;
    const sess = inv.sessionId != null ? sessionMap.get(inv.sessionId) : undefined;
    return {
      id: inv.id,
      createdAt: inv.createdAt.toISOString(),
      sessionId: inv.sessionId,
      resourceName: sess?.resourceName ?? null,
      sessionType: sess?.type ?? null,
      guestCount: sess?.guestCount ?? null,
      sessionStart: sess?.startTime?.toISOString() ?? null,
      sessionEnd: sess?.endTime?.toISOString() ?? null,
      customerName: inv.customerName,
      staffName: (inv.staffId != null ? staffMap.get(inv.staffId) : null) ?? null,
      paymentMethod: inv.paymentMethod,
      subtotal: inv.subtotal,
      discountAmount: inv.discountAmount,
      total: inv.total,
      amountPaid: inv.amountPaid,
      items,
    };
  });

  const topItems = [...itemAgg.entries()]
    .map(([name, v]) => ({ name, quantity: v.quantity, total: v.total }))
    .sort((a, b) => b.total - a.total);

  return res.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    invoiceCount: invoices.length,
    totalRevenue: invoices.reduce((s, i) => s + i.total, 0),
    timeRevenue,
    productRevenue,
    adjustments,
    totalDiscounts,
    topItems,
    details,
  });
});

router.get("/reports/staff-performance", requirePerm("reports.view"), async (_req, res) => {
  const staff = await db.select().from(staffTable).where(eq(staffTable.isActive, true));

  const result = await Promise.all(staff.map(async s => {
    const orders = await db.select({ total: ordersTable.totalAmount })
      .from(ordersTable)
      .where(eq(ordersTable.staffId, s.id));

    return {
      staffId: s.id,
      staffName: s.name,
      totalSales: orders.reduce((sum, o) => sum + (o.total ?? 0), 0),
      orderCount: orders.length,
    };
  }));

  result.sort((a, b) => b.totalSales - a.totalSales);
  return res.json(result);
});

// Cancelled/deleted orders and cancelled tables/rooms — manager (and owner) only.
router.get("/reports/cancellations", async (req, res) => {
  const role = req.staff?.role;
  if (role !== "admin" && role !== "manager") {
    return res.status(403).json({ error: "هذه المعلومات متاحة للمدير فقط" });
  }

  const { period = "daily", date } = req.query as { period?: string; date?: string };
  const { start, end } = getPeriodRange(period, date);

  const rows = await db.select().from(cancellationsTable)
    .where(and(gte(cancellationsTable.createdAt, start), lt(cancellationsTable.createdAt, end)))
    .orderBy(cancellationsTable.createdAt);

  const tableTypes = new Set(["table", "football", "work"]);
  const agg = {
    orders: { count: 0, total: 0 },
    items: { count: 0, total: 0 },
    tables: { count: 0, total: 0 },
    rooms: { count: 0, total: 0 },
    guests: { count: 0, total: 0 },
  };

  for (const r of rows) {
    if (r.kind === "order") {
      agg.orders.count++; agg.orders.total += r.amount;
    } else if (r.kind === "order_item") {
      agg.items.count++; agg.items.total += r.amount;
    } else if (r.kind === "guest") {
      agg.guests.count++; // no monetary value
    } else if (r.kind === "session") {
      if (r.resourceType === "room") { agg.rooms.count++; agg.rooms.total += r.amount; }
      else if (r.resourceType && tableTypes.has(r.resourceType)) { agg.tables.count++; agg.tables.total += r.amount; }
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const grandTotal = round(agg.orders.total + agg.items.total + agg.tables.total + agg.rooms.total);

  return res.json({
    period,
    orders: { count: agg.orders.count, total: round(agg.orders.total) },
    items: { count: agg.items.count, total: round(agg.items.total) },
    tables: { count: agg.tables.count, total: round(agg.tables.total) },
    rooms: { count: agg.rooms.count, total: round(agg.rooms.total) },
    guests: { count: agg.guests.count, total: 0 },
    grandTotal,
    details: rows.map(r => ({
      id: r.id,
      kind: r.kind,
      action: r.action,
      resourceType: r.resourceType,
      label: r.label,
      amount: round(r.amount),
      reason: r.reason,
      staffName: r.staffName,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
