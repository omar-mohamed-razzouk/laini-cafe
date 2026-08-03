import { db } from "@workspace/db";
import { authTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function sessionGet(token: string): Promise<number | undefined> {
  const [row] = await db
    .select({ staffId: authTokensTable.staffId, expiresAt: authTokensTable.expiresAt })
    .from(authTokensTable)
    .where(eq(authTokensTable.token, token))
    .limit(1);
  if (!row) return undefined;
  if (row.expiresAt && row.expiresAt < new Date()) {
    await sessionDelete(token);
    return undefined;
  }
  return row.staffId;
}

export async function sessionSet(token: string, staffId: number): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(authTokensTable).values({ token, staffId, expiresAt }).onConflictDoNothing();
}

export async function sessionDelete(token: string): Promise<void> {
  await db.delete(authTokensTable).where(eq(authTokensTable.token, token));
}

export async function sessionDeleteAll(staffId: number): Promise<void> {
  await db.delete(authTokensTable).where(eq(authTokensTable.staffId, staffId));
}
