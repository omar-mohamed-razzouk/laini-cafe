import { validateBody } from "../middleware/validate.js";
import { CreateCategoryBody, UpdateCategoryBody, CreateMenuItemBody, UpdateMenuItemBody } from "@workspace/api-zod";
import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, menuItemsTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requirePerm } from "../middleware/auth.js";

const router = Router();

// Categories
router.get("/menu/categories", async (_req, res) => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder);
  return res.json(cats);
});

router.post("/menu/categories", requirePerm("menu.manage"), validateBody(CreateCategoryBody), async (req, res) => {
  const { name, icon, sortOrder } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [created] = await db.insert(categoriesTable).values({ name, icon, sortOrder: sortOrder ?? 0 }).returning();
  return res.status(201).json(created);
});

router.patch("/menu/categories/:id", requirePerm("menu.manage"), validateBody(UpdateCategoryBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  for (const f of ["name", "icon", "sortOrder"]) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [updated] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

router.delete("/menu/categories/:id", requirePerm("menu.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  return res.status(204).send();
});

// Menu items
router.get("/menu/items", async (_req, res) => {
  const items = await db
    .select({
      id: menuItemsTable.id,
      name: menuItemsTable.name,
      nameAr: menuItemsTable.nameAr,
      description: menuItemsTable.description,
      price: menuItemsTable.price,
      discountPercent: menuItemsTable.discountPercent,
      categoryId: menuItemsTable.categoryId,
      categoryName: categoriesTable.name,
      isAvailable: menuItemsTable.isAvailable,
      preparationTime: menuItemsTable.preparationTime,
    })
    .from(menuItemsTable)
    .leftJoin(categoriesTable, eq(menuItemsTable.categoryId, categoriesTable.id))
    .orderBy(menuItemsTable.id);

  return res.json(items.map(item => ({
    ...item,
    finalPrice: item.price * (1 - (item.discountPercent ?? 0) / 100),
  })));
});

router.post("/menu/items", requirePerm("menu.manage"), validateBody(CreateMenuItemBody), async (req, res) => {
  const { name, nameAr, description, price, discountPercent, categoryId, isAvailable, preparationTime } = req.body;
  if (!name || !price || !categoryId) {
    return res.status(400).json({ error: "name, price, categoryId required" });
  }
  const [created] = await db.insert(menuItemsTable).values({
    name, nameAr, description,
    price, discountPercent: discountPercent ?? 0,
    categoryId, isAvailable: isAvailable ?? true,
    preparationTime,
  }).returning();

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, created.categoryId)).limit(1);
  return res.status(201).json({
    ...created,
    categoryName: cat?.name ?? null,
    finalPrice: created.price * (1 - (created.discountPercent ?? 0) / 100),
  });
});

router.get("/menu/items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [item] = await db
    .select({
      id: menuItemsTable.id,
      name: menuItemsTable.name,
      nameAr: menuItemsTable.nameAr,
      description: menuItemsTable.description,
      price: menuItemsTable.price,
      discountPercent: menuItemsTable.discountPercent,
      categoryId: menuItemsTable.categoryId,
      categoryName: categoriesTable.name,
      isAvailable: menuItemsTable.isAvailable,
      preparationTime: menuItemsTable.preparationTime,
    })
    .from(menuItemsTable)
    .leftJoin(categoriesTable, eq(menuItemsTable.categoryId, categoriesTable.id))
    .where(eq(menuItemsTable.id, id))
    .limit(1);

  if (!item) return res.status(404).json({ error: "Not found" });
  return res.json({ ...item, finalPrice: item.price * (1 - (item.discountPercent ?? 0) / 100) });
});

router.patch("/menu/items/:id", requirePerm("menu.manage"), validateBody(UpdateMenuItemBody), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const updates: Record<string, unknown> = {};
  for (const f of ["name", "nameAr", "description", "price", "discountPercent", "categoryId", "isAvailable", "preparationTime"]) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  const [updated] = await db.update(menuItemsTable).set(updates).where(eq(menuItemsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, updated.categoryId)).limit(1);
  return res.json({
    ...updated,
    categoryName: cat?.name ?? null,
    finalPrice: updated.price * (1 - (updated.discountPercent ?? 0) / 100),
  });
});

router.delete("/menu/items/:id", requirePerm("menu.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
  return res.status(204).send();
});

router.get("/menu/popular", async (_req, res) => {
  const popular = await db
    .select({
      id: menuItemsTable.id,
      name: menuItemsTable.name,
      totalOrdered: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(${orderItemsTable.subtotal}), 0)`.mapWith(Number),
    })
    .from(menuItemsTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
    .groupBy(menuItemsTable.id, menuItemsTable.name)
    .orderBy(desc(sql`coalesce(sum(${orderItemsTable.quantity}), 0)`))
    .limit(10);

  return res.json(popular);
});

export default router;
