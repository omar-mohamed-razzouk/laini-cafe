import { useListOrders, useUpdateOrder, useDeleteOrder, getListOrdersQueryKey, OrderStatus } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChefHat, Clock, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
  preparing: "bg-blue-500/20 text-blue-500 border-blue-500/50",
  ready: "bg-green-500/20 text-green-500 border-green-500/50",
  delivered: "bg-gray-500/20 text-gray-500 border-gray-500/50",
  cancelled: "bg-red-500/20 text-red-500 border-red-500/50",
};
const statusLabels: Record<OrderStatus, string> = {
  pending: "انتظار",
  preparing: "يُحضَّر",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "delivered",
};
const nextLabel: Partial<Record<OrderStatus, string>> = {
  pending: "بدء التحضير",
  preparing: "جاهز ✓",
  ready: "تم التسليم",
};
const nextBtnClass: Partial<Record<OrderStatus, string>> = {
  pending: "bg-blue-500 hover:bg-blue-600 text-white",
  preparing: "bg-green-500 hover:bg-green-600 text-white",
  ready: "bg-gray-700 hover:bg-gray-600 text-white",
};

type OrderRow = { id: number; status: OrderStatus };

export default function Orders() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useListOrders();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const { toast } = useToast();

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<"cancel" | "delete">("cancel");
  const [actionOrder, setActionOrder] = useState<OrderRow | null>(null);
  const [reason, setReason] = useState("");

  const openAction = (order: OrderRow, type: "cancel" | "delete") => {
    setActionOrder(order); setActionType(type); setReason(""); setActionOpen(true);
  };

  const handleConfirmAction = () => {
    if (!actionOrder) return;
    if (actionType === "delete") {
      deleteOrder.mutate(
        { id: actionOrder.id, data: { reason: reason || undefined } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            setActionOpen(false);
            toast({ title: `تم حذف الطلب #${actionOrder.id}` });
          },
          onError: () => toast({ title: "فشل حذف الطلب", variant: "destructive" }),
        }
      );
    } else {
      updateOrder.mutate(
        { id: actionOrder.id, data: { status: "cancelled", reason: reason || undefined } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            setActionOpen(false);
            toast({ title: `تم إلغاء الطلب #${actionOrder.id}` });
          },
          onError: () => toast({ title: "فشل إلغاء الطلب", variant: "destructive" }),
        }
      );
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    }, 5000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const activeOrders = orders?.filter((o) => !["delivered", "cancelled"].includes(o.status)) ?? [];

  const handleStatusChange = (id: number, status: OrderStatus) => {
    updateOrder.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          toast({ title: `تم تحديث الطلب #${id} إلى: ${statusLabels[status]}` });
        },
        onError: () => toast({ title: "فشل تحديث الطلب", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold">شاشة المطبخ / Kitchen Display</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            تحديث تلقائي كل 5 ثوانٍ — {activeOrders.length} طلب نشط
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <ChefHat className="w-16 h-16 mb-4 opacity-30" />
          <h3 className="text-xl font-bold">لا يوجد طلبات نشطة</h3>
          <p className="text-sm mt-1">الطلبات الجديدة ستظهر هنا تلقائياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4 flex-1">
          {activeOrders.map((order) => (
            <Card key={order.id} className={`bg-card flex flex-col border-r-4 ${order.status === "pending" ? "border-r-yellow-500" : order.status === "preparing" ? "border-r-blue-500" : "border-r-green-500"}`}>
              <CardHeader className="pb-2 border-b border-border/50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">طلب #{order.id} — جلسة #{order.sessionId}</CardTitle>
                    <div className="text-xs text-muted-foreground flex items-center mt-1 gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleTimeString("ar-SY-u-nu-latn")}
                    </div>
                  </div>
                  <Badge variant="outline" className={statusColors[order.status]}>
                    {statusLabels[order.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                <ul className="space-y-2">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold text-xs">{item.quantity}×</span>
                        <span className="font-medium">{item.menuItemName}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">{item.subtotal.toLocaleString("en-US")} SYP</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="pt-4 border-t border-border/50 flex gap-2">
                {nextStatus[order.status] && (
                  <Button
                    className={`flex-1 ${nextBtnClass[order.status]}`}
                    onClick={() => handleStatusChange(order.id, nextStatus[order.status]!)}
                    disabled={updateOrder.isPending}
                  >
                    {nextLabel[order.status]}
                  </Button>
                )}
                <Button
                  variant="ghost" size="sm"
                  className="shrink-0 text-amber-500 hover:text-amber-500 hover:bg-amber-500/10"
                  onClick={() => openAction({ id: order.id, status: order.status }, "cancel")}
                  title="إلغاء الطلب (يبقى في السجل)"
                >
                  <XCircle className="w-4 h-4 ml-1" />إلغاء
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => openAction({ id: order.id, status: order.status }, "delete")}
                  title="حذف الطلب نهائياً"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel / Delete reason dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionType === "delete" ? "حذف الطلب" : "إلغاء الطلب"} #{actionOrder?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {actionType === "delete"
                ? "سيتم حذف الطلب نهائياً. سيُسجّل في تقارير المدير."
                : "سيتم إلغاء الطلب ولن يُحتسب على الجلسة. سيُسجّل في تقارير المدير."}
            </div>
            <div className="space-y-1.5">
              <Label>سبب {actionType === "delete" ? "الحذف" : "الإلغاء"} (اختياري)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: طلب بالخطأ" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>تراجع</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmAction}
              disabled={deleteOrder.isPending || updateOrder.isPending}
            >
              {actionType === "delete" ? <Trash2 className="w-4 h-4 ml-1" /> : <XCircle className="w-4 h-4 ml-1" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
