import { Router } from "express";
import { db } from "@workspace/db";
import { tablesTable, roomsTable, sessionsTable, ordersTable, invoicesTable, expensesTable, bookingsTable } from "@workspace/db";
import { eq, gte, lt, and } from "drizzle-orm";
import { hasPerm } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard/stats", async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const canViewReports = hasPerm(req, "reports.view");

  const [tables, rooms, activeSessions, pendingOrders, upcomingBookings] = await Promise.all([
    db.select().from(tablesTable),
    db.select().from(roomsTable),
    db.select().from(sessionsTable).where(eq(sessionsTable.status, "active")),
    db.select().from(ordersTable).where(eq(ordersTable.status, "pending")),
    db.select().from(bookingsTable).where(
      and(gte(bookingsTable.startTime, today), eq(bookingsTable.status, "confirmed"))
    ),
  ]);

  const totalGuestsNow = activeSessions.reduce((s, sess) => s + (sess.guestCount ?? 1), 0);

  const base = {
    activeSessionsCount: activeSessions.length,
    availableTablesCount: tables.filter(t => t.status === "available").length,
    occupiedTablesCount: tables.filter(t => t.status === "occupied").length,
    reservedTablesCount: tables.filter(t => t.status === "reserved").length,
    availableRoomsCount: rooms.filter(r => r.status === "available").length,
    occupiedRoomsCount: rooms.filter(r => r.status === "occupied").length,
    pendingOrdersCount: pendingOrders.length,
    totalGuestsNow,
    upcomingBookingsCount: upcomingBookings.length,
  };

  if (!canViewReports) {
    return res.json({ ...base, todayRevenue: 0, todayExpenses: 0, todayNetProfit: 0 });
  }

  const [todayInvoices, todayExpensesRows] = await Promise.all([
    db.select().from(invoicesTable).where(
      and(gte(invoicesTable.createdAt, today), lt(invoicesTable.createdAt, tomorrow), eq(invoicesTable.status, "paid"))
    ),
    db.select().from(expensesTable).where(
      and(gte(expensesTable.date, today.toISOString().split("T")[0]), lt(expensesTable.date, tomorrow.toISOString().split("T")[0]))
    ),
  ]);

  const todayRevenue = todayInvoices.reduce((s, i) => s + i.total, 0);
  const todayExp = todayExpensesRows.reduce((s, e) => s + e.amount, 0);

  return res.json({
    ...base,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    todayExpenses: Math.round(todayExp * 100) / 100,
    todayNetProfit: Math.round((todayRevenue - todayExp) * 100) / 100,
  });
});

export default router;
