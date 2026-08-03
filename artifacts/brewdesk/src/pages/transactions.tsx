import { useState } from "react";
import { useGetTransactionsReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ReceiptText, Printer, Coffee, Clock, Percent, SlidersHorizontal } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { fmtNum, fmtDate, fmtDateTime } from "@/lib/format";

const PERIOD_LABELS: Record<string, string> = {
  daily: "يومي", weekly: "أسبوعي", monthly: "شهري", yearly: "سنوي",
};

export default function Transactions() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading } = useGetTransactionsReport(
    { period },
    { query: { queryKey: ["transactionsReport", period] } }
  );

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6" id="tx-print-area">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #tx-print-area, #tx-print-area * { visibility: visible !important; }
          #tx-print-area { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; padding: 16px; }
          #tx-print-area * { color: #000 !important; border-color: #ccc !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="print-only mb-4 border-b border-gray-300 pb-3">
        <div className="text-xl font-bold">{getSettings().cafeNameAr || "BrewDesk"}</div>
        <div className="text-sm">سجل المبيعات {PERIOD_LABELS[period]} — {fmtDate(new Date())}</div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">سجل المبيعات / Transactions</h2>
          <p className="text-sm text-muted-foreground">كل ما تم بيعه خلال الفترة — فواتير وتفاصيلها</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)} className="w-fit">
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

      {isLoading ? (
        <Skeleton className="w-full h-64" />
      ) : !data ? (
        <div className="text-center py-12 text-muted-foreground">تعذر تحميل البيانات</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><ReceiptText className="w-3.5 h-3.5" /> عدد الفواتير</div>
                <div className="text-xl font-bold mt-1">{fmtNum(data.invoiceCount)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 border-b-4 border-b-primary">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">إجمالي المبيعات</div>
                <div className="text-xl font-bold text-primary mt-1">{fmtNum(data.totalRevenue)} SYP</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> إيراد الوقت/الحجز</div>
                <div className="text-xl font-bold text-blue-400 mt-1">{fmtNum(data.timeRevenue)} SYP</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Coffee className="w-3.5 h-3.5" /> إيراد المنتجات</div>
                <div className="text-xl font-bold text-green-500 mt-1">{fmtNum(data.productRevenue)} SYP</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><SlidersHorizontal className="w-3.5 h-3.5" /> تعديلات السعر</div>
                <div className={`text-xl font-bold mt-1 ${data.adjustments < 0 ? "text-yellow-500" : "text-green-500"}`}>{fmtNum(data.adjustments)} SYP</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> الخصومات</div>
                <div className="text-xl font-bold text-red-400 mt-1">{fmtNum(data.totalDiscounts)} SYP</div>
              </CardContent>
            </Card>
          </div>

          {data.topItems.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-base">الأصناف الأكثر مبيعاً في الفترة</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.topItems.map((it) => (
                    <Badge key={it.name} variant="outline" className="text-xs py-1 px-2.5">
                      {it.name} <span className="font-bold mx-1">×{fmtNum(it.quantity)}</span>
                      <span className="text-primary font-bold">{fmtNum(it.total)} SYP</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">الفواتير ({fmtNum(data.invoiceCount)})</CardTitle>
            </CardHeader>
            <CardContent>
              {data.details.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد مبيعات في هذه الفترة</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المكان</TableHead>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">الدفع</TableHead>
                      <TableHead className="text-right">الخصم</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">المدفوع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.details.map((d) => (
                      <>
                        <TableRow
                          key={d.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                        >
                          <TableCell className="font-mono text-xs">{fmtNum(d.id)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(d.createdAt)}</TableCell>
                          <TableCell className="text-sm">{d.resourceName || "—"}</TableCell>
                          <TableCell className="text-sm">{d.customerName || "—"}</TableCell>
                          <TableCell className="text-sm">{d.staffName || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {d.paymentMethod === "cash" ? "كاش" : d.paymentMethod === "card" ? "بطاقة" : "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-red-400">{d.discountAmount ? `${fmtNum(d.discountAmount)}` : "—"}</TableCell>
                          <TableCell className="font-bold text-primary whitespace-nowrap">{fmtNum(d.total)} SYP</TableCell>
                          <TableCell className="font-medium whitespace-nowrap text-green-500">{d.amountPaid != null ? `${fmtNum(d.amountPaid)} SYP` : "—"}</TableCell>
                        </TableRow>
                        {expanded === d.id && (
                          <TableRow key={`${d.id}-items`} className="bg-muted/20">
                            <TableCell colSpan={9} className="p-3">
                              <div className="space-y-1 text-sm">
                                {d.items.map((it, i) => (
                                  <div key={i} className="flex justify-between">
                                    <span>{it.description} <span className="text-muted-foreground text-xs">×{fmtNum(it.quantity)}</span></span>
                                    <span className="font-medium">{fmtNum(it.subtotal)} SYP</span>
                                  </div>
                                ))}
                                <div className="pt-2 mt-2 border-t border-border/50 space-y-0.5 text-xs">
                                  <div className="flex justify-between"><span className="text-muted-foreground">المجموع قبل الخصم</span><span>{fmtNum(d.subtotal)} SYP</span></div>
                                  {d.discountAmount ? <div className="flex justify-between text-red-400"><span>الخصم</span><span>-{fmtNum(d.discountAmount)}</span></div> : null}
                                  <div className="flex justify-between font-bold"><span>الإجمالي النهائي</span><span className="text-primary">{fmtNum(d.total)} SYP</span></div>
                                  {d.amountPaid != null && (
                                    <div className="flex justify-between text-green-500 font-bold"><span>المبلغ المدفوع</span><span>{fmtNum(d.amountPaid)} SYP</span></div>
                                  )}
                                </div>
                                {d.guestCount != null && (
                                  <div className="text-xs text-muted-foreground pt-1 border-t border-border/50 mt-2">
                                    عدد الأشخاص: {fmtNum(d.guestCount)}
                                    {d.sessionStart ? ` — من ${fmtDateTime(d.sessionStart)}` : ""}
                                    {d.sessionEnd ? ` إلى ${fmtDateTime(d.sessionEnd)}` : ""}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
