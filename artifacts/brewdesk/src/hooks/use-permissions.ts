import { useGetMe } from "@workspace/api-client-react";
import { can, ROLE_DEFAULTS, type PermKey, type StoredUser } from "@/lib/permissions";
import { setStoredUser, getStoredUser } from "@/lib/auth";
import { useEffect } from "react";

function buildStoredUser(me: any): StoredUser | null {
  if (!me) return null;
  return { id: me.id, name: me.name, role: me.role, permissions: me.permissions ?? null };
}

export function usePermissions() {
  const { data: me, isLoading } = useGetMe();

  useEffect(() => {
    if (me) {
      const u = buildStoredUser(me);
      if (u) setStoredUser(u);
    }
  }, [me]);

  const freshUser = me ? buildStoredUser(me) : null;
  const storedUser = getStoredUser();

  const user: StoredUser | null = freshUser ?? storedUser;

  return {
    user,
    isLoading: isLoading && !storedUser,
    role: user?.role ?? null,
    isAdmin: user?.role === "admin",
    can: (perm: PermKey) => can(user, perm),
    canAny: (...perms: PermKey[]) => perms.some((p) => can(user, p)),
    defaultPerms: (role: string) => ROLE_DEFAULTS[role] ?? [],
  };
}
