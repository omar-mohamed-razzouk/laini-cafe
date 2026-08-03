import { validateBody } from "../middleware/validate.js";
import { CreateSessionBody, UpdateSessionBody, EndSessionBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  sessionsTable, staffTable, tablesTable, roomsTable,
  ordersTable, orderItemsTable, invoicesTable, customersTable, cancellationsTable,
  sessionGuestsTable
} from "@workspace/db";
import { eq, and, ne, isNull, asc, sql } from "drizzle-orm";
import { hasPerm } from "../middleware/auth.js";

const router = Router();

async function getStaffName(staffId: number): Promise<string | null> {
  const [s] = await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  return s?.name ?? null;
}

type LineItem = { description: string; quantity: number; unitPrice: number; subtotal: number };

// Half-hour rounding rule requested by the owner:
// any started 30-minute block is charged in full (ceil to the next half hour).
// 1h10m -> 1h30m, 1h31m -> 2h, exactly 1h30m -> 1h30m.
function billedHours(ms: number): number {
  if (ms <= 0) return 0;
  return Math.ceil(ms / 1800000) / 2;
}

function billingEndTime(session: typeof sessionsTable.$inferSelect): number {
  return session.timeStoppedAt ? new Date(session.timeStoppedAt).getTime() : Date.now();
}

function fmtHours(h: number): string {
  return h % 1 === 0 ? `${h} ساعة` : `${h} ساعة`.replace(`${h}`, `${Math.floor(h)}.5`);
}

// Per-guest billed time for a per_person session.
async function getGuestCharges(session: typeof sessionsTable.$inferSelect) {
  const rate = session.perPersonRate ?? 0;
  const end = billingEndTime(session);
  const guests = await db.select().from(sessionGuestsTable)
    .where(eq(sessionGuestsTable.sessionId, session.id))
    .orderBy(asc(sessionGuestsTable.joinedAt));
  return guests.map((g) => {
    const gEnd = g.leftAt ? Math.min(new Date(g.leftAt).getTime(), end) : end;
    const hours = billedHours(gEnd - new Date(g.joinedAt).getTime());
    return { ...g, billedHours: hours, amount: Math.round(rate * hours) };
  });
}

// Build the time-based booking line item(s) for a session.
// per_person with guest rows: one line per guest window.
// flat/room: single line, hours rounded up to the next half hour.
async function getTimeLineItems(session: typeof sessionsTable.$inferSelect): Promise<LineItem[]> {
  const ms = billingEndTime(session) - new Date(session.startTime).getTime();
  const hours = billedHours(ms);

  if (session.type === "room") {
    const [room] = await db.select({ hourlyRate: roomsTable.hourlyRate }).from(roomsTable).where(eq(roomsTable.id, session.resourceId)).limit(1);
    if (!room || room.hourlyRate <= 0) return [];
    const amount = Math.round(room.hourlyRate * hours);
    if (amount <= 0) return [];
    return [{ description: `حجز الغرفة — ${fmtHours(hours)} × ${room.hourlyRate.toLocaleString("en-US")} ل.س/ساعة`, quantity: 1, unitPrice: amount, subtotal: amount }];
  }

  if (session.type === "table" || session.type === "football" || session.type === "work") {
    if (session.billingMode === "per_person") {
      const rate = session.perPersonRate ?? 0;
      if (rate <= 0) return [];
      const charges = await getGuestCharges(session);
      if (charges.length > 0) {
        return charges
          .filter((c) => c.amount > 0)
          .map((c, i) => ({
            description: `وقت — ${c.name || `شخص ${i + 1}`} — ${fmtHours(c.billedHours)} × ${rate.toLocaleString("en-US")} ل.س/ساعة`,
            quantity: 1, unitPrice: c.amount, subtotal: c.amount,
          }));
      }
      // Legacy sessions without guest rows: bill guestCount for the whole session.
      const guests = session.guestCount && session.guestCount > 0 ? session.guestCount : 1;
      const perPerson = Math.round(rate * hours);
      if (perPerson * guests <= 0) return [];
      return [{ description: `حجز زمني — ${fmtHours(hours)} × ${rate.toLocaleString("en-US")} ل.س/ساعة لكل شخص`, quantity: guests, unitPrice: perPerson, subtotal: perPerson * guests }];
    }
    const [table] = await db.select({ hourlyRate: tablesTable.hourlyRate }).from(tablesTable).where(eq(tablesTable.id, session.resourceId)).limit(1);
    if (!table || table.hourlyRate <= 0) return [];
    const amount = Math.round(table.hourlyRate * hours);
    if (amount <= 0) return [];
    return [{ description: `حجز الطاولة — ${fmtHours(hours)} × ${table.hourlyRate.toLocaleString("en-US")} ل.س/ساعة`, quantity: 1, unitPrice: amount, subtotal: amount }];
  }

  return [];
}

