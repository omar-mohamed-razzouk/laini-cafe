import { Router } from "express";
import {
  db,
  ordersTable,
  orderItemsTable,
  sessionsTable,
  invoicesTable,
  cancellationsTable,
  bookingsTable,
  expensesTable,
  customersTable,
  inventoryTable,
  tablesTable,
  roomsTable,
} from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

type ResetScopes = {
  ordersSessions?: boolean;
  bookings?: boolean;
  invoices?: boolean;
  expenses?: boolean;
  customers?: boolean;
  inventory?: boolean;
};

router.post("/admin/reset-data", requirePerm("data.reset"), async (req, res) => {
  const { confirm, scopes } = (req.body ?? {}) as { confirm?: unknown; scopes?: ResetScopes };

  if (confirm !== "RESET") {
    return res.status(400).json({ error: 'يجب كتابة "RESET" للتأكيد' });
  }
  if (!scopes || typeof scopes !== "object") {
    return res.status(400).json({ error: "لم يتم تحديد البيانات المراد تصفيرها" });
  }

  const selected = [
    scopes.ordersSessions,
    scopes.bookings,
    scopes.invoices,
    scopes.expenses,
    scopes.customers,
    scopes.inventory,
  ].some(Boolean);
  if (!selected) {
    return res.status(400).json({ error: "اختر نوعاً واحداً على الأقل من البيانات" });
  }

  const deleted: Record<string, number> = {};

  await db.transaction(async (tx) => {
    if (scopes.ordersSessions) {
      const oi = await tx.delete(orderItemsTable).returning({ id: orderItemsTable.id });
      const o = await tx.delete(ordersTable).returning({ id: ordersTable.id });
      const s = await tx.delete(sessionsTable).returning({ id: sessionsTable.id });
      const c = await tx.delete(cancellationsTable).returning({ id: cancellationsTable.id });
      deleted.orderItems = oi.length;
      deleted.orders = o.length;
      deleted.sessions = s.length;
      deleted.cancellations = c.length;
      // free up all tables/rooms that may have been left occupied/reserved
      await tx.update(tablesTable).set({ status: "available" }).where(ne(tablesTable.status, "available"));
      await tx.update(roomsTable).set({ status: "available" }).where(ne(roomsTable.status, "available"));
    }

    if (scopes.bookings) {
      const b = await tx.delete(bookingsTable).returning({ id: bookingsTable.id });
      deleted.bookings = b.length;
    }

    if (scopes.invoices) {
      const inv = await tx.delete(invoicesTable).returning({ id: invoicesTable.id });
      deleted.invoices = inv.length;
    }

    if (scopes.expenses) {
      const e = await tx.delete(expensesTable).returning({ id: expensesTable.id });
      deleted.expenses = e.length;
    }

    if (scopes.customers) {
      const cu = await tx.delete(customersTable).returning({ id: customersTable.id });
      deleted.customers = cu.length;
    }

    if (scopes.inventory) {
      const items = await tx
        .update(inventoryTable)
        .set({ currentQuantity: 0 })
        .where(ne(inventoryTable.currentQuantity, 0))
        .returning({ id: inventoryTable.id });
      deleted.inventoryReset = items.length;
    }
  });

  req.log.warn({ staffId: req.staff?.id, scopes, deleted }, "operational data reset");
  return res.json({ message: "تم تصفير البيانات المحددة بنجاح", deleted });
});

export default router;
