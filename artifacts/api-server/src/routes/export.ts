import { Router } from "express";
import { ZipArchive } from "archiver";
import { db } from "@workspace/db";
import {
  invoicesTable, sessionsTable, ordersTable, orderItemsTable,
  expensesTable, customersTable, inventoryTable, staffTable,
  menuItemsTable, categoriesTable, bookingsTable,
} from "@workspace/db";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

// Helper: convert array of objects to CSV string
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    // wrap in quotes if contains comma, newline, or quote
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("ar-SY", { timeZone: "Asia/Damascus", hour12: false });
}

router.get("/export/data", requirePerm("reports.view"), async (req, res) => {
  try {
    // Fetch all data in parallel
    const [
      invoices, sessions, orders, orderItems,
      expenses, customers, inventory, staff,
      menuItems, categories, bookings,
    ] = await Promise.all([
      db.select().from(invoicesTable).orderBy(invoicesTable.createdAt),
      db.select().from(sessionsTable).orderBy(sessionsTable.createdAt),
      db.select().from(ordersTable).orderBy(ordersTable.createdAt),
      db.select().from(orderItemsTable).orderBy(orderItemsTable.id),
      db.select().from(expensesTable).orderBy(expensesTable.date),
      db.select().from(customersTable).orderBy(customersTable.createdAt),
      db.select().from(inventoryTable).orderBy(inventoryTable.name),
      db.select().from(staffTable).orderBy(staffTable.createdAt),
      db.select().from(menuItemsTable).orderBy(menuItemsTable.name),
      db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder),
      db.select().from(bookingsTable).orderBy(bookingsTable.createdAt),
    ]);

    // Build CSV content for each sheet
    const invoicesCsv = toCsv(invoices.map(i => ({
      "رقم الفاتورة": i.id,
      "التاريخ": fmt(i.createdAt),
      "رقم الجلسة": i.sessionId ?? "",
      "اسم الزبون": i.customerName ?? "",
      "المجموع الفرعي": i.subtotal,
      "الخصم (مبلغ)": i.discountAmount,
      "الخصم (%)": i.discountPercent ?? 0,
      "الضريبة": i.tax,
      "الإجمالي": i.total,
      "المبلغ المدفوع": i.amountPaid ?? i.total,
      "الباقي": i.change ?? 0,
      "طريقة الدفع": i.paymentMethod,
      "الحالة": i.status,
      "البنود": typeof i.items === "string" ? i.items : JSON.stringify(i.items),
      "ملاحظات": i.notes ?? "",
    })));

    const sessionsCsv = toCsv(sessions.map(s => ({
      "رقم الجلسة": s.id,
      "النوع": s.type,
      "اسم المورد": s.resourceName,
      "اسم الزبون": s.customerName ?? "",
      "هاتف الزبون": s.customerPhone ?? "",
      "عدد الضيوف": s.guestCount ?? "",
      "وقت البدء": fmt(s.startTime),
      "وقت الانتهاء": fmt(s.endTime),
      "الحالة": s.status,
      "التكلفة الكاملة": s.currentCost,
      "طريقة الحساب": s.billingMode,
      "ملاحظات": s.notes ?? "",
    })));

    const ordersCsv = toCsv(orders.map(o => ({
      "رقم الطلب": o.id,
      "رقم الجلسة": o.sessionId,
      "التاريخ": fmt(o.createdAt),
      "الحالة": o.status,
      "المجموع": o.totalAmount,
      "ملاحظات": o.notes ?? "",
    })));

    const orderItemsCsv = toCsv(orderItems.map(i => ({
      "رقم البند": i.id,
      "رقم الطلب": i.orderId,
      "اسم الصنف": i.menuItemName,
      "الكمية": i.quantity,
      "سعر الوحدة": i.unitPrice,
      "الإجمالي": i.subtotal,
      "ملاحظات": i.notes ?? "",
    })));

    const expensesCsv = toCsv(expenses.map(e => ({
      "رقم المصروف": e.id,
      "العنوان": e.title,
      "المبلغ": e.amount,
      "الفئة": e.category,
      "التاريخ": e.date,
      "ملاحظات": e.notes ?? "",
    })));

    const customersCsv = toCsv(customers.map(c => ({
      "رقم الزبون": c.id,
      "الاسم": c.name,
      "الاسم بالعربي": c.nameAr ?? "",
      "الهاتف": c.phone ?? "",
      "الإيميل": c.email ?? "",
      "الشركة": c.company ?? "",
      "عدد الزيارات": c.totalVisits,
      "إجمالي الإنفاق": c.totalSpent,
      "تاريخ التسجيل": fmt(c.createdAt),
      "ملاحظات": c.notes ?? "",
    })));

    const inventoryCsv = toCsv(inventory.map(i => ({
      "رقم الصنف": i.id,
      "الاسم": i.name,
      "الوحدة": i.unit,
      "الكمية الحالية": i.currentQuantity,
      "الحد الأدنى": i.minQuantity,
      "التكلفة لكل وحدة": i.costPerUnit,
      "آخر تخزين": fmt(i.lastRestocked),
    })));

    // Strip password hash from staff
    const staffCsv = toCsv(staff.map(s => ({
      "رقم الموظف": s.id,
      "الاسم": s.name,
      "اسم المستخدم": s.username,
      "الدور": s.role,
      "الهاتف": s.phone ?? "",
      "نشط": s.isActive ? "نعم" : "لا",
      "تاريخ التسجيل": fmt(s.createdAt),
    })));

    const menuCsv = toCsv(menuItems.map(m => ({
      "رقم الصنف": m.id,
      "الاسم": m.name,
      "الاسم بالعربي": m.nameAr ?? "",
      "السعر": m.price,
      "الخصم (%)": m.discountPercent,
      "رقم الفئة": m.categoryId,
      "متاح": m.isAvailable ? "نعم" : "لا",
      "وقت التحضير (دقيقة)": m.preparationTime ?? "",
      "الوصف": m.description ?? "",
    })));

    const categoriesCsv = toCsv(categories.map(c => ({
      "رقم الفئة": c.id,
      "الاسم": c.name,
      "الأيقونة": c.icon ?? "",
      "الترتيب": c.sortOrder,
    })));

    const bookingsCsv = toCsv(bookings.map(b => ({
      "رقم الحجز": b.id,
      "النوع": b.type,
      "اسم المورد": b.resourceName,
      "اسم الزبون": b.customerName ?? "",
      "هاتف الزبون": b.customerPhone ?? "",
      "عدد الضيوف": b.guestCount,
      "تاريخ البدء": fmt(b.startTime),
      "تاريخ الانتهاء": fmt(b.endTime),
      "الحالة": b.status,
      "المبلغ": b.totalAmount,
      "يشمل مشروبات": b.includesDrinks ? "نعم" : "لا",
      "ملاحظات": b.notes ?? "",
    })));

    // Build ZIP
    const now = new Date();
    const dateTag = now.toISOString().slice(0, 10); // e.g. 2026-08-03
    const filename = `BrewDesk-Export-${dateTag}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(res);

    const BOM = "\uFEFF"; // UTF-8 BOM for Excel Arabic compatibility
    const files: [string, string][] = [
      ["فواتير.csv", BOM + invoicesCsv],
      ["جلسات.csv", BOM + sessionsCsv],
      ["طلبات.csv", BOM + ordersCsv],
      ["بنود_الطلبات.csv", BOM + orderItemsCsv],
      ["مصروفات.csv", BOM + expensesCsv],
      ["زبائن.csv", BOM + customersCsv],
      ["مخزون.csv", BOM + inventoryCsv],
      ["موظفون.csv", BOM + staffCsv],
      ["قائمة_الطعام.csv", BOM + menuCsv],
      ["الفئات.csv", BOM + categoriesCsv],
      ["حجوزات.csv", BOM + bookingsCsv],
    ];

    for (const [name, content] of files) {
      archive.append(content, { name });
    }

    await archive.finalize();
  } catch (err) {
    req.log.error({ err }, "export failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "فشل تصدير البيانات" });
    }
  }
});

export default router;