async function sumOrderCost(sessionId: number): Promise<number> {
  // Cancelled orders are never charged.
  const orders = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.sessionId, sessionId), ne(ordersTable.status, "cancelled")));
  let orderCost = 0;
  for (const order of orders) {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    for (const item of items) orderCost += item.subtotal;
  }
  return orderCost;
}

async function computeCost(session: typeof sessionsTable.$inferSelect): Promise<number> {
  const timeItems = await getTimeLineItems(session);
  const timeCost = timeItems.reduce((sum, it) => sum + it.subtotal, 0);
  if (session.type === "room") return timeCost;
  if (session.type === "table" || session.type === "football" || session.type === "work") {
    return timeCost + (await sumOrderCost(session.id));
  }
  return 0;
}

function serializeSession(s: typeof sessionsTable.$inferSelect, staffName: string | null) {
  return {
    ...s,
    staffName,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime?.toISOString() ?? null,
    plannedEndTime: s.plannedEndTime?.toISOString() ?? null,
    timeStoppedAt: s.timeStoppedAt?.toISOString() ?? null,
  };
}

function serializeGuest(g: typeof sessionGuestsTable.$inferSelect & { billedHours?: number; amount?: number }) {
  return {
    id: g.id,
    sessionId: g.sessionId,
    name: g.name,
    joinedAt: g.joinedAt.toISOString(),
    leftAt: g.leftAt?.toISOString() ?? null,
    billedHours: g.billedHours ?? 0,
    amount: g.amount ?? 0,
  };
}

router.get("/sessions", async (req, res) => {
  const rows = await db.select().from(sessionsTable).orderBy(sessionsTable.startTime);
  const enriched = await Promise.all(rows.map(async (s) => {
    const ser = serializeSession(s, await getStaffName(s.staffId));
    if (s.status === "active") {
      ser.currentCost = await computeCost(s);
    }
    return ser;
  }));
  return res.json(enriched);
});

router.get("/sessions/:id/bill", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });

  const timeItems = await getTimeLineItems(session);
  const items: LineItem[] = [...timeItems];
  const guestCharges = session.billingMode === "per_person" ? await getGuestCharges(session) : [];

  let orderCost = 0;
  if (session.type !== "room") {
    const orders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.sessionId, id), ne(ordersTable.status, "cancelled")));
    for (const order of orders) {
      const oItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      for (const it of oItems) {
        items.push({ description: it.menuItemName, quantity: it.quantity, unitPrice: it.unitPrice, subtotal: it.subtotal });
        orderCost += it.subtotal;
      }
    }
  }

  const timeCost = timeItems.reduce((sum, it) => sum + it.subtotal, 0);
  return res.json({
    sessionId: id,
    resourceName: session.resourceName,
    guestCount: session.guestCount,
    startTime: session.startTime.toISOString(),
    billingMode: session.billingMode,
    timeStoppedAt: session.timeStoppedAt?.toISOString() ?? null,
    guests: guestCharges.map(serializeGuest),
    items,
    timeCost,
    orderCost,
    total: timeCost + orderCost,
  });
});

