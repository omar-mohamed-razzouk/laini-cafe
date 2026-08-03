import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { clearToken } from "@/lib/auth";
import { useSettings } from "@/hooks/use-settings";
import { usePermissions } from "@/hooks/use-permissions";
import type { PermKey } from "@/lib/permissions";
import {
  LayoutDashboard, Table2, DoorOpen, CalendarDays, Clock,
  ChefHat, Calculator, UtensilsCrossed, Package, Receipt,
  LineChart, Users, Settings, LogOut, UserCircle2, ShieldCheck, ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; icon: React.ElementType; en: string; ar: string; perm?: PermKey };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  icon: LayoutDashboard,  en: "Dashboard",      ar: "لوحة التحكم" },
  { href: "/tables",     icon: Table2,           en: "Tables",         ar: "الطاولات",         perm: "tables.view" },
  { href: "/rooms",      icon: DoorOpen,         en: "Rooms",          ar: "الغرف",             perm: "rooms.view" },
  { href: "/bookings",   icon: CalendarDays,     en: "Bookings",       ar: "الحجوزات",         perm: "bookings.view" },
  { href: "/sessions",   icon: Clock,            en: "Sessions",       ar: "الجلسات",           perm: "sessions.view" },
  { href: "/orders",     icon: ChefHat,          en: "Kitchen Orders", ar: "طلبات المطبخ",     perm: "orders.view" },
  { href: "/cashier",    icon: Calculator,       en: "Cashier",        ar: "الكاشير",           perm: "cashier.view" },
  { href: "/menu",       icon: UtensilsCrossed,  en: "Menu",           ar: "القائمة",           perm: "menu.view" },
  { href: "/inventory",  icon: Package,          en: "Inventory",      ar: "المخزون",           perm: "inventory.view" },
  { href: "/expenses",   icon: Receipt,          en: "Expenses",       ar: "المصروفات",         perm: "expenses.view" },
  { href: "/reports",    icon: LineChart,        en: "Reports",        ar: "التقارير",          perm: "reports.view" },
  { href: "/transactions", icon: ReceiptText,    en: "Transactions",   ar: "سجل المبيعات",     perm: "reports.view" },
  { href: "/customers",  icon: UserCircle2,      en: "Customers",      ar: "الزبائن الدائمون", perm: "customers.view" },
  { href: "/staff",      icon: Users,            en: "Staff",          ar: "الموظفين",          perm: "staff.view" },
  { href: "/settings",   icon: Settings,         en: "Settings",       ar: "الإعدادات",         perm: "settings.manage" },
];

const roleLabels: Record<string, string> = {
  admin: "مدير عام", manager: "مدير", cashier: "كاشير", waiter: "نادل", kitchen: "مطبخ",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const settings = useSettings();
  const { can, isAdmin, role } = usePermissions();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { clearToken(); setLocation("/welcome"); },
    });
  };

  const initial = (settings.cafeNameAr || settings.cafeName || "B").charAt(0);

  const visibleNav = NAV_ITEMS.filter((item) =>
    !item.perm || can(item.perm)
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      <aside className="w-64 bg-sidebar border-l border-sidebar-border flex flex-col justify-between shrink-0 h-full overflow-y-auto">
        <div>
          <div className="p-6 border-b border-sidebar-border">
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">
                {initial}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-base leading-none">{settings.cafeNameAr || settings.cafeName}</span>
                {settings.cafeNameAr && settings.cafeName && (
                  <span className="text-[11px] font-normal text-muted-foreground leading-none mt-0.5">{settings.cafeName}</span>
                )}
              </div>
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Café Command Center</p>
          </div>
          <nav className="p-4 space-y-1">
            {visibleNav.map((item) => {
              const active = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}>
                    <item.icon className="w-5 h-5 opacity-80" />
                    <div className="flex flex-col">
                      <span className="text-sm leading-none">{item.ar}</span>
                      <span className="text-[10px] opacity-70 leading-none mt-1">{item.en}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-sidebar-border space-y-2">
          {isAdmin && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              صلاحيات كاملة
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{user?.name || "Staff"}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {roleLabels[role ?? ""] ?? role ?? "..."}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-foreground capitalize tracking-wide">
              {NAV_ITEMS.find((n) => location === n.href || location.startsWith(n.href + "/"))?.ar || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            {new Date().toLocaleDateString("ar-SY-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8 z-0">
          {children}
        </div>
      </main>
    </div>
  );
}
