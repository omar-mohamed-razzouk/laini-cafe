import { intVal, numVal } from "@/lib/format";
import { useState } from "react";
import {
  useListRooms,
  useUpdateRoom,
  useCreateSession,
  useEndSession,
  useCancelSession,
  useRemoveGuest,
  useListSessions,
  useListCustomers,
  getListRoomsQueryKey,
  getListSessionsQueryKey,
  RoomType,
  Invoice,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DoorOpen, Users, Projector, Mic, Play, Receipt, Banknote, CreditCard, XCircle, UserMinus, Settings2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStaffId } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PrintReceipt } from "@/components/PrintReceipt";
import { usePermissions } from "@/hooks/use-permissions";

const statusColors: Record<string, string> = {
  available: "bg-green-500/20 text-green-500 border-green-500/50",
  reserved: "bg-amber-500/20 text-amber-500 border-amber-500/50",
  occupied: "bg-red-500/20 text-red-500 border-red-500/50",
};
const typeLabels: Record<RoomType, string> = { meeting: "اجتماعات", lecture: "محاضرات", training: "تدريب" };

export default function Rooms() {
  const { data: rooms, isLoading } = useListRooms();
  const { data: sessions } = useListSessions();
  const createSession = useCreateSession();
  const endSession = useEndSession();
  const cancelSession = useCancelSession();
  const removeGuest = useRemoveGuest();
  const updateRoom = useUpdateRoom();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManageRooms = can("rooms.manage");

  const { data: customers } = useListCustomers();

  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<{ id: number; name: string; hourlyRate: number } | null>(null);
  const [guestCount, setGuestCount] = useState("10");
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [finalTotal, setFinalTotal] = useState("");
  const canOverride = can("cashier.view");
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [newRate, setNewRate] = useState("0");

  const getSessionForRoom = (roomId: number) =>
    sessions?.find((s) => s.type === "room" && s.resourceId === roomId && s.status === "active");

  const filteredCustomers = customers?.filter((c) =>
    c.name.includes(customerSearch) || (c.phone ?? "").includes(customerSearch)
  ) ?? [];

  const openStart = (room: { id: number; name: string; hourlyRate: number }) => {
    setSelectedRoom(room); setGuestCount("10"); setNotes(""); setCustomerSearch(""); setSelectedCustomerId(null); setStartOpen(true);
  };
  const openEnd = (room: { id: number; name: string; hourlyRate: number }) => {
    const session = getSessionForRoom(room.id);
    setSelectedRoom(room);
    setAmountPaid(String(session?.currentCost ?? ""));
    setFinalTotal("");
    setPayMethod("cash");
    setEndOpen(true);
  };

  const openCancel = (room: { id: number; name: string; hourlyRate: number }) => {
    setSelectedRoom(room); setCancelReason(""); setCancelOpen(true);
  };

  const openRateEdit = (room: { id: number; name: string; hourlyRate: number }) => {
    setSelectedRoom(room); setNewRate(String(room.hourlyRate)); setRateOpen(true);
  };

  const handleRateSave = () => {
    if (!selectedRoom) return;
    updateRoom.mutate(
      { id: selectedRoom.id, data: { hourlyRate: numVal(newRate) || 0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          setRateOpen(false);
          toast({ title: `تم تحديث سعر الساعة — ${selectedRoom.name}` });
        },
        onError: () => toast({ title: "تعذّر تحديث السعر", variant: "destructive" }),
      }
    );
  };

  const handleCancelSession = () => {
    if (!selectedRoom) return;
    const session = getSessionForRoom(selectedRoom.id);
    if (!session) return;
    cancelSession.mutate(
      { id: session.id, data: { reason: cancelReason || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setCancelOpen(false);
          toast({ title: "تم إلغاء الجلسة", description: `${selectedRoom.name} — بدون فاتورة` });
        },
        onError: () => toast({ title: "خطأ", description: "فشل إلغاء الجلسة", variant: "destructive" }),
      }
    );
  };

  const handleRemoveGuest = (roomId: number) => {
    const session = getSessionForRoom(roomId);
    if (!session) return;
    removeGuest.mutate(
      { id: session.id, data: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          toast({ title: "تم حذف شخص من القاعة" });
        },
        onError: () => toast({ title: "تعذّر حذف الشخص", variant: "destructive" }),
      }
    );
  };

  const handleStart = () => {
    if (!selectedRoom) return;
    const customer = customers?.find((c) => c.id === selectedCustomerId);
    createSession.mutate(
      { data: { type: "room", resourceId: selectedRoom.id, guestCount: intVal(guestCount) || 1, staffId: getStaffId(), notes, customerId: selectedCustomerId ?? undefined, customerName: customer?.name ?? undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setStartOpen(false);
          toast({ title: "بدأت الجلسة", description: selectedRoom.name });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  const handleEnd = () => {
    if (!selectedRoom) return;
    const session = getSessionForRoom(selectedRoom.id);
    if (!session) return;
    const computedDue = session.currentCost;
    const finalDue = finalTotal.trim() === "" ? computedDue : Math.max(0, Math.round(numVal(finalTotal) || 0));
    const override = canOverride && finalDue !== computedDue ? { overrideTotal: finalDue } : {};
    const paid = numVal(amountPaid) || finalDue;
    endSession.mutate(
      { id: session.id, data: { paymentMethod: payMethod, amountPaid: paid, ...override } },
      {
        onSuccess: (inv) => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setEndOpen(false);
          setInvoice(inv);
          const settings = getSettings();
          if (settings.printAutomatically) {
            setReceiptOpen(true);
            setTimeout(() => window.print(), 300);
          } else {
            setReceiptOpen(true);
          }
          toast({ title: "تم إغلاق الجلسة وإصدار الفاتورة" });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold">الغرف والقاعات / Rooms</h2>
        <p className="text-sm text-muted-foreground">غرف الاجتماعات والقاعات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {rooms?.map((room) => {
          const session = getSessionForRoom(room.id);
          return (
            <Card key={room.id} className="bg-card border-border/50 hover:border-primary/40 transition-all flex flex-col">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><DoorOpen className="w-6 h-6" /></div>
                  <div>
                    <CardTitle className="text-base">{room.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{typeLabels[room.type]}</div>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${statusColors[room.status]}`}>
                  {room.status === "available" ? "متاح" : room.status === "occupied" ? "مشغول" : "محجوز"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Users className="w-4 h-4" /> السعة</span>
                  <span className="font-bold">{room.capacity} شخص</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">التكلفة/ساعة</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-500">{room.hourlyRate.toLocaleString("en-US")} SYP</span>
                    {canManageRooms && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => openRateEdit(room)}
                        title="تعديل سعر الساعة"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {session && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="w-4 h-4" /> الحضور</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{session.guestCount ?? 1}</span>
                        {(session.guestCount ?? 1) > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                            onClick={() => handleRemoveGuest(room.id)}
                            disabled={removeGuest.isPending}
                          >
                            <UserMinus className="w-3.5 h-3.5 ml-1" /> حذف شخص
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">التكلفة الحالية</span>
                      <span className="font-bold text-primary">{session.currentCost.toLocaleString("en-US")} SYP</span>
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  {room.hasProjector && <Badge variant="secondary" className="text-[10px]"><Projector className="w-3 h-3 ml-1" /> بروجكتور</Badge>}
                  {room.hasMicrophone && <Badge variant="secondary" className="text-[10px]"><Mic className="w-3 h-3 ml-1" /> مايك</Badge>}
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 border-t border-border/50 pt-4">
                {room.status === "available" && (
                  <Button className="w-full text-xs h-9" onClick={() => openStart(room)}>
                    <Play className="w-3 h-3 ml-2" /> بدء جلسة
                  </Button>
                )}
                {room.status === "occupied" && (
                  <>
                    <Button variant="outline" className="flex-1 text-xs h-9 border-primary text-primary hover:bg-primary/10" onClick={() => openEnd(room)}>
                      <Receipt className="w-3 h-3 ml-2" /> إغلاق وفاتورة
                    </Button>
                    <Button variant="ghost" className="h-9 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openCancel(room)} title="إلغاء الجلسة بدون فاتورة">
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Start Dialog */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>بدء جلسة — {selectedRoom?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>عدد الحضور</Label>
              <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
            </div>
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
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اسم الشركة، الحدث..." />
            </div>
            <p className="text-xs text-muted-foreground">سيتم احتساب التكلفة بناءً على عدد الساعات × {selectedRoom?.hourlyRate.toLocaleString("en-US")} SYP</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>إلغاء</Button>
            <Button onClick={handleStart} disabled={createSession.isPending}><Play className="w-4 h-4 ml-2" /> بدء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Dialog */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>دفع وإغلاق — {selectedRoom?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {selectedRoom && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">المبلغ المستحق</div>
                <div className="text-2xl font-black text-primary">
                  {getSessionForRoom(selectedRoom.id)?.currentCost.toLocaleString("en-US")} SYP
                </div>
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
            {canOverride && (
              <div className="space-y-1.5">
                <Label>المبلغ النهائي (تعديل يدوي — اتركه فارغاً للمبلغ المحسوب)</Label>
                <Input type="number" value={finalTotal} onChange={(e) => setFinalTotal(e.target.value)} placeholder={`${getSessionForRoom(selectedRoom?.id ?? 0)?.currentCost ?? ""}`} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>المبلغ المدفوع</Label>
              <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
            {selectedRoom && amountPaid && (() => {
              const due = finalTotal.trim() !== "" && canOverride ? Math.max(0, Math.round(numVal(finalTotal) || 0)) : (getSessionForRoom(selectedRoom.id)?.currentCost ?? 0);
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

      {/* Cancel Session (no invoice) */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>إلغاء الجلسة — {selectedRoom?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              سيتم إلغاء الجلسة دون إصدار فاتورة، وتفريغ الغرفة. سيُسجّل الإلغاء في تقارير المدير.
            </div>
            <div className="space-y-1.5">
              <Label>سبب الإلغاء (اختياري)</Label>
              <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="مثال: تم تأجيل الحجز" />
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

      {/* Set Hourly Rate Dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>سعر الساعة — {selectedRoom?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>سعر الساعة (SYP)</Label>
              <Input type="number" min={0} value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="0" />
            </div>
            <p className="text-xs text-muted-foreground">التكلفة = عدد الساعات × السعر. يمكن تعديل السعر في أي وقت.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateOpen(false)}>إلغاء</Button>
            <Button onClick={handleRateSave} disabled={updateRoom.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>فاتورة — {selectedRoom?.name}</DialogTitle></DialogHeader>
          {invoice && (
            <PrintReceipt
              invoice={invoice}
              sessionInfo={selectedRoom ? { resourceName: selectedRoom.name, type: "room", startTime: invoice.createdAt } : undefined}
              onClose={() => setReceiptOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