router.post("/sessions", validateBody(CreateSessionBody), async (req, res) => {
  const { type, resourceId, bookingId, customerId, customerName, customerPhone, guestCount, plannedEndTime, billingMode, perPersonRate, staffId, notes } = req.body;
  if (!type || !resourceId || !staffId) {
    return res.status(400).json({ error: "type, resourceId, staffId required" });
  }

  if (billingMode === "per_person") {
    if (typeof perPersonRate !== "number" || perPersonRate <= 0) {
      return res.status(400).json({ error: "يجب تحديد سعر الساعة لكل شخص (أكبر من صفر) عند اختيار الحجز الزمني" });
    }
    if (typeof guestCount !== "number" || guestCount < 1) {
      return res.status(400).json({ error: "يجب تحديد عدد الضيوف (1 أو أكثر) عند اختيار الحجز الزمني" });
    }
  }

  // Resolve customer info
  let resolvedName = customerName;
  let resolvedPhone = customerPhone;
  if (customerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (cust) { resolvedName = resolvedName ?? cust.name; resolvedPhone = resolvedPhone ?? cust.phone; }
  }

  let resourceName = "";
  if (type === "room") {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, resourceId)).limit(1);
    resourceName = room?.name ?? "Room";
    await db.update(roomsTable).set({ status: "occupied" }).where(eq(roomsTable.id, resourceId));
  } else {
    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, resourceId)).limit(1);
    resourceName = `طاولة ${table?.number ?? resourceId}`;
    await db.update(tablesTable).set({ status: "occupied" }).where(eq(tablesTable.id, resourceId));
  }

  const [created] = await db.insert(sessionsTable).values({
    type, resourceId, resourceName, bookingId,
    customerId: customerId ?? null,
    customerName: resolvedName, customerPhone: resolvedPhone,
    guestCount, plannedEndTime: plannedEndTime ? new Date(plannedEndTime) : null,
    billingMode: billingMode === "per_person" ? "per_person" : "flat",
    perPersonRate: billingMode === "per_person" ? (perPersonRate ?? null) : null,
    staffId, notes, status: "active", currentCost: 0,
  }).returning();

  // Per-person sessions track each guest individually so late joiners pay only their own time.
  if (created.billingMode === "per_person") {
    const count = created.guestCount && created.guestCount > 0 ? created.guestCount : 1;
    const guestNames: unknown = req.body?.guestNames;
    const names = Array.isArray(guestNames) ? guestNames : [];
    await db.insert(sessionGuestsTable).values(
      Array.from({ length: count }, (_, i) => ({
        sessionId: created.id,
        name: typeof names[i] === "string" && names[i].trim() ? String(names[i]).trim() : null,
        joinedAt: created.startTime,
      }))
    );
  }

  const staffName = await getStaffName(created.staffId);
  return res.status(201).json(serializeSession(created, staffName));
});

// Add a person to an active per-person session; their time starts NOW.
router.post("/sessions/:id/guests", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });
  if (session.status !== "active") return res.status(400).json({ error: "الجلسة غير نشطة" });
  if (session.billingMode !== "per_person") return res.status(400).json({ error: "إضافة الأشخاص متاحة فقط للجلسات المحاسَبة لكل شخص" });
  if (session.timeStoppedAt) return res.status(400).json({ error: "الوقت موقوف لهذه الجلسة — أعد تشغيل الوقت أولاً" });

  const name: string | null = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : null;
  await db.insert(sessionGuestsTable).values({ sessionId: id, name, joinedAt: new Date() });
  await db.update(sessionsTable).set({ guestCount: sql`COALESCE(${sessionsTable.guestCount}, 0) + 1` }).where(eq(sessionsTable.id, id));

  const [updated] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  return res.status(201).json(serializeSession(updated, await getStaffName(updated.staffId)));
});

