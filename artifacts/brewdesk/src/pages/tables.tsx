import { intVal, numVal } from "@/lib/format";
import { useState, useEffect } from "react";
import {
  useListTables,
  useUpdateTable,
  useCreateSession,
  useEndSession,
  useCancelSession,
  useListSessions,
  useListCustomers,
  useGetSessionBill,
  useListOrders,
  useCancelOrderItem,
  useRemoveGuest,
  getGetSessionBillQueryKey,
  getListOrdersQueryKey,
  getListTablesQueryKey,
  getListSessionsQueryKey,
  Invoice,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Armchair, Play, Receipt, Users, Clock, Settings2, Eye, XCircle, UserMinus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStaffId } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PrintReceipt } from "@/components/PrintReceipt";
import { usePermissions } from "@/hooks/use-permissions";

type TableRow = { id: number; number: number; capacity: number; type: string; status: string; hourlyRate: number };

const statusColors: Record<string, string> = {
  available: "bg-green-500/20 text-green-500 border-green-500/50",
  reserved: "bg-amber-500/20 text-amber-500 border-amber-500/50",
  occupied: "bg-red-500/20 text-red-500 border-red-500/50",
};
const statusLabels: Record<string, string> = { available: "متاح", reserved: "محجوز", occupied: "مشغول" };
const cardBg: Record<string, string> = {
  available: "bg-card/60 hover:border-green-500/40",
  reserved: "bg-amber-500/5 hover:border-amber-500/40",
  occupied: "bg-red-500/5 hover:border-red-500/30",
};

function LiveElapsed({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startTime]);
  return <span className="font-mono font-black tracking-widest text-primary">{elapsed}</span>;
}

