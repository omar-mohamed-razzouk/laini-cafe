import { Router } from "express";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { sessionGet, sessionSet, sessionDelete, sessionDeleteAll } from "../auth-store.js";

const router = Router();

const BCRYPT_ROUNDS = 12;
const LEGACY_SHA256_SALT = "brewdesk_salt";

export const KNOWN_DEFAULT_PASSWORDS = new Set([
  "admin123",
  "cash123",
  "wait123",
  "kit123",
  "mgr123",
]);

function legacyHash(password: string): string {
  return crypto.createHash("sha256").update(password + LEGACY_SHA256_SALT).digest("hex");
}

function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isLegacyHash(hash)) {
    const valid = legacyHash(password) === hash;
    return { valid, needsRehash: valid };
  }
  const valid = await bcrypt.compare(password, hash);
  return { valid, needsRehash: false };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل. / Too many attempts. Please try again later." },
  skipSuccessfulRequests: true,
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.username, username)).limit(1);

  if (!staff) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const { valid, needsRehash } = await verifyPassword(password, staff.passwordHash);

  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!staff.isActive) {
    return res.status(403).json({ error: "Account is inactive" });
  }

  if (KNOWN_DEFAULT_PASSWORDS.has(password)) {
    return res.status(403).json({
      error: "يجب تغيير كلمة المرور الافتراضية قبل الدخول",
      code: "DEFAULT_PASSWORD",
    });
  }

  if (needsRehash) {
    const newHash = await hashPassword(password);
    await db.update(staffTable).set({ passwordHash: newHash }).where(eq(staffTable.id, staff.id));
  }

  const token = generateToken();
  await sessionSet(token, staff.id);

  const { passwordHash: _, ...safeStaff } = staff;
  return res.json({
    staff: { ...safeStaff, createdAt: staff.createdAt.toISOString() },
    token,
  });
});

router.post("/auth/force-change-password", loginLimiter, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body ?? {};
  if (
    typeof username !== "string" ||
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string"
  ) {
    return res.status(400).json({ error: "username, currentPassword and newPassword required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
  }
  if (KNOWN_DEFAULT_PASSWORDS.has(newPassword)) {
    return res.status(400).json({ error: "لا يمكن استخدام كلمة مرور افتراضية معروفة" });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تختلف عن الحالية" });
  }
  if (!KNOWN_DEFAULT_PASSWORDS.has(currentPassword)) {
    return res.status(403).json({
      error: "هذه الخدمة مخصصة لتغيير كلمات المرور الافتراضية فقط. استخدم تغيير كلمة المرور من داخل التطبيق.",
    });
  }

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.username, username)).limit(1);
  if (!staff) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const { valid } = await verifyPassword(currentPassword, staff.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!staff.isActive) {
    return res.status(403).json({ error: "Account is inactive" });
  }

  const newHash = await hashPassword(newPassword);
  await db.update(staffTable).set({ passwordHash: newHash }).where(eq(staffTable.id, staff.id));

  await sessionDeleteAll(staff.id);
  const token = generateToken();
  await sessionSet(token, staff.id);

  req.log.info({ staffId: staff.id }, "staff replaced default password via forced change");

  const { passwordHash: _, ...safeStaff } = staff;
  return res.json({
    staff: { ...safeStaff, createdAt: staff.createdAt.toISOString() },
    token,
  });
});

router.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    await sessionDelete(authHeader.slice(7));
  }
  return res.json({ ok: true });
});

router.get("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  const staffId = await sessionGet(token);
  if (!staffId) return res.status(401).json({ error: "Invalid or expired token" });

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  if (!staff) return res.status(404).json({ error: "Not found" });

  const { passwordHash: _, ...safeStaff } = staff;
  return res.json({ ...safeStaff, createdAt: staff.createdAt.toISOString() });
});

router.post("/auth/change-password", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  const staffId = await sessionGet(token);
  if (!staffId) return res.status(401).json({ error: "Invalid or expired token" });

  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "currentPassword and newPassword required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
  }
  if (KNOWN_DEFAULT_PASSWORDS.has(newPassword)) {
    return res.status(400).json({ error: "لا يمكن استخدام كلمة مرور افتراضية معروفة" });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تختلف عن الحالية" });
  }

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  if (!staff || !staff.isActive) {
    return res.status(401).json({ error: "Account inactive or not found" });
  }

  const { valid } = await verifyPassword(currentPassword, staff.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
  }

  const newHash = await hashPassword(newPassword);
  await db.update(staffTable).set({ passwordHash: newHash }).where(eq(staffTable.id, staff.id));

  await sessionDeleteAll(staff.id);
  const freshToken = crypto.randomBytes(32).toString("hex");
  await sessionSet(freshToken, staff.id);

  req.log.info({ staffId: staff.id }, "staff changed own password");
  return res.json({ message: "تم تغيير كلمة المرور بنجاح", token: freshToken });
});

export default router;