// Mark a specific person as left; their time (and cost) freezes at this moment.
router.post("/sessions/:id/guests/:guestId/leave", async (req, res) => {
  const id = parseInt(req.params.id);
  const guestId = parseInt(req.params.guestId);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });
  if (session.status !== "active") return res.status(400).json({ error: "الجلسة غير نشطة" });

  const [guest] = await db.select().from(sessionGuestsTable)
    .where(and(eq(sessionGuestsTable.id, guestId), eq(sessionGuestsTable.sessionId, id))).limit(1);
  if (!guest) return res.status(404).json({ error: "الشخص غير موجود في هذه الجلسة" });
  if (guest.leftAt) return res.status(400).json({ error: "تم تسجيل مغادرة هذا الشخص مسبقاً" });

  const stillActive = await db.select({ id: sessionGuestsTable.id }).from(sessionGuestsTable)
    .where(and(eq(sessionGuestsTable.sessionId, id), isNull(sessionGuestsTable.leftAt)));
  if (stillActive.length <= 1) {
    return res.status(400).json({ error: "لا يمكن مغادرة آخر شخص — أنهِ الجلسة بدلاً من ذلك" });
  }

  // If the clock is paused, the leave time must be the pause moment — the
  // paused gap is never billable to anyone.
  const leftAt = session.timeStoppedAt ? new Date(session.timeStoppedAt) : new Date();
  await db.update(sessionGuestsTable).set({ leftAt }).where(eq(sessionGuestsTable.id, guestId));
  await db.update(sessionsTable).set({ guestCount: sql`GREATEST(COALESCE(${sessionsTable.guestCount}, 1) - 1, 1)` }).where(eq(sessionsTable.id, id));

  const [updated] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  return res.json(serializeSession(updated, await getStaffName(updated.staffId)));
});

// Stop the time clock for a session: time cost freezes now, orders can still be added.
router.post("/sessions/:id/stop-time", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });
  if (session.status !== "active") return res.status(400).json({ error: "الجلسة غير نشطة" });
  if (session.timeStoppedAt) return res.status(400).json({ error: "الوقت موقوف مسبقاً" });

  const [updated] = await db.update(sessionsTable).set({ timeStoppedAt: new Date() }).where(eq(sessionsTable.id, id)).returning();
  return res.json(serializeSession(updated, await getStaffName(updated.staffId)));
});

// Resume the time clock: the paused gap is NOT charged (start times shift forward).
router.post("/sessions/:id/resume-time", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });
  if (session.status !== "active") return res.status(400).json({ error: "الجلسة غير نشطة" });
  if (!session.timeStoppedAt) return res.status(400).json({ error: "الوقت غير موقوف" });

  const pausedMs = Date.now() - new Date(session.timeStoppedAt).getTime();
  const shift = sql`+ make_interval(secs => ${Math.max(0, Math.round(pausedMs / 1000))})`;
  await db.update(sessionsTable).set({
    timeStoppedAt: null,
    startTime: sql`${sessionsTable.startTime} ${shift}`,
  }).where(eq(sessionsTable.id, id));
  await db.update(sessionGuestsTable).set({
    joinedAt: sql`${sessionGuestsTable.joinedAt} ${shift}`,
  }).where(and(eq(sessionGuestsTable.sessionId, id), isNull(sessionGuestsTable.leftAt)));

  const [updated] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  return res.json(serializeSession(updated, await getStaffName(updated.staffId)));
});

