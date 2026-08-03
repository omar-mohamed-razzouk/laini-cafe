export type PermKey =
  | "tables.view" | "tables.manage"
  | "rooms.view" | "rooms.manage"
  | "bookings.view" | "bookings.manage"
  | "sessions.view"
  | "orders.view" | "orders.manage"
  | "cashier.view"
  | "menu.view" | "menu.manage"
  | "inventory.view" | "inventory.manage"
  | "expenses.view" | "expenses.manage"
  | "reports.view"
  | "customers.view" | "customers.manage"
  | "staff.view" | "staff.manage"
  | "settings.manage"
  | "data.reset";

export const PERMISSION_LABELS: Record<PermKey, { ar: string; en: string }> = {
  "tables.view":      { ar: "عرض الطاولات",        en: "View Tables" },
  "tables.manage":    { ar: "إدارة الطاولات",       en: "Manage Tables" },
  "rooms.view":       { ar: "عرض الغرف",            en: "View Rooms" },
  "rooms.manage":     { ar: "إدارة الغرف",          en: "Manage Rooms" },
  "bookings.view":    { ar: "عرض الحجوزات",         en: "View Bookings" },
  "bookings.manage":  { ar: "إدارة الحجوزات",       en: "Manage Bookings" },
  "sessions.view":    { ar: "عرض الجلسات",          en: "View Sessions" },
  "orders.view":      { ar: "عرض الطلبات",          en: "View Orders" },
  "orders.manage":    { ar: "إدارة الطلبات",        en: "Manage Orders" },
  "cashier.view":     { ar: "الكاشير",              en: "Cashier Access" },
  "menu.view":        { ar: "عرض القائمة",          en: "View Menu" },
  "menu.manage":      { ar: "تعديل القائمة",        en: "Manage Menu" },
  "inventory.view":   { ar: "عرض المخزون",          en: "View Inventory" },
  "inventory.manage": { ar: "تعديل المخزون",        en: "Manage Inventory" },
  "expenses.view":    { ar: "عرض المصروفات",        en: "View Expenses" },
  "expenses.manage":  { ar: "إدارة المصروفات",      en: "Manage Expenses" },
  "reports.view":     { ar: "عرض التقارير",         en: "View Reports" },
  "customers.view":   { ar: "عرض الزبائن",          en: "View Customers" },
  "customers.manage": { ar: "إدارة الزبائن",        en: "Manage Customers" },
  "staff.view":       { ar: "عرض الموظفين",         en: "View Staff" },
  "staff.manage":     { ar: "إدارة الموظفين",       en: "Manage Staff" },
  "settings.manage":  { ar: "إعدادات النظام",       en: "System Settings" },
  "data.reset":       { ar: "تصفير البيانات",        en: "Reset Data" },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as PermKey[];

export const PERMISSION_GROUPS: { label: string; keys: PermKey[] }[] = [
  { label: "الطاولات والغرف",   keys: ["tables.view", "tables.manage", "rooms.view", "rooms.manage"] },
  { label: "الحجوزات والجلسات", keys: ["bookings.view", "bookings.manage", "sessions.view"] },
  { label: "الطلبات والكاشير",  keys: ["orders.view", "orders.manage", "cashier.view"] },
  { label: "القائمة والمخزون",  keys: ["menu.view", "menu.manage", "inventory.view", "inventory.manage"] },
  { label: "المالية",           keys: ["expenses.view", "expenses.manage", "reports.view"] },
  { label: "الزبائن والموظفين", keys: ["customers.view", "customers.manage", "staff.view", "staff.manage"] },
  { label: "الإعدادات",         keys: ["settings.manage", "data.reset"] },
];

export const ROLE_DEFAULTS: Record<string, PermKey[]> = {
  admin: ALL_PERMISSIONS,
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

export type StoredUser = {
  id: number;
  name: string;
  role: string;
  permissions: Record<string, boolean> | null;
};

export function can(user: StoredUser | null, perm: PermKey): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.permissions && Object.keys(user.permissions).length > 0) {
    return user.permissions[perm] === true;
  }
  return (ROLE_DEFAULTS[user.role] ?? []).includes(perm);
}

export function getEffectivePermissions(user: StoredUser | null): Record<PermKey, boolean> {
  const result = {} as Record<PermKey, boolean>;
  for (const p of ALL_PERMISSIONS) {
    result[p] = can(user, p);
  }
  return result;
}
