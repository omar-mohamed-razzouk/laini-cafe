import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Armchair, DoorOpen, Banknote, ChefHat, CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ 
  titleAr, titleEn, value, icon: Icon, colorClass, loading 
}: { 
  titleAr: string, titleEn: string, value: string | number, icon: any, colorClass: string, loading: boolean 
}) {
  return (
    <Card className="bg-card/50 border-border/50 hover:bg-card hover:border-border transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col">
          <CardTitle className="text-sm font-bold text-foreground">{titleAr}</CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{titleEn}</span>
        </div>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20 mt-1" />
        ) : (
          <div className="text-3xl font-black text-foreground mt-1 tracking-tight">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        <StatCard
          titleAr="إيرادات اليوم"
          titleEn="Today's Revenue"
          value={stats ? `${stats.todayRevenue.toLocaleString("en-US")} SYP` : "0"}
          icon={Banknote}
          colorClass="bg-green-500/20 text-green-500"
          loading={isLoading}
        />
        
        <StatCard
          titleAr="صافي الربح"
          titleEn="Net Profit"
          value={stats ? `${stats.todayNetProfit.toLocaleString("en-US")} SYP` : "0"}
          icon={Banknote}
          colorClass="bg-primary/20 text-primary"
          loading={isLoading}
        />

        <StatCard
          titleAr="الجلسات النشطة"
          titleEn="Active Sessions"
          value={stats?.activeSessionsCount || 0}
          icon={Users}
          colorClass="bg-blue-500/20 text-blue-500"
          loading={isLoading}
        />

        <StatCard
          titleAr="طلبات قيد الانتظار"
          titleEn="Pending Orders"
          value={stats?.pendingOrdersCount || 0}
          icon={ChefHat}
          colorClass="bg-orange-500/20 text-orange-500"
          loading={isLoading}
        />

        <StatCard
          titleAr="الطاولات المشغولة"
          titleEn="Occupied Tables"
          value={stats ? `${stats.occupiedTablesCount} / ${stats.availableTablesCount + stats.occupiedTablesCount + stats.reservedTablesCount}` : "0"}
          icon={Armchair}
          colorClass="bg-red-500/20 text-red-500"
          loading={isLoading}
        />

        <StatCard
          titleAr="الغرف المشغولة"
          titleEn="Occupied Rooms"
          value={stats ? `${stats.occupiedRoomsCount} / ${stats.availableRoomsCount + stats.occupiedRoomsCount}` : "0"}
          icon={DoorOpen}
          colorClass="bg-purple-500/20 text-purple-500"
          loading={isLoading}
        />

        <StatCard
          titleAr="إجمالي الضيوف"
          titleEn="Total Guests Now"
          value={stats?.totalGuestsNow || 0}
          icon={Users}
          colorClass="bg-emerald-500/20 text-emerald-500"
          loading={isLoading}
        />

        <StatCard
          titleAr="حجوزات قادمة"
          titleEn="Upcoming Bookings"
          value={stats?.upcomingBookingsCount || 0}
          icon={CalendarClock}
          colorClass="bg-amber-500/20 text-amber-500"
          loading={isLoading}
        />

      </div>
    </div>
  );
}