router.patch("/sessions/:id", validateBody(UpdateSessionBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { plannedEndTime, status, notes, guestCount } = req.body;
  const updates: Record<string, unknown> = {};
  if (plannedEndTime !== undefined) updates.plannedEndTime = new Date(plannedEndTime);
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (guestCount !== undefined) updates.guestCount = guestCount;

  const [updated] = await db.update(sessionsTable).set(updates).where(eq(sessionsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });

  // Keep per-guest tracking rows in sync when guestCount is edited directly,
  // otherwise the bill only charges the tracked guests (e.g. 2 people billed as 1).
  if (guestCount !== undefined && updated.billingMode === "per_person" && typeof guestCount === "number" && guestCount >= 1) {
    const active = await db.select().from(sessionGuestsTable)
      .where(and(eq(sessionGuestsTable.sessionId, id), isNull(sessionGuestsTable.leftAt)))
      .orderBy(asc(sessionGuestsTable.joinedAt));
    if (guestCount > active.length) {
      const joinedAt = updated.timeStoppedAt ? new Date(updated.timeStoppedAt) : new Date();
      await db.insert(sessionGuestsTable).values(
        Array.from({ length: guestCount - active.length }, () => ({ sessionId: id, name: null, joinedAt }))
      );
    } else if (guestCount < active.length) {
      const leftAt = updated.timeStoppedAt ? new Date(updated.timeStoppedAt) : new Date();
      const toClose = active.slice(guestCount);
      for (const g of toClose) {
        await db.update(sessionGuestsTable).set({ leftAt }).where(eq(sessionGuestsTable.id, g.id));
      }
    }
  }

  return res.json(serializeSession(updated, await getStaffName(updated.staffId)));
});

// Remove one guest from an active session (e.g. a person left the table/room).
// Decrements guestCount (never below 1) and logs it for the manager report.
router.post("/sessions/:id/remove-guest", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });
  if (session.status !== "active") return res.status(400).json({ error: "الجلسة غير نشطة" });
  if ((session.guestCount ?? 1) <= 1) return res.status(400).json({ error: "لا يمكن إنقاص عدد الأشخاص عن واحد" });

  const newCount = (session.guestCount ?? 1) - 1;
  await db.update(sessionsTable).set({ guestCount: newCount }).where(eq(sessionsTable.id, id));

  // Freeze the time of the most recently joined still-active guest row (if tracked).
  const active = await db.select().from(sessionGuestsTable)
    .where(and(eq(sessionGuestsTable.sessionId, id), isNull(sessionGuestsTable.leftAt)))
    .orderBy(asc(sessionGuestsTable.joinedAt));
  if (active.length > 1) {
    const last = active[active.length - 1];
    const leftAt = session.timeStoppedAt ? new Date(session.timeStoppedAt) : new Date();
    await db.update(sessionGuestsTable).set({ leftAt }).where(eq(sessionGuestsTable.id, last.id));
  }

  const [staff] = req.staff?.id
    ? await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, req.staff.id)).limit(1)
    : [null];
  await db.insert(cancellationsTable).values({
    kind: "guest",
    action: "removed",
    resourceType: session.type,
    refId: id,
    label: `${session.resourceName}: إزالة شخص (${newCount + 1} ← ${newCount})`,
    amount: 0,
    reason: req.body?.reason ?? null,
    staffId: req.staff?.id ?? null,
    staffName: staff?.name ?? null,
  });

  const [updated] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  return res.json(serializeSession(updated, await getStaffName(updated.staffId)));
});

