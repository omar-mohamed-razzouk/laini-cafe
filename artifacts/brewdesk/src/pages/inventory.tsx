import { intVal, numVal } from "@/lib/format";
import { useState } from "react";
import {
  useListInventory,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  getListInventoryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, AlertTriangle, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Form = { name: string; unit: string; currentQuantity: string; minQuantity: string; costPerUnit: string };
const empty = (): Form => ({ name: "", unit: "كغ", currentQuantity: "0", minQuantity: "0", costPerUnit: "0" });

export default function Inventory() {
  const { data: inventory, isLoading } = useListInventory();
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty());
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [restockId, setRestockId] = useState<number | null>(null);
  const [restockQty, setRestockQty] = useState("1");

  const setField = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditId(null); setForm(empty()); setOpen(true); };
  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      currentQuantity: String(item.currentQuantity),
      minQuantity: String(item.minQuantity),
      costPerUnit: String(item.costPerUnit),
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.unit) { toast({ title: "يرجى ملء الاسم والوحدة", variant: "destructive" }); return; }
    const data = {
      name: form.name,
      unit: form.unit,
      currentQuantity: numVal(form.currentQuantity) || 0,
      minQuantity: numVal(form.minQuantity) || 0,
      costPerUnit: intVal(form.costPerUnit) || 0,
    };
    const inv = () => queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
    if (editId) {
      updateItem.mutate({ id: editId, data }, {
        onSuccess: () => { inv(); setOpen(false); toast({ title: "تم التعديل" }); },
        onError: () => toast({ title: "فشل", variant: "destructive" }),
      });
    } else {
      createItem.mutate({ data }, {
        onSuccess: () => { inv(); setOpen(false); toast({ title: "تمت الإضافة" }); },
        onError: () => toast({ title: "فشل", variant: "destructive" }),
      });
    }
  };

  const handleRestock = () => {
    if (!restockId) return;
    const item = inventory?.find((i) => i.id === restockId);
    if (!item) return;
    updateItem.mutate(
      { id: restockId, data: { currentQuantity: item.currentQuantity + numVal(restockQty) } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() }); setRestockId(null); toast({ title: "تم تحديث المخزون" }); },
        onError: () => toast({ title: "فشل", variant: "destructive" }),
      }
    );
  };

  const lowItems = inventory?.filter((i) => i.isLow) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">المخزون / Inventory</h2>
          <p className="text-sm text-muted-foreground">{inventory?.length ?? 0} مادة مسجلة</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 ml-2"/> إضافة مادة</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div><div className="text-sm text-muted-foreground">إجمالي المواد</div><div className="text-2xl font-bold">{inventory?.length ?? 0}</div></div>
            <div className="p-3 bg-primary/10 text-primary rounded-xl"><Package className="w-5 h-5"/></div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div><div className="text-sm text-red-500/80">مواد منخفضة</div><div className="text-2xl font-bold text-red-500">{lowItems.length}</div></div>
            <div className="p-3 bg-red-500/20 text-red-500 rounded-xl"><AlertTriangle className="w-5 h-5"/></div>
          </CardContent>
        </Card>
      </div>

      {lowItems.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex flex-wrap gap-2">
          <span className="text-red-500 font-medium text-sm flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> تنبيه نقص مخزون:</span>
          {lowItems.map((i) => (
            <Badge key={i.id} variant="outline" className="text-red-500 border-red-500/40">{i.name} ({i.currentQuantity} {i.unit})</Badge>
          ))}
        </div>
      )}

      <Card className="bg-card border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-right">المادة</TableHead>
              <TableHead className="text-right">الكمية الحالية</TableHead>
              <TableHead className="text-right">الوحدة</TableHead>
              <TableHead className="text-right">الحد الأدنى</TableHead>
              <TableHead className="text-right">التكلفة/وحدة</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
            ) : inventory?.map((item) => (
              <TableRow key={item.id} className="border-border/50 hover:bg-muted/50">
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell><span className={`font-bold ${item.isLow ? "text-red-500" : "text-foreground"}`}>{item.currentQuantity}</span></TableCell>
                <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                <TableCell className="text-muted-foreground">{item.minQuantity}</TableCell>
                <TableCell>{item.costPerUnit.toLocaleString("en-US")} SYP</TableCell>
                <TableCell>
                  {item.isLow
                    ? <Badge variant="destructive" className="flex w-fit items-center gap-1"><AlertTriangle className="w-3 h-3"/> نقص</Badge>
                    : <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">جيد</Badge>
                  }
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/10" onClick={() => { setRestockId(item.id); setRestockQty("1"); }}>
                      + تعبئة
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:bg-blue-50/10" onClick={() => openEdit(item)}>
                      <Edit className="w-3.5 h-3.5"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(item.id)}>
                      <Trash2 className="w-3.5 h-3.5"/>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editId ? "تعديل مادة" : "إضافة مادة جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>اسم المادة *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="حبوب القهوة"/></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>الوحدة *</Label><Input value={form.unit} onChange={(e) => setField("unit", e.target.value)} placeholder="كغ / لتر / علبة"/></div>
              <div className="space-y-1.5"><Label>الكمية الحالية</Label><Input type="number" value={form.currentQuantity} onChange={(e) => setField("currentQuantity", e.target.value)}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>الحد الأدنى</Label><Input type="number" value={form.minQuantity} onChange={(e) => setField("minQuantity", e.target.value)}/></div>
              <div className="space-y-1.5"><Label>التكلفة/وحدة (SYP)</Label><Input type="number" value={form.costPerUnit} onChange={(e) => setField("costPerUnit", e.target.value)}/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={createItem.isPending || updateItem.isPending}>{editId ? "حفظ التعديلات" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={restockId !== null} onOpenChange={() => setRestockId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>تعبئة مخزون — {inventory?.find((i) => i.id === restockId)?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>الكمية المضافة</Label>
              <Input type="number" min={0.1} step={0.1} value={restockQty} onChange={(e) => setRestockQty(e.target.value)}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockId(null)}>إلغاء</Button>
            <Button onClick={handleRestock} disabled={updateItem.isPending}>تأكيد التعبئة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذه المادة؟</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteItem.mutate({ id: deleteConfirm }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() }); setDeleteConfirm(null); } })} disabled={deleteItem.isPending}>
              <Trash2 className="w-4 h-4 ml-2"/> حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
