import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, KNOWN_DEFAULT_PASSWORDS } from "./routes/auth.js";
import { logger } from "./lib/logger";

const ADMIN_USERNAME = process.env["ADMIN_USERNAME"] || "admin";

function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

export async function ensureAdmin(): Promise<void> {
  const password = process.env["ADMIN_PASSWORD"];
  if (!password) {
    logger.warn("ADMIN_PASSWORD is not set; skipping admin bootstrap");
    return;
  }

  if (KNOWN_DEFAULT_PASSWORDS.has(password)) {
    logger.error(
      "ADMIN_PASSWORD is a blocked default password; refusing to bootstrap admin. Choose a different ADMIN_PASSWORD.",
    );
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.username, ADMIN_USERNAME))
      .limit(1);

    if (!existing) {
      await db.insert(staffTable).values({
        name: "Administrator",
        username: ADMIN_USERNAME,
        role: "admin",
        passwordHash: await hashPassword(password),
        isActive: true,
      });
      logger.info({ username: ADMIN_USERNAME }, "Bootstrapped admin account from ADMIN_PASSWORD");
      return;
    }

    if (isLegacyHash(existing.passwordHash)) {
      await db
        .update(staffTable)
        .set({ passwordHash: await hashPassword(password) })
        .where(eq(staffTable.id, existing.id));
      logger.info({ username: ADMIN_USERNAME }, "Reset legacy admin password from ADMIN_PASSWORD");
    }
  } catch (err) {
    logger.error({ err }, "Admin bootstrap failed");
  }
}