function TableContents({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: bill, isLoading } = useGetSessionBill(sessionId, { query: { refetchInterval: 10000, queryKey: getGetSessionBillQueryKey(sessionId) } });
  const { data: orders } = useListOrders({ sessionId }, { query: { queryKey: getListOrdersQueryKey({ sessionId }) } });

  const cancelItem = useCancelOrderItem();
  const removeGuest = useRemoveGuest();

  const [pendingItem, setPendingItem] = useState<{ orderId: number; itemId: number; name: string } | null>(null);
  const [itemReason, setItemReason] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetSessionBillQueryKey(sessionId) });
    qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ sessionId }) });
    qc.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    qc.invalidateQueries({ queryKey: getListTablesQueryKey() });
  };

  const confirmCancelItem = () => {
    if (!pendingItem) return;
    cancelItem.mutate(
      { orderId: pendingItem.orderId, itemId: pendingItem.itemId, data: { reason: itemReason || undefined } },
      {
        onSuccess: () => { toast({ title: "تم إلغاء الصنف" }); setPendingItem(null); setItemReason(""); refresh(); },
        onError: () => toast({ title: "تعذّر إلغاء الصنف", variant: "destructive" }),
      },
    );
  };

  const handleRemoveGuest = () => {
    removeGuest.mutate(
      { id: sessionId, data: {} },
      {
        onSuccess: () => { toast({ title: "تم حذف شخص من الطاولة" }); refresh(); },
        onError: () => toast({ title: "تعذّر حذف الشخص", variant: "destructive" }),
      },
    );
  };

  if (isLoading || !bill) return <div className="py-6 text-center text-muted-foreground text-sm">جارٍ التحميل…</div>;

  const activeOrders = (orders ?? []).filter((o) => o.status !== "cancelled" && o.items.length > 0);

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
        <div className="text-sm text-muted-foreground">الوقت المنقضي</div>
        <LiveElapsed startTime={bill.startTime} />
      </div>
      {bill.guestCount != null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">عدد الضيوف</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{bill.guestCount}</span>
            {bill.guestCount > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                onClick={handleRemoveGuest}
                disabled={removeGuest.isPending}
              >
                <UserMinus className="w-3.5 h-3.5 ml-1" /> حذف شخص
              </Button>
            )}
          </div>
        </div>
      )}
      {bill.billingMode === "per_person" && bill.timeCost > 0 && bill.guestCount ? (
        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
          <span className="text-muted-foreground">كل شخص يدفع للزمن</span>
          <span className="font-bold text-primary">
            {Math.round(bill.timeCost / bill.guestCount).toLocaleString("en-US")} ل.س
            <span className="text-xs text-muted-foreground font-normal"> × {bill.guestCount} شخص</span>
          </span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="text-xs font-bold text-muted-foreground">التفاصيل</div>
        {bill.items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">لا يوجد طلبات أو حجز زمني بعد</div>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {bill.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between px-3 py-2 text-sm">
                <div className="flex-1 pl-2">
                  <div>{item.description}</div>
                  <div className="text-[11px] text-muted-foreground">{item.quantity} × {item.unitPrice.toLocaleString("en-US")} ل.س</div>
                </div>
                <span className="font-medium whitespace-nowrap">{item.subtotal.toLocaleString("en-US")} ل.س</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeOrders.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-muted-foreground">إلغاء صنف من الطلبات</div>
          <div className="border border-border rounded-lg divide-y divide-border">
            {activeOrders.flatMap((o) =>
              o.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                  <div className="flex-1">
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold text-xs ml-1">{it.quantity}×</span>
                    {it.menuItemName}
                    <span className="text-[11px] text-muted-foreground"> — {it.subtotal.toLocaleString("en-US")} ل.س</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-red-500 hover:bg-red-500/10"
                    onClick={() => { setPendingItem({ orderId: o.id, itemId: it.id, name: it.menuItemName }); setItemReason(""); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )),
            )}
          </div>
          {pendingItem && (
            <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-3 space-y-2">
              <div className="text-sm">إلغاء «{pendingItem.name}»؟</div>
              <Input
                value={itemReason}
                onChange={(e) => setItemReason(e.target.value)}
                placeholder="سبب الإلغاء (اختياري)"
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" className="flex-1" onClick={confirmCancelItem} disabled={cancelItem.isPending}>
                  تأكيد الإلغاء
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPendingItem(null); setItemReason(""); }}>
                  تراجع
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1 text-sm">
        {bill.timeCost > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>إجمالي الحجز الزمني</span>
            <span>{bill.timeCost.toLocaleString("en-US")} ل.س</span>
          </div>
        )}
        {bill.orderCost > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>إجمالي الطلبات</span>
            <span>{bill.orderCost.toLocaleString("en-US")} ل.س</span>
          </div>
        )}
        <div className="flex justify-between items-center border-t border-border pt-2 mt-1">
          <span className="font-bold">المبلغ المستحق</span>
          <span className="text-2xl font-black text-primary">{bill.total.toLocaleString("en-US")} ل.س</span>
        </div>
      </div>
    </div>
  );
}

