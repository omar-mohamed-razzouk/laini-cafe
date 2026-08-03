import { intVal, numVal } from "@/lib/format";
import { useState } from "react";
import {
  useListBookings,
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useListTables,
  useListRooms,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarPlus, Calendar as CalendarIcon, Clock, Phone, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  confirmed: "bg-green-500/20 text-green-500 border-green-500/50",
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
  cancelled: "bg-muted text-muted-foreground",
};
const statusLabels: Record<string, string> = {
  confirmed: "مؤكد",
  pending: "معلق",
  cancelled: "ملغي",
};

export default function Bookings() {
  const { data: bookings, isLoading } = useListBookings();
  const { data: tables } = useListTables();
  const { data: rooms } = useListRooms();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [resourceType, setResourceType] = useState<"table" | "room">("table");
  const [resourceId, setResourceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setResourceType("table");
    setResourceId("");
    setCustomerName("");
    setCustomerPhone("");
    setGuestCount("2");
    setStartTime("");
    setEndTime("");
    setNotes("");
  };

  const handleCreate = () => {
    if (!customerName || !resourceId || !startTime || !endTime) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    createBooking.mutate(
      {
        data: {
          type: resourceType,
          resourceId: intVal(resourceId),
          customerName,
          customerPhone: customerPhone || undefined,
          guestCount: intVal(guestCount) || 1,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          setOpen(false);
          resetForm();
          toast({ title: "تم إضافة الحجز بنجاح" });
        },
        onError: () => toast({ title: "فشل الحجز", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteBooking.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          toast({ title: "تم حذف الحجز" });
        },
      }
    );
  };

  const handleStatusChange = (id: number, status: string) => {
    updateBooking.mutate(
      { id, data: { status: status as any } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() }),
      }
    );
  };

  const resourceOptions = resourceType === "table"
    ? tables?.map((t) => ({ id: t.id, label: `طاولة ${t.number} (${t.capacity} مقاعد)` }))
    : rooms?.map((r) => ({ id: r.id, label: `${r.name} (${r.capacity} شخص)` }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">الحجوزات / Bookings</h2>
          <p className="text-sm text-muted-foreground">إدارة الحجوزات المسبقة</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }}>
          <CalendarPlus className="w-4 h-4 ml-2" /> حجز جديد
        </Button>
      </div>

      <Card className="bg-card border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-right">التاريخ والوقت</TableHead>
              <TableHead className="text-right">العميل</TableHead>
              <TableHead className="text-right">المورد</TableHead>
              <TableHead className="text-right">الضيوف</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
            ) : bookings?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">لا يوجد حجوزات</TableCell></TableRow>
            ) : bookings?.map((b) => (
              <TableRow key={b.id} className="border-border/50 hover:bg-muted/50">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center text-sm font-medium gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      {format(new Date(b.startTime), "dd/MM/yyyy")}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(b.startTime), "HH:mm")} – {format(new Date(b.endTime), "HH:mm")}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{b.customerName}</div>
                  {b.customerPhone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /><span dir="ltr">{b.customerPhone}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{b.resourceName}</div>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">{b.type}</Badge>
                </TableCell>
                <TableCell className="text-sm">{b.guestCount}</TableCell>
                <TableCell>
                  <Select value={b.status} onValueChange={(val) => handleStatusChange(b.id, val)}>
                    <SelectTrigger className={`w-24 h-7 text-xs border ${statusColors[b.status]}`}>
                      <SelectValue>{statusLabels[b.status]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">معلق</SelectItem>
                      <SelectItem value="confirmed">مؤكد</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>حجز جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>اسم العميل *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="محمد أحمد" />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+963..." dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>نوع المورد *</Label>
                <Select value={resourceType} onValueChange={(v) => { setResourceType(v as any); setResourceId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">طاولة</SelectItem>
                    <SelectItem value="room">غرفة/قاعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{resourceType === "table" ? "الطاولة" : "الغرفة"} *</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {resourceOptions?.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>من *</Label>
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>إلى *</Label>
                <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>عدد الضيوف</Label>
                <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createBooking.isPending}>
              <CalendarPlus className="w-4 h-4 ml-2" /> حجز
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