router.post("/sessions/:id/end", validateBody(EndSessionBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });
  if (session.status === "closed") return res.status(400).json({ error: "الجلسة مغلقة مسبقاً" });
  if (session.status === "cancelled") return res.status(400).json({ error: "لا يمكن إصدار فاتورة لجلسة ملغاة" });

  // Build invoice line items once, and derive the total from the same values
  // so that line items and the invoice total never drift (e.g. across the
  // second boundary or rounding).
  const allItems: LineItem[] = [];
  const timeItems = await getTimeLineItems(session);
  allItems.push(...timeItems);
  let orderCost = 0;

  // Orders are only charged for non-room sessions (matches computeCost and the bill endpoint).
  // Cancelled orders are excluded so they never appear on the invoice.
  if (session.type !== "room") {
    const orders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.sessionId, id), ne(ordersTable.status, "cancelled")));
    for (const order of orders) {
      const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      for (const item of items) {
        allItems.push({ description: item.menuItemName, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal });
        orderCost += item.subtotal;
      }
    }
  }

  const finalCost = timeItems.reduce((sum, it) => sum + it.subtotal, 0) + orderCost;

  const paymentMethod: string = req.body?.paymentMethod ?? "cash";
  const amountPaid: number | null = req.body?.amountPaid ?? null;
  const discountPercent: number = req.body?.discountPercent ?? 0;
  const notes: string | null = req.body?.notes ?? null;
  const overrideTotalRaw = req.body?.overrideTotal;
  const overrideTotal: number | null =
    typeof overrideTotalRaw === "number" && Number.isFinite(overrideTotalRaw) && overrideTotalRaw >= 0
      ? Math.round(overrideTotalRaw)
      : null;

  // Manual price override is a privileged cashier action — enforce server-side.
  if (overrideTotal != null && !hasPerm(req, "cashier.view")) {
    return res.status(403).json({ error: "ليس لديك صلاحية تعديل السعر النهائي", required: "cashier.view" });
  }

  const discountAmount = Math.round(finalCost * (discountPercent / 100));
  const subtotal = finalCost;
  const tax = 0;
  let total = Math.max(0, subtotal - discountAmount + tax);

  // Cashier override: the final charged amount can be set freely (higher or lower
  // than the computed bill). The difference is recorded as an explicit line item.
  if (overrideTotal != null && overrideTotal !== total) {
    const adjustment = overrideTotal - total;
    allItems.push({
      description: adjustment > 0 ? "تعديل السعر (زيادة يدوية)" : "تعديل السعر (تخفيض يدوي)",
      quantity: 1,
      unitPrice: adjustment,
      subtotal: adjustment,
    });
    total = overrideTotal;
  }

  const change = amountPaid != null ? Math.max(0, amountPaid - total) : null;

  const [invoice] = await db.insert(invoicesTable).values({
    sessionId: id,
    customerId: session.customerId ?? null,
    customerName: session.customerName,
    subtotal, discountAmount, discountPercent, tax, total, amountPaid, change,
    paymentMethod, status: "paid", staffId: session.staffId, notes,
    items: allItems,
  }).returning();

  await db.update(sessionsTable).set({ status: "closed", endTime: new Date(), currentCost: finalCost }).where(eq(sessionsTable.id, id));

  // Free the resource
  if (session.type === "room") {
    await db.update(roomsTable).set({ status: "available" }).where(eq(roomsTable.id, session.resourceId));
  } else {
    await db.update(tablesTable).set({ status: "available" }).where(eq(tablesTable.id, session.resourceId));
  }

  // Update customer stats
  if (session.customerId) {
    await db.update(customersTable).set({
      totalVisits: sql`${customersTable.totalVisits} + 1`,
      totalSpent: sql`${customersTable.totalSpent} + ${total}`,
    }).where(eq(customersTable.id, session.customerId));
  }

  return res.json({ ...invoice, createdAt: invoice.createdAt.toISOString() });
});

// Cancel a session (table/room booking cancelled, e.g. mistake or walkout) without
// generating an invoice. The forgone amount is logged for the manager-only report.
router.post("/sessions/:id/cancel", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  if (!session) return res.status(404).json({ error: "Not found" });
  if (session.status === "closed") return res.status(400).json({ error: "لا يمكن إلغاء جلسة مغلقة" });
  if (session.status === "cancelled") return res.status(400).json({ error: "الجلسة ملغاة مسبقاً" });

  const amount = await computeCost(session);
  const reason: string | null = req.body?.reason ?? null;

  await db.insert(cancellationsTable).values({
    kind: "session",
    action: "cancelled",
    resourceType: session.type,
    refId: id,
    label: session.resourceName,
    amount,
    reason,
    staffId: req.staff?.id ?? null,
    staffName: req.staff?.id ? await getStaffName(req.staff.id) : null,
  });

  await db.update(sessionsTable).set({ status: "cancelled", endTime: new Date() }).where(eq(sessionsTable.id, id));

  // Free the resource
  if (session.type === "room") {
    await db.update(roomsTable).set({ status: "available" }).where(eq(roomsTable.id, session.resourceId));
  } else {
    await db.update(tablesTable).set({ status: "available" }).where(eq(tablesTable.id, session.resourceId));
  }

  return res.json({ ok: true, cancelledAmount: amount });
});

export default router;
