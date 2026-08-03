import { useLocation } from "wouter";
import { useEffect } from "react";
import { getToken, getStoredUser } from "@/lib/auth";
import { can, type PermKey } from "@/lib/permissions";
import AppLayout from "@/components/layout/AppLayout";

interface Props {
  component: React.ComponentType;
  path: string;
  perm?: PermKey;
}

export default function ProtectedRoute({ component: Component, perm }: Props) {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser();

  useEffect(() => {
    if (!token) setLocation("/welcome");
  }, [token, setLocation]);

  if (!token) return null;

  if (perm && !can(user, perm)) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold">غير مصرح / Unauthorized</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            ليس لديك صلاحية للوصول إلى هذه الصفحة. تواصل مع المدير لمنحك الصلاحية المطلوبة.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}
