import { intVal, numVal } from "@/lib/format";
import { useState, useMemo } from "react";
import {
  useListSessions,
  useListMenuItems,
  useCreateInvoice,
  useEndSession,
  getListSessionsQueryKey,
  getListTablesQueryKey,
  getListRoomsQueryKey,
  Invoice,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingCart, Search, Receipt, Banknote, CreditCard, Trash2, Plus, Minus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStaffId } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PrintReceipt } from "@/components/PrintReceipt";

type CartItem = { id: number; name: string; price: number; quantity: number };

export default function Cashier() {
  const { data: sessions } = useListSessions();
  const { data: menuItems } = useListMenuItems();
  const createInvoice = useCreateInvoice();
  const endSession = useEndSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [payOpen, setPayOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const activeSessions = sessions?.filter((s) => s.status === "active") ?? [];
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) ?? null;

  const filteredItems = useMemo(
    () => menuItems?.filter((m) => m.isAvailable && (
      m.name.toLowerCase().includes(search.toLowerCase()) || (m.nameAr ?? "").includes(search)
    )) ?? [],
    [menuItems, search]
  );

  const addToCart = (item: { id: number; name: string; nameAr?: string | null; price: number }) => {
    const displayName = item.nameAr ?? item.name;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: item.id, name: displayName, price: item.price, quantity: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };
  const removeItem = (id: number) => setCart((prev) => prev.filter((c) => c.id !== id));

  const sessionCost = selectedSession?.currentCost ?? 0;
  const cartCost = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const subtotal = sessionCost + cartCost;
  const discountAmt = Math.round(subtotal * (numVal(discount) / 100));
  const total = subtotal - discountAmt;
  const change = numVal(amountPaid) - total;

  const handleCheckout = () => {
    if (total <= 0) { toast({ title: "لا يوجد مبلغ للدفع", variant: "destructive" }); return; }
    setAmountPaid(String(total));
    setPayOpen(true);
  };

  const showReceipt = (inv: Invoice, autoPrint = false) => {
    setInvoice(inv);
    setPayOpen(false);
    const settings = getSettings();
    if (settings.printAutomatically || autoPrint) {
      setReceiptOpen(true);
      setTimeout(() => window.print(), 300);
    } else {
      setReceiptOpen(true);
    }
  };

  const handlePay = () => {
    const paid = numVal(amountPaid);
    if (isNaN(paid) || paid < total) {
      toast({ title: "المبلغ المدفوع أقل من الإجمالي", variant: "destructive" });
      return;
    }

    if (selectedSession) {
      endSession.mutate(
        { id: selectedSession.id, data: { paymentMethod: payMethod, amountPaid: paid, discountPercent: numVal(discount) || 0 } },
        {
          onSuccess: (inv) => {
            queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
            setCart([]); setSelectedSessionId(null);
            showReceipt(inv);
            toast({ title: "تم الدفع وإغلاق الجلسة" });
          },
          onError: () => toast({ title: "فشل الدفع", variant: "destructive" }),
        }
      );
    } else {
      const invoiceItems = cart.map((c) => ({
        description: c.name, quantity: c.quantity, unitPrice: c.price, subtotal: c.price * c.quantity,
      }));
      createInvoice.mutate(
        { data: { customerName: customerName || undefined, discountPercent: numVal(discount) || undefined, amountPaid: paid, paymentMethod: payMethod, staffId: getStaffId(), items: invoiceItems } },
        {
          onSuccess: (inv) => {
            setCart([]); setDiscount("0"); setCustomerName("");
            showReceipt(inv);
            toast({ title: "تم إصدار الفاتورة" });
          },
          onError: () => toast({ title: "فشل إصدار الفاتورة", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 min-h-0">
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pr-9" placeholder="بحث عن منتج..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant={selectedSessionId === null ? "default" : "outline"} className="shrink-0" onClick={() => { setSelectedSessionId(null); setCart([]); }}>
            بيع مباشر
          </Button>
        </div>

        {activeSessions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto shrink-0 pb-1">
            {activeSessions.map((s) => (
              <Button key={s.id} variant={selectedSessionId === s.id ? "default" : "outline"}
                className="shrink-0 h-14 flex flex-col items-center justify-center gap-0.5 px-4"
                onClick={() => { setSelectedSessionId(s.id); setCart([]); }}>
                <span className="font-bold text-sm">{s.resourceName}</span>
                <span className="text-[10px] opacity-70">{s.currentCost.toLocaleString("en-US")} SYP</span>
              </Button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 bg-card/30 rounded-xl border border-border p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="p-3 rounded-xl bg-card hover:border-primary/50 border border-border/50 transition-all hover:scale-105 text-right">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs mb-2 mx-auto">
                  {(item.nameAr ?? item.name).substring(0, 2)}
                </div>
                <div className="font-medium text-xs line-clamp-2 text-center">{item.nameAr ?? item.name}</div>
                <div className="text-primary font-bold text-xs text-center mt-1">{item.price.toLocaleString("en-US")} SYP</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <Card className="w-full md:w-96 flex flex-col shrink-0 border-l-4 border-l-primary shadow-xl">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="w-4 h-4 text-primary" />
            {selectedSession ? `جلسة: ${selectedSession.resourceName}` : "بيع مباشر"}
          </CardTitle>
          {!selectedSession && (
            <Input placeholder="اسم العميل (اختياري)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-8 text-sm mt-2" />
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-3 min-h-0">
          {cart.length === 0 && !selectedSession ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
              <ShoppingCart className="w-10 h-10 mb-2" />
              <p className="text-sm">اضغط على منتج لإضافته</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedSession && (
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">تكلفة الجلسة</span>
                  <span className="font-bold">{selectedSession.currentCost.toLocaleString("en-US")} SYP</span>
                </div>
              )}
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{(item.price * item.quantity).toLocaleString("en-US")} SYP</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded bg-muted text-xs font-bold hover:bg-muted/60 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                    <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded bg-muted text-xs font-bold hover:bg-muted/60 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded text-destructive hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <div className="p-3 border-t border-border/50 space-y-3 bg-muted/20">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span>{subtotal.toLocaleString("en-US")} SYP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">خصم %</span>
              <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-7 text-sm w-20 mr-auto" />
              {discountAmt > 0 && <span className="text-destructive text-xs">−{discountAmt.toLocaleString("en-US")}</span>}
            </div>
            <div className="flex justify-between font-black text-lg text-primary pt-1 border-t border-border/50">
              <span>الإجمالي</span>
              <span>{total.toLocaleString("en-US")} SYP</span>
            </div>
          </div>
          <Button className="w-full h-12 text-base font-bold" disabled={total <= 0} onClick={handleCheckout}>
            <Receipt className="w-5 h-5 ml-2" /> دفع وإصدار فاتورة
          </Button>
        </div>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>إتمام الدفع</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="text-sm text-muted-foreground">المبلغ المستحق</div>
              <div className="text-3xl font-black text-primary">{total.toLocaleString("en-US")} SYP</div>
            </div>
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
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <div className="text-xs text-muted-foreground">الباقي للزبون</div>
                <div className="text-xl font-black text-green-500">{change.toLocaleString("en-US")} SYP</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button>
            <Button onClick={handlePay} disabled={createInvoice.isPending || endSession.isPending}>
              <Receipt className="w-4 h-4 ml-2" /> تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>فاتورة للزبون</DialogTitle></DialogHeader>
          {invoice && (
            <PrintReceipt
              invoice={invoice}
              sessionInfo={selectedSession ? { resourceName: selectedSession.resourceName, type: selectedSession.type, startTime: selectedSession.startTime } : undefined}
              onClose={() => setReceiptOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