export default function Tables() {
  const { data: tables, isLoading } = useListTables();
  const { data: sessions } = useListSessions({ query: { refetchInterval: 15000, queryKey: getListSessionsQueryKey() } });
  const { data: customers } = useListCustomers();
  const createSession = useCreateSession();
  const endSession = useEndSession();
  const cancelSession = useCancelSession();
  const updateTable = useUpdateTable();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rateOpen, setRateOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [guestCount, setGuestCount] = useState("2");
  const [billingMode, setBillingMode] = useState<"flat" | "per_person">("flat");
  const [perPersonRate, setPerPersonRate] = useState("40");
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [finalTotal, setFinalTotal] = useState("");
  const { can } = usePermissions();
  const canOverride = can("cashier.view");
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [newRate, setNewRate] = useState("0");

  // Deduplicate defensively: overlapping refetches or duplicate rows must never
  // render the same table card twice.
  const uniqueTables = (tables ?? []).filter(
    (t, i, arr) => arr.findIndex((x) => x.id === t.id) === i
  );

  const getSessionForTable = (tableId: number) => {
    const active = (sessions ?? []).filter(
      (s) => s.type === "table" && s.resourceId === tableId && s.status === "active"
    );
    if (active.length <= 1) return active[0];
    // If duplicates exist, use the most recent session.
    return active.slice().sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
  };

  const handleTableClick = (table: TableRow) => {
    setSelected(table);
    if (table.status === "available") {
      setGuestCount("2"); setBillingMode("flat"); setPerPersonRate("40"); setNotes(""); setCustomerSearch(""); setSelectedCustomerId(null); setStartOpen(true);
    } else if (table.status === "occupied") {
      const session = getSessionForTable(table.id);
      if (session) setViewOpen(true);
    }
  };

  const openPayment = () => {
    if (!selected) return;
    const session = getSessionForTable(selected.id);
    if (!session) return;
    setAmountPaid(String(Math.ceil(session.currentCost)));
    setFinalTotal("");
    setPayMethod("cash");
    setViewOpen(false);
    setEndOpen(true);
  };

  const openCancel = () => {
    setCancelReason("");
    setViewOpen(false);
    setCancelOpen(true);
  };

  const handleCancelSession = () => {
    if (!selected) return;
    const session = getSessionForTable(selected.id);
    if (!session) return;
    cancelSession.mutate(
      { id: session.id, data: { reason: cancelReason || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setCancelOpen(false);
          toast({ title: "تم إلغاء الجلسة", description: `طاولة ${selected.number} — بدون فاتورة` });
        },
        onError: () => toast({ title: "خطأ", description: "فشل إلغاء الجلسة", variant: "destructive" }),
      }
    );
  };

  const openRateEdit = (table: TableRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(table); setNewRate(String(table.hourlyRate)); setRateOpen(true);
  };

  const handleStart = () => {
    if (!selected) return;
    const customer = customers?.find((c) => c.id === selectedCustomerId);
    createSession.mutate(
      { data: { type: "table", resourceId: selected.id, guestCount: intVal(guestCount) || 1, billingMode, perPersonRate: billingMode === "per_person" ? (numVal(perPersonRate) || 0) : undefined, staffId: getStaffId(), notes, customerId: selectedCustomerId ?? undefined, customerName: customer?.name ?? undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setStartOpen(false);
          toast({ title: "بدأت الجلسة", description: `طاولة ${selected.number}${customer ? ` — ${customer.name}` : ""}` });
        },
        onError: () => toast({ title: "خطأ", description: "فشل بدء الجلسة", variant: "destructive" }),
      }
    );
  };

  const handleEnd = () => {
    if (!selected) return;
    const session = getSessionForTable(selected.id);
    if (!session) return;
    const computedDue = session.currentCost;
    const finalDue = finalTotal.trim() === "" ? computedDue : Math.max(0, Math.round(numVal(finalTotal) || 0));
    const override = canOverride && finalDue !== computedDue ? { overrideTotal: finalDue } : {};
    const paid = numVal(amountPaid) || finalDue;
    endSession.mutate(
      { id: session.id, data: { paymentMethod: payMethod, amountPaid: paid, ...override } },
      {
        onSuccess: (inv) => {
          queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setEndOpen(false);
          setInvoice(inv);
          if (getSettings().printAutomatically) { setReceiptOpen(true); setTimeout(() => window.print(), 300); }
          else setReceiptOpen(true);
          toast({ title: "تم إغلاق الجلسة وإصدار الفاتورة" });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  const handleRateSave = () => {
    if (!selected) return;
    updateTable.mutate(
      { id: selected.id, data: { hourlyRate: numVal(newRate) || 0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
          setRateOpen(false);
          toast({ title: `تم تحديث سعر الساعة للطاولة ${selected.number}` });
        },
      }
    );
  };

  const filteredCustomers = customers?.filter((c) =>
    c.name.includes(customerSearch) || (c.phone ?? "").includes(customerSearch)
  ) ?? [];

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 11 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">الطاولات / Tables</h2>
          <p className="text-sm text-muted-foreground">اضغط على الطاولة لبدء أو إنهاء جلسة | اضغط ⚙ لتعيين سعر الساعة</p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          {Object.entries(statusLabels).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full inline-block ${k === "available" ? "bg-green-500" : k === "reserved" ? "bg-amber-500" : "bg-red-500"}`} />
              {v}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {uniqueTables.map((table) => {
          const session = getSessionForTable(table.id);
          return (
            <Card key={table.id} onClick={() => handleTableClick(table)}
              className={`cursor-pointer border transition-all hover:scale-105 relative ${cardBg[table.status]}`}>
              <button
                onClick={(e) => openRateEdit(table, e)}
                className="absolute top-2 left-2 w-6 h-6 rounded bg-muted/60 hover:bg-muted flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity z-10"
                title="تعديل سعر الساعة"
              >
                <Settings2 className="w-3 h-3" />
              </button>
              <CardHeader className="pb-2 flex flex-row items-start justify-between p-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Armchair className="w-5 h-5" /></div>
                <Badge variant="outline" className={`text-[10px] ${statusColors[table.status]}`}>{statusLabels[table.status]}</Badge>
              </CardHeader>
              <CardContent className="px-3 pb-1">
                <div className="text-3xl font-black">{table.number}</div>
                <div className="text-[10px] text-muted-foreground uppercase">{table.type}</div>
              </CardContent>
              <CardFooter className="px-3 pb-3 flex flex-col items-start gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {table.capacity} مقاعد</span>
                {table.hourlyRate > 0 && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{table.hourlyRate.toLocaleString("en-US")} SYP/ساعة</span>
                )}
                {session && <span className="text-xs font-bold text-primary">{session.currentCost.toLocaleString("en-US")} SYP</span>}
                <span className="text-[10px] text-primary/70 mt-0.5 flex items-center gap-1">
                  {table.status === "available" ? "← بدء جلسة" : table.status === "occupied" ? <><Eye className="w-2.5 h-2.5" />عرض محتوى الطاولة</> : ""}
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Set Hourly Rate Dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>سعر الساعة — طاولة {selected?.number}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>سعر الساعة (SYP) — 0 = بدون احتساب وقت</Label>
              <Input type="number" min={0} value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="400" />
            </div>
            <p className="text-xs text-muted-foreground">مثال: 400 SYP/ساعة — التكلفة = وقت الجلوس × السعر + الطلبات</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateOpen(false)}>إلغاء</Button>
            <Button onClick={handleRateSave} disabled={updateTable.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Session */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>بدء جلسة — طاولة {selected?.number}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>عدد الضيوف</Label>
              <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>نوع الحساب</Label>
              <div className="flex gap-2">
                <Button type="button" variant={billingMode === "flat" ? "default" : "outline"} className="flex-1" onClick={() => setBillingMode("flat")}>عادي / حسب الطاولة</Button>
                <Button type="button" variant={billingMode === "per_person" ? "default" : "outline"} className="flex-1" onClick={() => setBillingMode("per_person")}>حجز زمني / لكل شخص</Button>
              </div>
            </div>
            {billingMode === "per_person" && (
              <div className="space-y-1.5">
                <Label>سعر الساعة لكل شخص (SYP)</Label>
                <Input type="number" min={0} value={perPersonRate} onChange={(e) => setPerPersonRate(e.target.value)} placeholder="40" />
                <p className="text-xs text-muted-foreground">
                  التكلفة = {(numVal(perPersonRate) || 0).toLocaleString("en-US")} × {intVal(guestCount) || 1} شخص × عدد الساعات + الطلبات
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>زبون دائم (اختياري)</Label>
              <Input placeholder="ابحث بالاسم أو الهاتف..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(null); }} />
              {customerSearch && filteredCustomers.length > 0 && !selectedCustomerId && (
                <div className="border border-border rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                  {filteredCustomers.slice(0, 5).map((c) => (
                    <button key={c.id} className="w-full text-right px-3 py-2 hover:bg-muted/50 text-sm flex justify-between" onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); }}>
                      <span>{c.name}</span>
                      <span className="text-muted-foreground text-xs">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomerId && (
                <div className="flex items-center gap-2 p-2 bg-primary/10 rounded text-sm text-primary">
                  <span>✓ {customerSearch}</span>
                  <button className="text-xs underline mr-auto" onClick={() => { setSelectedCustomerId(null); setCustomerSearch(""); }}>إلغاء</button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." />
            </div>
            {billingMode === "flat" && selected && selected.hourlyRate > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-500">
                سيتم احتساب {selected.hourlyRate.toLocaleString("en-US")} SYP لكل ساعة + الطلبات
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>إلغاء</Button>
            <Button onClick={handleStart} disabled={createSession.isPending}><Play className="w-4 h-4 ml-2" /> بدء الجلسة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Table Contents */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>محتوى الطاولة {selected?.number}</DialogTitle></DialogHeader>
          {selected && (() => {
            const s = getSessionForTable(selected.id);
            return s ? <TableContents sessionId={s.id} /> : <div className="py-6 text-center text-muted-foreground text-sm">لا توجد جلسة نشطة</div>;
          })()}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={openCancel}>
              <XCircle className="w-4 h-4 ml-1" />إلغاء الجلسة
            </Button>
            <Button variant="outline" onClick={() => setViewOpen(false)}>إغلاق</Button>
            <Button onClick={openPayment}><Receipt className="w-4 h-4 ml-1" />دفع وإغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Session (no invoice) */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>إلغاء الجلسة — طاولة {selected?.number}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              سيتم إلغاء الجلسة دون إصدار فاتورة، وتفريغ الطاولة. سيُسجّل الإلغاء في تقارير المدير.
            </div>
            <div className="space-y-1.5">
              <Label>سبب الإلغاء (اختياري)</Label>
              <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="مثال: المجموعة غادرت دون طلب" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>تراجع</Button>
            <Button variant="destructive" onClick={handleCancelSession} disabled={cancelSession.isPending}>
              <XCircle className="w-4 h-4 ml-1" />تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Session */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>دفع وإغلاق — طاولة {selected?.number}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {selected && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">المبلغ المستحق</div>
                <div className="text-2xl font-black text-primary">{getSessionForTable(selected.id)?.currentCost.toLocaleString("en-US")} SYP</div>
                {selected.hourlyRate > 0 && <div className="text-xs text-muted-foreground mt-1">شامل تكلفة الوقت ({selected.hourlyRate.toLocaleString("en-US")} SYP/ساعة)</div>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>طريقة الدفع</Label>
              <div className="flex gap-2">
                <Button variant={payMethod === "cash" ? "default" : "outline"} className="flex-1" onClick={() => setPayMethod("cash")}>كاش</Button>
                <Button variant={payMethod === "card" ? "default" : "outline"} className="flex-1" onClick={() => setPayMethod("card")}>بطاقة</Button>
              </div>
            </div>
            {canOverride && (
              <div className="space-y-1.5">
                <Label>المبلغ النهائي (تعديل يدوي — اتركه فارغاً للمبلغ المحسوب)</Label>
                <Input type="number" value={finalTotal} onChange={(e) => setFinalTotal(e.target.value)} placeholder={`${getSessionForTable(selected?.id ?? 0)?.currentCost ?? ""}`} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>المبلغ المدفوع</Label>
              <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
            {selected && amountPaid && (() => {
              const due = finalTotal.trim() !== "" && canOverride ? Math.max(0, Math.round(numVal(finalTotal) || 0)) : (getSessionForTable(selected.id)?.currentCost ?? 0);
              const extra = numVal(amountPaid) - due;
              return extra > 0 ? (
                <div className="p-2 bg-green-500/10 rounded text-green-500 text-sm font-bold">
                  الباقي: {extra.toLocaleString("en-US")} SYP
                </div>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)}>إلغاء</Button>
            <Button onClick={handleEnd} disabled={endSession.isPending}><Receipt className="w-4 h-4 ml-2" /> إغلاق وإصدار فاتورة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>فاتورة — طاولة {selected?.number}</DialogTitle></DialogHeader>
          {invoice && (
            <PrintReceipt
              invoice={invoice}
              sessionInfo={selected ? { resourceName: `طاولة ${selected.number}`, type: "table", startTime: invoice.createdAt } : undefined}
              onClose={() => setReceiptOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
