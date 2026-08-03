import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sessionGet } from "../auth-store.js";

export type StaffUser = {
  id: number;
  role: string;
  permissions: Record<string, boolean> | null;
};

declare global {
  namespace Express {
    interface Request {
      staff?: StaffUser;
    }
  }
}

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: [],
  manager: [
    "tables.view", "tables.manage",
    "rooms.view", "rooms.manage",
    "bookings.view", "bookings.manage",
    "sessions.view",
    "orders.view", "orders.manage",
    "cashier.view",
    "menu.view", "menu.manage",
    "inventory.view", "inventory.manage",
    "expenses.view", "expenses.manage",
    "reports.view",
    "customers.view", "customers.manage",
    "staff.view",
    "data.reset",
  ],
  cashier: [
    "tables.view", "tables.manage",
    "rooms.view",
    "sessions.view",
    "orders.view", "orders.manage",
    "cashier.view",
    "menu.view",
    "customers.view", "customers.manage",
  ],
  waiter: [
    "tables.view", "tables.manage",
    "rooms.view",
    "bookings.view", "bookings.manage",
    "sessions.view",
    "orders.view", "orders.manage",
    "menu.view",
    "customers.view",
  ],
  kitchen: [
    "orders.view", "orders.manage",
    "menu.view",
    "inventory.view",
  ],
};

function checkPerm(staff: StaffUser, perm: string): boolean {
  if (staff.role === "admin") return true;
  const perms = staff.permissions;
  if (perms != null && Object.keys(perms).length > 0) {
    return perms[perm] === true;
  }
  return (ROLE_DEFAULTS[staff.role] ?? []).includes(perm);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  const staffId = await sessionGet(token);
  if (!staffId) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const [staff] = await db
    .select({ id: staffTable.id, role: staffTable.role, permissions: staffTable.permissions, isActive: staffTable.isActive })
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1);
  if (!staff || !staff.isActive) {
    return res.status(401).json({ error: "Account inactive or not found" });
  }
  req.staff = {
    id: staff.id,
    role: staff.role,
    permissions: staff.permissions as Record<string, boolean> | null,
  };
  return next();
}

export function requirePerm(perm: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const staff = req.staff;
    if (!staff) return res.status(401).json({ error: "Unauthorized" });
    if (checkPerm(staff, perm)) return next();
    return res.status(403).json({ error: "ليس لديك صلاحية لهذا الإجراء", required: perm });
  };
}

export function isAdmin(req: Request): boolean {
  return req.staff?.role === "admin";
}

export function hasPerm(req: Request, perm: string): boolean {
  const staff = req.staff;
  if (!staff) return false;
  return checkPerm(staff, perm);
}
