import { Router } from "express";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth.js";
import { requirePerm } from "../middleware/auth.js";
import { sessionDeleteAll } from "../auth-store.js";

const router = Router();

router.get("/staff", requirePerm("staff.view"), async (req, res) => {
  const staff = await db.select().from(staffTable).orderBy(staffTable.createdAt);
  return res.json(staff.map(s => {
    const { passwordHash: _, ...safe } = s;
    return { ...safe, createdAt: s.createdAt.toISOString() };
  }));
});

router.post("/staff", requirePerm("staff.manage"), async (req, res) => {
  const { name, username, password, role, phone, permissions } = req.body;
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: "name, username, password, role required" });
  }
  const [created] = await db.insert(staffTable).values({
    name,
    username,
    passwordHash: await hashPassword(password),
    role,
    phone: phone || null,
    permissions: permissions || null,
    isActive: true,
  }).returning();
  const { passwordHash: _, ...safe } = created;
  return res.status(201).json({ ...safe, createdAt: created.createdAt.toISOString() });
});

router.get("/staff/:id", requirePerm("staff.view"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [s] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
  if (!s) return res.status(404).json({ error: "Not found" });
  const { passwordHash: _, ...safe } = s;
  return res.json({ ...safe, createdAt: s.createdAt.toISOString() });
});

router.patch("/staff/:id", requirePerm("staff.manage"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, role, phone, isActive, permissions, password } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone;
  if (isActive !== undefined) updates.isActive = isActive;
  if (permissions !== undefined) updates.permissions = permissions;
  if (password !== undefined) {
    updates.passwordHash = await hashPassword(password);
  }

  const [updated] = await db.update(staffTable).set(updates).where(eq(staffTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });

  if (password !== undefined) {
    await sessionDeleteAll(id);
  }

  const { passwordHash: _, ...safe } = updated;
  return res.json({ ...safe, createdAt: updated.createdAt.toISOString() });
});

router.delete("/staff/:id", requirePerm("staff.manage"), async (req, res) => {
  const targetId = parseInt(req.params.id as string);
  if (req.staff?.id === targetId) {
    return res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
  }
  await db.delete(staffTable).where(eq(staffTable.id, targetId));
  return res.status(204).send();
});

export default router;
