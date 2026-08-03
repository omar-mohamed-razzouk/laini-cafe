import { validateBody } from "../middleware/validate.js";
import { CreateOrderBody, UpdateOrderBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, menuItemsTable, staffTable, cancellationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function summarizeItems(items: Array<{ menuItemName: string; quantity: number }>): string {
  if (items.length === 0) return "طلب فارغ";
  return items.map(i => `${i.quantity}× ${i.menuItemName}`).join("، ");
}

async function getOrderWithItems(orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return null;

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const [staff] = order.staffId
    ? await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, order.staffId)).limit(1)
    : [null];

  return {
    ...order,
    staffName: staff?.name ?? null,
    createdAt: order.createdAt.toISOString(),
    items,
  };
}

router.get("/orders", async (req, res) => {
  const { sessionId, status } = req.query as { sessionId?: string; status?: string };
  let query = db.select().from(ordersTable).$dynamic();

  const conditions = [];
  if (sessionId) conditions.push(eq(ordersTable.sessionId, parseInt(sessionId)));
  if (status) conditions.push(eq(ordersTable.status, status));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const orders = await query.orderBy(ordersTable.createdAt);

  const result = await Promise.all(orders.map(async order => {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    const [staff] = order.staffId
      ? await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, order.staffId)).limit(1)
      : [null];
    return {
      ...order,
      staffName: staff?.name ?? null,
      createdAt: order.createdAt.toISOString(),
      items,
    };
  }));

  return res.json(result);
});

router.post("/orders", validateBody(CreateOrderBody), async (req, res) => {
  const { sessionId, staffId, notes, items } = req.body;
  if (!sessionId || !items?.length) {
    return res.status(400).json({ error: "sessionId and items required" });
  }

  let totalAmount = 0;
  const resolvedItems: Array<{ menuItemId: number; menuItemName: string; quantity: number; unitPrice: number; subtotal: number; notes?: string }> = [];

  for (const item of items) {
    const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, item.menuItemId)).limit(1);
    if (!menuItem) return res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
    const unitPrice = menuItem.price * (1 - (menuItem.discountPercent ?? 0) / 100);
    const subtotal = unitPrice * item.quantity;
    totalAmount += subtotal;
    resolvedItems.push({
      menuItemId: item.menuItemId,
      menuItemName: menuItem.name,
      quantity: item.quantity,
      unitPrice,
      subtotal,
      notes: item.notes,
    });
  }

  const [order] = await db.insert(ordersTable).values({
    sessionId, staffId, notes,
    status: "pending",
    totalAmount,
  }).returning();

  await db.insert(orderItemsTable).values(resolvedItems.map(i => ({ ...i, orderId: order.id })));

  // Session cost is computed on-demand (time + non-cancelled orders) in the sessions
  // routes, so there is no stored running total to update here.

  const full = await getOrderWithItems(order.id);
  return res.status(201).json(full);
});

router.get("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const full = await getOrderWithItems(id);
  if (!full) return res.status(404).json({ error: "Not found" });
  return res.json(full);
});

router.patch("/orders/:id", validateBody(UpdateOrderBody), async (req, res) => {
  const id = parseInt(req.params.id as string);

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.notes !== undefined) updates.notes = req.body.notes;

  // Log the cancellation for the manager-only report when transitioning into
  // "cancelled" (avoid double-logging if it was already cancelled).
  if (req.body.status === "cancelled" && existing.status !== "cancelled") {
    await logOrderCancellation(existing.id, "cancelled", req.body?.reason ?? null, req.staff?.id ?? null);
  }

  const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });

  const full = await getOrderWithItems(updated.id);
  return res.json(full);
});

// Delete (remove) an order entirely — e.g. created by mistake. The order value is
// logged for the manager-only cancellations report before the rows are removed.
router.delete("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });

  // Only log if it wasn't already logged as cancelled (avoid double counting).
  if (order.status !== "cancelled") {
    await logOrderCancellation(id, "deleted", req.body?.reason ?? null, req.staff?.id ?? null);
  }

  // order_items are removed via onDelete: cascade.
  await db.delete(ordersTable).where(eq(ordersTable.id, id));
  return res.json({ ok: true });
});

// Cancel a single line item within an order (e.g. one drink the customer no
// longer wants), recompute the order total, and log it for the manager report.
// If the order has no items left afterward, the order itself is removed.
router.delete("/orders/:orderId/items/:itemId", async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const itemId = parseInt(req.params.itemId);

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status === "cancelled") return res.status(400).json({ error: "الطلب ملغى مسبقاً" });

  const [item] = await db.select().from(orderItemsTable)
    .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId))).limit(1);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const [staff] = req.staff?.id
    ? await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, req.staff.id)).limit(1)
    : [null];

  await db.insert(cancellationsTable).values({
    kind: "order_item",
    action: "cancelled",
    resourceType: null,
    refId: orderId,
    label: `طلب #${orderId}: ${item.quantity}× ${item.menuItemName}`,
    amount: item.subtotal,
    reason: req.body?.reason ?? null,
    staffId: req.staff?.id ?? null,
    staffName: staff?.name ?? null,
  });

  await db.delete(orderItemsTable).where(eq(orderItemsTable.id, itemId));

  const remaining = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  if (remaining.length === 0) {
    // No items left — remove the now-empty order. The item was already logged.
    await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
    return res.json({ ok: true, orderDeleted: true });
  }

  const newTotal = remaining.reduce((s, it) => s + it.subtotal, 0);
  await db.update(ordersTable).set({ totalAmount: newTotal }).where(eq(ordersTable.id, orderId));

  const full = await getOrderWithItems(orderId);
  return res.json({ ok: true, orderDeleted: false, order: full });
});

async function logOrderCancellation(orderId: number, action: "cancelled" | "deleted", reason: string | null, staffId: number | null) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const amount = items.reduce((s, it) => s + it.subtotal, 0);
  const [staff] = staffId
    ? await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, staffId)).limit(1)
    : [null];
  await db.insert(cancellationsTable).values({
    kind: "order",
    action,
    resourceType: null,
    refId: orderId,
    label: `طلب #${orderId}: ${summarizeItems(items)}`,
    amount,
    reason,
    staffId,
    staffName: staff?.name ?? null,
  });
}

export default router;
