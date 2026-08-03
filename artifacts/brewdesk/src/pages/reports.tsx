import { useGetReportSummary, useGetPopularItems, useGetStaffPerformance, useGetCancellationsReport } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, Coffee, Ban, Printer } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { getSettings } from "@/lib/settings";

const PERIOD_LABELS: Record<string, string> = {
  daily: "يومي", weekly: "أسبوعي", monthly: "شهري", yearly: "سنوي",
};

export default function Reports() {
  const [period, setPeriod] = useState<"daily"|"weekly"|"monthly"|"yearly">("monthly");
  const { isAdmin, role } = usePermissions();
  const isManager = isAdmin || role === "manager";

  const handlePrint = () => window.print();

  const { data: summary, isLoading: loadingSummary } = useGetReportSummary({ period }, { query: { queryKey: ['reportSummary', period] } });
  const { data: popular, isLoading: loadingPopular } = useGetPopularItems();
  const { data: performance, isLoading: loadingPerformance } = useGetStaffPerformance();
  const { data: cancellations, isLoading: loadingCancellations } = useGetCancellationsReport(
    { period },
    { query: { queryKey: ['cancellationsReport', period], enabled: isManager } }
  );

  return (
    <div className="space-y-6" id="report-print-area">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #report-print-area, #report-print-area * { visibility: visible !important; }
          #report-print-area {
            position: absolute; left: 0; top: 0; width: 100%;
            background: #fff !important; color: #000 !important; padding: 16px;
          }
          #report-print-area .bg-card,
          #report-print-area .bg-muted\\/40,
          #report-print-area .bg-muted\\/30 { background: #fff !important; }
          #report-print-area * { color: #000 !important; border-color: #ccc !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="print-only mb-4 border-b border-gray-300 pb-3">
        <div className="text-xl font-bold">{getSettings().cafeNameAr || "BrewDesk"}</div>
        <div className="text-sm">تقرير {PERIOD_LABELS[period]} — {new Date().toLocaleDateString("ar-SY-u-nu-latn")}</div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">التقارير / Reports</h2>
          <p className="text-sm text-muted-foreground">Financial and operational analytics</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <Tabs value={period} onValueChange={(v: any) => setPeriod(v)} className="w-fit">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="daily">يومي</TabsTrigger>
              <TabsTrigger value="weekly">أسبوعي</TabsTrigger>
              <TabsTrigger value="monthly">شهري</TabsTrigger>
              <TabsTrigger value="yearly">سنوي</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" className="gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> طباعة / حفظ PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <span className="text-sm text-muted-foreground">الإيرادات / Revenue</span>
            <div className="text-2xl font-bold text-green-500 mt-2">{summary?.totalRevenue.toLocaleString("en-US") || 0} SYP</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <span className="text-sm text-muted-foreground">المصروفات / Expenses</span>
            <div className="text-2xl font-bold text-red-500 mt-2">{summary?.totalExpenses.toLocaleString("en-US") || 0} SYP</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 border-b-4 border-b-primary">
          <CardContent className="p-6">
            <span className="text-sm text-muted-foreground">صافي الربح / Net Profit</span>
            <div className="text-2xl font-bold text-primary mt-2">{summary?.netProfit.toLocaleString("en-US") || 0} SYP</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-6">
            <span className="text-sm text-muted-foreground">متوسط الطلب / Avg Order</span>
            <div className="text-2xl font-bold text-foreground mt-2">{summary?.avgOrderValue.toLocaleString("en-US") || 0} SYP</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">الإيرادات والمصروفات / Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loadingSummary ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.revenueByDay || []} margin={{ top: 10, right: 10, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="date" stroke="#888" tickFormatter={(v) => v.substring(5)} />
                  <YAxis stroke="#888" tickFormatter={(v) => `${v / 1000}k`} />
                  <RechartsTooltip cursor={{fill: '#333'}} contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="revenue" name="إيرادات (Revenue)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="مصروفات (Expenses)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Coffee className="w-5 h-5 text-primary" /> الأكثر مبيعاً / Popular Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPopular ? <Skeleton className="w-full h-48" /> : (
              <div className="space-y-4">
                {popular?.slice(0, 5).map((item, i) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-muted-foreground w-4">{i+1}.</div>
                      <div className="font-medium">{item.name}</div>
                    </div>
                    <div className="font-bold">{item.totalOrdered}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> أداء الموظفين / Staff Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الموظف / Staff</TableHead>
                <TableHead className="text-right">الطلبات / Orders</TableHead>
                <TableHead className="text-right">المبيعات / Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPerformance ? (
                <TableRow><TableCell colSpan={3} className="text-center">Loading...</TableCell></TableRow>
              ) : performance?.map(p => (
                <TableRow key={p.staffId}>
                  <TableCell className="font-medium">{p.staffName}</TableCell>
                  <TableCell>{p.orderCount}</TableCell>
                  <TableCell className="font-bold text-green-500">{p.totalSales.toLocaleString("en-US")} SYP</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isManager && (
        <Card className="bg-card border-border/50 border-r-4 border-r-red-500">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" /> الإلغاءات والحذف / Cancellations &amp; Deletions
              <span className="text-xs font-normal text-muted-foreground">(للمدير فقط)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingCancellations ? (
              <Skeleton className="w-full h-48" />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="p-4 rounded-lg bg-muted/40">
                    <div className="text-sm text-muted-foreground">طلبات ملغاة/محذوفة</div>
                    <div className="text-xl font-bold mt-1">{cancellations?.orders.count ?? 0}</div>
                    <div className="text-xs text-red-500">{(cancellations?.orders.total ?? 0).toLocaleString("en-US")} SYP</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/40">
                    <div className="text-sm text-muted-foreground">أصناف ملغاة</div>
                    <div className="text-xl font-bold mt-1">{cancellations?.items?.count ?? 0}</div>
                    <div className="text-xs text-red-500">{(cancellations?.items?.total ?? 0).toLocaleString("en-US")} SYP</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/40">
                    <div className="text-sm text-muted-foreground">أشخاص محذوفون</div>
                    <div className="text-xl font-bold mt-1">{cancellations?.guests?.count ?? 0}</div>
                    <div className="text-xs text-muted-foreground">بدون قيمة مالية</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/40">
                    <div className="text-sm text-muted-foreground">طاولات ملغاة</div>
                    <div className="text-xl font-bold mt-1">{cancellations?.tables.count ?? 0}</div>
                    <div className="text-xs text-red-500">{(cancellations?.tables.total ?? 0).toLocaleString("en-US")} SYP</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/40">
                    <div className="text-sm text-muted-foreground">غرف ملغاة</div>
                    <div className="text-xl font-bold mt-1">{cancellations?.rooms.count ?? 0}</div>
                    <div className="text-xs text-red-500">{(cancellations?.rooms.total ?? 0).toLocaleString("en-US")} SYP</div>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-sm text-muted-foreground">إجمالي القيمة الملغاة</div>
                    <div className="text-xl font-black text-red-500 mt-1">{(cancellations?.grandTotal ?? 0).toLocaleString("en-US")} SYP</div>
                  </div>
                </div>

                {cancellations && cancellations.details.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">التفاصيل</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">السبب</TableHead>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cancellations.details.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <Badge variant="outline" className={d.action === "deleted" ? "border-red-500/50 text-red-500" : "border-amber-500/50 text-amber-500"}>
                              {d.kind === "order"
                                ? "طلب"
                                : d.kind === "order_item"
                                ? "صنف"
                                : d.kind === "guest"
                                ? "شخص"
                                : d.resourceType === "room"
                                ? "غرفة"
                                : "طاولة"}{" "}
                              — {d.action === "deleted" ? "حذف" : d.action === "removed" ? "إزالة" : "إلغاء"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">{d.label}</TableCell>
                          <TableCell className="font-bold text-red-500">{d.amount.toLocaleString("en-US")} SYP</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{d.reason || "—"}</TableCell>
                          <TableCell className="text-sm">{d.staffName || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString("ar-SY-u-nu-latn")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-6">لا توجد إلغاءات في هذه الفترة</div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}