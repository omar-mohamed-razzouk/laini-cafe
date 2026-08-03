import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { setupAuth, clearToken } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import type { PermKey } from "@/lib/permissions";

import OfflineBanner from "@/components/OfflineBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tables from "@/pages/tables";
import Rooms from "@/pages/rooms";
import Bookings from "@/pages/bookings";
import Sessions from "@/pages/sessions";
import Orders from "@/pages/orders";
import Cashier from "@/pages/cashier";
import Menu from "@/pages/menu";
import Inventory from "@/pages/inventory";
import Expenses from "@/pages/expenses";
import Reports from "@/pages/reports";
import Transactions from "@/pages/transactions";
import Staff from "@/pages/staff";
import Settings from "@/pages/settings";
import Customers from "@/pages/customers";

function getStatus(error: unknown): number | undefined {
  return (error as any)?.response?.status ?? (error as any)?.status;
}

function isNetworkError(error: unknown): boolean {
  // ApiError / ResponseParseError carry a numeric status; a failed fetch
  // (offline / connection refused) throws a TypeError with no status.
  if (getStatus(error) !== undefined) return false;
  return error instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

function handle401(error: unknown) {
  if (getStatus(error) === 401) {
    clearToken();
    if (!window.location.pathname.endsWith("/welcome")) {
      window.location.href = "/welcome";
    }
  }
}

function handleMutationError(error: unknown) {
  handle401(error);
  if (isNetworkError(error)) {
    toast({
      variant: "destructive",
      title: "لا يوجد اتصال بالإنترنت",
      description: "تعذّر حفظ التغييرات. حاول مرة أخرى بعد عودة الاتصال.",
    });
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = getStatus(error);
        if (status === 401 || status === 403) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
      refetchOnMount: "always",
      refetchInterval: 15000,
      refetchIntervalInBackground: false,
      staleTime: 10000,
      // Keep last-loaded data in memory for a full day so the UI keeps
      // showing it during internet outages instead of going blank.
      gcTime: 1000 * 60 * 60 * 24,
    },
    mutations: {
      // Attempt immediately and surface a clear error when offline rather
      // than silently hanging in a paused state.
      networkMode: "always",
    },
  },
  queryCache: new QueryCache({ onError: handle401 }),
  mutationCache: new MutationCache({ onError: handleMutationError }),
});

type ProtectedRouteProps = { path: string; component: React.ComponentType; perm?: PermKey };

function PR({ path, component, perm }: ProtectedRouteProps) {
  return <ProtectedRoute path={path} component={component} perm={perm} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/welcome" component={Login} />
      <Route path="/login"><Redirect to="/welcome" /></Route>
      <Route path="/dashboard"><PR path="/dashboard" component={Dashboard} /></Route>
      <Route path="/tables"><PR path="/tables" component={Tables} perm="tables.view" /></Route>
      <Route path="/rooms"><PR path="/rooms" component={Rooms} perm="rooms.view" /></Route>
      <Route path="/bookings"><PR path="/bookings" component={Bookings} perm="bookings.view" /></Route>
      <Route path="/sessions"><PR path="/sessions" component={Sessions} perm="sessions.view" /></Route>
      <Route path="/orders"><PR path="/orders" component={Orders} perm="orders.view" /></Route>
      <Route path="/cashier"><PR path="/cashier" component={Cashier} perm="cashier.view" /></Route>
      <Route path="/menu"><PR path="/menu" component={Menu} perm="menu.view" /></Route>
      <Route path="/inventory"><PR path="/inventory" component={Inventory} perm="inventory.view" /></Route>
      <Route path="/expenses"><PR path="/expenses" component={Expenses} perm="expenses.view" /></Route>
      <Route path="/reports"><PR path="/reports" component={Reports} perm="reports.view" /></Route>
      <Route path="/transactions"><PR path="/transactions" component={Transactions} perm="reports.view" /></Route>
      <Route path="/staff"><PR path="/staff" component={Staff} perm="staff.view" /></Route>
      <Route path="/settings"><PR path="/settings" component={Settings} perm="settings.manage" /></Route>
      <Route path="/customers"><PR path="/customers" component={Customers} perm="customers.view" /></Route>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route>
        <div className="flex h-screen items-center justify-center bg-background">
          <h1 className="text-4xl font-bold text-muted-foreground">404 - Not Found</h1>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  useEffect(() => { setupAuth(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OfflineBanner />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
