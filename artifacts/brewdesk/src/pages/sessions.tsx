import { useState, useEffect } from "react";
import {
  useListSessions,
  useEndSession,
  useCreateOrder,
  useListMenuItems,
  useGetSessionBill,
  useAddSessionGuest,
  useSessionGuestLeave,
  useStopSessionTime,
  useResumeSessionTime,
  getListSessionsQueryKey,
  getListTablesQueryKey,
  getListRoomsQueryKey,
  getGetSessionBillQueryKey,
  Invoice,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Users, Receipt, Plus, ShoppingCart, Minus, Banknote, CreditCard, UserPlus, LogOut, Pause, Play } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStaffId } from "@/lib/auth";
import { usePermissions } from "@/hooks/use-permissions";
import { getSettings } from "@/lib/settings";
import { fmtNum, fmtTime, fmtHoursLabel, intVal, numVal } from "@/lib/format";
import { PrintReceipt } from "@/components/PrintReceipt";

function LiveTimer({ startTime, stoppedAt }: { startTime: string; stoppedAt?: string | null }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const start = new Date(startTime).getTime();
    const update = () => {
      const end = stoppedAt ? new Date(stoppedAt).getTime() : Date.now();
      const diff = Math.max(0, Math.floor((end - start) / 1000));
      const h = Math.floor(diff / 3600).toString().padStart(2, "0");
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
      const s = (diff % 60).toString().padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    };
    update();
    if (stoppedAt) return;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startTime, stoppedAt]);
  return (
    <span className={`font-mono text-xl font-black tracking-widest ${stoppedAt ? "text-yellow-500" : "text-primary"}`}>
      {elapsed}
    </span>
  );
}

type CartItem = { menuItemId: number; name: string; price: number; quantity: number };
type ActiveSession = {
  id: number; resourceName: string; currentCost: number; type: string; startTime: string;
  guestCount?: number | null; billingMode?: string; timeStoppedAt?: string | null;
};

export default function Sessions() {
  const { data: sessions, isLoading } = useListSessions();
  const { data: menuItems } = useListMenuItems();
  const endSession = useEndSession();
  const createOrder = useCreateOrder();
  const addGuest = useAddSessionGuest();
  const guestLeave = useSessionGuestLeave();
  const stopTime = useStopSessionTime();
  const resumeTime = useResumeSessionTime();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canOverride = can("cashier.view");

  const [payOpen, setPayOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [amountPaid, setAmountPaid] = useState("");
  const [finalTotal, setFinalTotal] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const activeSessions = sessions?.filter((s) => s.status === "active") ?? [];

  const { data: bill } = useGetSessionBill(selectedSession?.id ?? 0, {
    query: {
      queryKey: getGetSessionBillQueryKey(selectedSession?.id ?? 0),
      enabled: (guestsOpen || payOpen) && !!selectedSession,
      refetchInterval: 15000,
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
    if (selectedSession) queryClient.invalidateQueries({ queryKey: getGetSessionBillQueryKey(selectedSession.id) });
  };

  const openPay = (session: ActiveSession) => {
    setSelectedSession(session);
    setAmountPaid(String(session.currentCost));
    setFinalTotal(String(session.currentCost));
    setPayMethod("cash");
    setPayOpen(true);
  };

  const openOrder = (session: ActiveSession) => {
    setSelectedSession(session); setCart([]); setOrderOpen(true);
  };

  const openGuests = (session: ActiveSession) => {
    setSelectedSession(session); setNewGuestName(""); setGuestsOpen(true);
  };

  const addToCart = (item: { id: number; nameAr?: string | null; name: string; price: number }) => {
    const displayName = item.nameAr ?? item.name;
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: displayName, price: item.price, quantity: 1 }];
    });
  };

  const updateQty = (menuItemId: number, delta: number) => {
    setCart((prev) => prev.map((c) => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0));
  };

  const handleOrder = () => {
    if (!selectedSession || cart.length === 0) return;
    createOrder.mutate(
      { data: { sessionId: selectedSession.id, staffId: getStaffId(), items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })) } },
      {
        onSuccess: () => {
          invalidateAll();
          setOrderOpen(false);
          toast({ title: "تم إرسال الطلب للمطبخ" });
        },
        onError: () => toast({ title: "فشل الطلب", variant: "destructive" }),
      }
    );
  };

  const computedDue = bill?.total ?? selectedSession?.currentCost ?? 0;
  const finalDue = finalTotal.trim() === "" ? computedDue : Math.max(0, Math.round(numVal(finalTotal) || 0));

  const handlePay = () => {
    if (!selectedSession) return;
    const paid = numVal(amountPaid) || finalDue;
    const override = canOverride && finalDue !== computedDue ? { overrideTotal: finalDue } : {};
    endSession.mutate(
      { id: selectedSession.id, data: { paymentMethod: payMethod, amountPaid: paid, ...override } },
      {
        onSuccess: (inv) => {
          invalidateAll();
          setPayOpen(false);
          setInvoice(inv);
          const settings = getSettings();
          if (settings.printAutomatically) {
            setReceiptOpen(true);
            setTimeout(() => window.print(), 300);
          } else {
            setReceiptOpen(true);
          }
          toast({ title: "تم الدفع وإغلاق الجلسة بنجاح" });
        },
        onError: () => toast({ title: "فشل إغلاق الجلسة", variant: "destructive" }),
      }
    );
  };

  const handleAddGuest = () => {
    if (!selectedSession) return;
    addGuest.mutate(
      { id: selectedSession.id, data: newGuestName.trim() ? { name: newGuestName.trim() } : {} },
      {
        onSuccess: () => {
          invalidateAll();
          setNewGuestName("");
          toast({ title: "تمت إضافة الشخص — وقته يبدأ الآن" });
        },
        onError: (e) => toast({ title: (e as { data?: { error?: string } })?.data?.error ?? "فشلت الإضافة", variant: "destructive" }),
      }
    );
  };

  const handleGuestLeave = (guestId: number) => {
    if (!selectedSession) return;
    guestLeave.mutate(
      { id: selectedSession.id, guestId },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "تم تسجيل المغادرة — توقف وقته الآن" });
        },
        onError: (e) => toast({ title: (e as { data?: { error?: string } })?.data?.error ?? "فشل التسجيل", variant: "destructive" }),
      }
    );
  };

  const handleToggleTime = (session: ActiveSession) => {
    const mutation = session.timeStoppedAt ? resumeTime : stopTime;
    mutation.mutate(
      { id: session.id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: session.timeStoppedAt ? "تم استئناف الوقت" : "تم إيقاف الوقت — التكلفة الزمنية ثبتت الآن" });
        },
        onError: (e) => toast({ title: (e as { data?: { error?: string } })?.data?.error ?? "فشلت العملية", variant: "destructive" }),
      }
    );
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const change = Math.max(0, (numVal(amountPaid) || 0) - finalDue);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">الجلسات النشطة / Active Sessions</h2>
        <p className="text-sm text-muted-foreground">{fmtNum(activeSessions.length)} جلسة نشطة حالياً</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : activeSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <Clock className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">لا يوجد جلسات نشطة</p>
          <p className="text-sm">ابدأ جلسة من صفحة الطاولات أو الغرف</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeSessions.map((session) => (
            <Card key={session.id} className="bg-card border-border/50 hover:border-primary/30 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{session.resourceName}</CardTitle>
                    <div className="text-xs text-muted-foreground uppercase">{session.type}</div>
                  </div>
                  {session.timeStoppedAt ? (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px]">الوقت موقوف</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">نشط</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> الوقت المنقضي</div>
                  <LiveTimer startTime={session.startTime} stoppedAt={session.timeStoppedAt} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> الأشخاص</span>
                  <span className="font-medium">{session.guestCount != null ? fmtNum(session.guestCount) : "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> التكلفة</span>
                  <span className="font-bold text-green-500">{fmtNum(session.currentCost)} SYP</span>
                </div>
                <div className="flex gap-2">
                  {session.billingMode === "per_person" && (
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openGuests(session)}>
                      <UserPlus className="w-3 h-3 ml-1" /> الأشخاص
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm" className="flex-1 text-xs"
                    onClick={() => handleToggleTime(session)}
                    disabled={stopTime.isPending || resumeTime.isPending}
                  >
                    {session.timeStoppedAt
                      ? <><Play className="w-3 h-3 ml-1" /> استئناف الوقت</>
                      : <><Pause className="w-3 h-3 ml-1" /> إيقاف الوقت</>}
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 pt-2 border-t border-border/50">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openOrder(session)}>
                  <ShoppingCart className="w-3 h-3 ml-1" /> طلب
                </Button>
                <Button size="sm" className="flex-1 text-xs" onClick={() => openPay(session)}>
                  <Receipt className="w-3 h-3 ml-1" /> دفع وإغلاق
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Guests Dialog (per-person sessions) */}
      <Dialog open={guestsOpen} onOpenChange={setGuestsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>الأشخاص — {selectedSession?.resourceName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(bill?.guests ?? []).map((g, i) => (
                <div key={g.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${g.leftAt ? "bg-muted/30 border-border/30 opacity-60" : "bg-muted/50 border-border/50"}`}>
                  <div>
                    <div className="font-medium text-sm">{g.name || `شخص ${i + 1}`}</div>
                    <div className="text-[11px] text-muted-foreground">
                      دخل {fmtTime(g.joinedAt)}
                      {g.leftAt ? ` — غادر ${fmtTime(g.leftAt)}` : " — ما زال جالساً"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <div className="text-xs font-bold text-primary">{fmtNum(g.amount)} SYP</div>
                      <div className="text-[10px] text-muted-foreground">{fmtHoursLabel(g.billedHours)}</div>
                    </div>
                    {!g.leftAt && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={guestLeave.isPending} onClick={() => handleGuestLeave(g.id)}>
                        <LogOut className="w-3 h-3 ml-1" /> غادر
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(bill?.guests ?? []).length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">لا يوجد أشخاص مسجلون</div>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Input placeholder="اسم الشخص (اختياري)" value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} />
              <Button onClick={handleAddGuest} disabled={addGuest.isPending}>
                <UserPlus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">الشخص الجديد يبدأ حساب وقته من لحظة الإضافة — لا يدفع عن الوقت السابق.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>دفع وإغلاق — {selectedSession?.resourceName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-sm text-muted-foreground">الحساب المحسوب</div>
              <div className="text-3xl font-black text-primary mt-1">{fmtNum(computedDue)} SYP</div>
            </div>
            {canOverride && (
            <div className="space-y-1.5">
              <Label>المبلغ النهائي (قابل للتعديل)</Label>
              <Input type="number" value={finalTotal} onChange={(e) => setFinalTotal(e.target.value)} />
              {finalDue !== computedDue && (
                <p className={`text-xs font-medium ${finalDue > computedDue ? "text-green-500" : "text-yellow-500"}`}>
                  {finalDue > computedDue
                    ? `زيادة يدوية: +${fmtNum(finalDue - computedDue)} SYP`
                    : `تخفيض يدوي: -${fmtNum(computedDue - finalDue)} SYP`}
                </p>
              )}
            </div>
            )}
            <div className="space-y-1.5">
              <Label>طريقة الدفع</Label>
              <div className="flex gap-2">
                <Button variant={payMethod === "cash" ? "default" : "outline"} className="flex-1" onClick={() => setPayMethod("cash")}>
                  <Banknote className="w-4 h-4 ml-2" /> كاش
                </Button>
                <Button variant={payMethod === "card" ? "default" : "outline"} className="flex-1" onClick={() => setPayMethod("card")}>
                  <CreditCard className="w-4 h-4 ml-2" /> بطاقة
                </Button>
              </div>
            </div>
            {payMethod === "cash" && (
              <div className="space-y-1.5">
                <Label>المبلغ المدفوع</Label>
                <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              </div>
            )}
            {payMethod === "cash" && change > 0 && (
              <div className="p-2 bg-green-500/10 rounded text-green-500 font-bold text-center">
                الباقي للزبون: {fmtNum(change)} SYP
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button>
            <Button onClick={handlePay} disabled={endSession.isPending}><Receipt className="w-4 h-4 ml-2" /> تأكيد الإغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Dialog */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>طلب جديد — {selectedSession?.resourceName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
              {menuItems?.filter((m) => m.isAvailable).map((item) => (
                <button key={item.id} onClick={() => addToCart(item)}
                  className="p-2 rounded-lg bg-muted/50 hover:bg-primary/10 border border-border/50 hover:border-primary/50 text-right transition-colors">
                  <div className="font-medium text-xs">{item.nameAr ?? item.name}</div>
                  <div className="text-[10px] text-primary font-bold mt-1">{fmtNum(item.price)} SYP</div>
                </button>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-border/50 pt-3 space-y-2">
                <div className="text-sm font-bold">الطلبات:</div>
                {cart.map((c) => (
                  <div key={c.menuItemId} className="flex justify-between items-center text-sm">
                    <span className="flex-1">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <button className="w-6 h-6 rounded bg-muted text-xs font-bold flex items-center justify-center" onClick={() => updateQty(c.menuItemId, -1)}><Minus className="w-3 h-3" /></button>
                      <span className="font-bold w-4 text-center">{c.quantity}</span>
                      <button className="w-6 h-6 rounded bg-muted text-xs font-bold flex items-center justify-center" onClick={() => updateQty(c.menuItemId, 1)}><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-primary pt-2 border-t border-border/50">
                  <span>المجموع</span><span>{fmtNum(cartTotal)} SYP</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>إلغاء</Button>
            <Button onClick={handleOrder} disabled={cart.length === 0 || createOrder.isPending}><Plus className="w-4 h-4 ml-2" /> إرسال للمطبخ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>فاتورة — {selectedSession?.resourceName}</DialogTitle></DialogHeader>
          {invoice && selectedSession && (
            <PrintReceipt
              invoice={invoice}
              sessionInfo={{ resourceName: selectedSession.resourceName, type: selectedSession.type, startTime: selectedSession.startTime, guestCount: selectedSession.guestCount }}
              onClose={() => setReceiptOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
