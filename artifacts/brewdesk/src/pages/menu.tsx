import { intVal, numVal } from "@/lib/format";
import { useState } from "react";
import {
  useListMenuItems,
  useListCategories,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useCreateCategory,
  getListMenuItemsQueryKey,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Coffee, Edit, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type ItemForm = { name: string; nameAr: string; description: string; price: string; categoryId: string; discountPercent: string; preparationTime: string; isAvailable: boolean };
const emptyForm = (): ItemForm => ({ name: "", nameAr: "", description: "", price: "", categoryId: "", discountPercent: "0", preparationTime: "5", isAvailable: true });

export default function Menu() {
  const { data: menuItems, isLoading } = useListMenuItems();
  const { data: categories } = useListCategories();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const createCategory = useCreateCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [catName, setCatName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const setField = (k: keyof ItemForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setItemOpen(true); };
  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      nameAr: item.nameAr ?? "",
      description: item.description ?? "",
      price: String(item.price),
      categoryId: String(item.categoryId),
      discountPercent: String(item.discountPercent ?? "0"),
      preparationTime: String(item.preparationTime ?? 5),
      isAvailable: item.isAvailable,
    });
    setItemOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.price || !form.categoryId) {
      toast({ title: "يرجى ملء الاسم والسعر والقسم", variant: "destructive" });
      return;
    }
    const data = {
      name: form.name,
      nameAr: form.nameAr || undefined,
      description: form.description || undefined,
      price: intVal(form.price),
      categoryId: intVal(form.categoryId),
      discountPercent: intVal(form.discountPercent) || 0,
      preparationTime: intVal(form.preparationTime) || 5,
      isAvailable: form.isAvailable,
    };
    const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
    if (editId) {
      updateItem.mutate({ id: editId, data }, {
        onSuccess: () => { invalidate(); setItemOpen(false); toast({ title: "تم التعديل" }); },
        onError: () => toast({ title: "فشل التعديل", variant: "destructive" }),
      });
    } else {
      createItem.mutate({ data }, {
        onSuccess: () => { invalidate(); setItemOpen(false); toast({ title: "تم الإضافة" }); },
        onError: () => toast({ title: "فشل الإضافة", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() }); setDeleteConfirm(null); toast({ title: "تم الحذف" }); },
      onError: () => toast({ title: "فشل الحذف", variant: "destructive" }),
    });
  };

  const handleAddCategory = () => {
    if (!catName.trim()) return;
    createCategory.mutate({ data: { name: catName, sortOrder: (categories?.length ?? 0) + 1 } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); setCatOpen(false); setCatName(""); toast({ title: "تم إضافة القسم" }); },
      onError: () => toast({ title: "فشل الإضافة", variant: "destructive" }),
    });
  };

  const filtered = activeCat ? menuItems?.filter((i) => i.categoryId === activeCat) : menuItems;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">القائمة / Menu</h2>
          <p className="text-sm text-muted-foreground">{menuItems?.length ?? 0} منتج</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatOpen(true)}><Plus className="w-4 h-4 ml-2"/> قسم جديد</Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4 ml-2"/> منتج جديد</Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button variant={activeCat === null ? "default" : "outline"} className="rounded-full shrink-0 px-5" onClick={() => setActiveCat(null)}>الكل</Button>
        {categories?.map((c) => (
          <Button key={c.id} variant={activeCat === c.id ? "default" : "outline"} className="rounded-full shrink-0 px-5 bg-card" onClick={() => setActiveCat(c.id)}>
            {c.name}
          </Button>
        ))}
      </div>

      <Card className="bg-card border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-right">المنتج</TableHead>
              <TableHead className="text-right">القسم</TableHead>
              <TableHead className="text-right">السعر</TableHead>
              <TableHead className="text-right">خصم</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">لا يوجد منتجات</TableCell></TableRow>
            ) : filtered?.map((item) => (
              <TableRow key={item.id} className="border-border/50 hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-md text-primary"><Coffee className="w-4 h-4"/></div>
                    <div>
                      <div className="font-bold text-sm">{item.nameAr || item.name}</div>
                      <div className="text-[10px] text-muted-foreground">{item.name}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary" className="font-normal">{item.categoryName}</Badge></TableCell>
                <TableCell><span className="font-bold text-green-500">{item.price.toLocaleString("en-US")} SYP</span></TableCell>
                <TableCell>{(item.discountPercent ?? 0) > 0 ? <Badge variant="outline" className="text-orange-500 border-orange-500/40">{item.discountPercent}%</Badge> : "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={item.isAvailable}
                    onCheckedChange={(val) =>
                      updateItem.mutate({ id: item.id, data: { isAvailable: val } }, {
                        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() }),
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50/10" onClick={() => openEdit(item)}>
                      <Edit className="w-4 h-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(item.id)}>
                      <Trash2 className="w-4 h-4"/>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Item Dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>الاسم بالعربي *</Label>
                <Input value={form.nameAr} onChange={(e) => setField("nameAr", e.target.value)} placeholder="إسبريسو"/>
              </div>
              <div className="space-y-1.5">
                <Label>الاسم بالإنجليزي *</Label>
                <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Espresso"/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الوصف</Label>
              <Input value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="..."/>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>السعر (SYP) *</Label>
                <Input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label>خصم %</Label>
                <Input type="number" min={0} max={100} value={form.discountPercent} onChange={(e) => setField("discountPercent", e.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label>وقت التحضير (د)</Label>
                <Input type="number" min={1} value={form.preparationTime} onChange={(e) => setField("preparationTime", e.target.value)}/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>القسم *</Label>
              <Select value={form.categoryId} onValueChange={(v) => setField("categoryId", v)}>
                <SelectTrigger><SelectValue placeholder="اختر قسماً"/></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isAvailable} onCheckedChange={(v) => setField("isAvailable", v)}/>
              <Label>متوفر للطلب</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={createItem.isPending || updateItem.isPending}>
              {editId ? "حفظ التعديلات" : "إضافة المنتج"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>إضافة قسم جديد</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>اسم القسم</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="قهوة ساخنة"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddCategory} disabled={createCategory.isPending}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteItem.isPending}>
              <Trash2 className="w-4 h-4 ml-2"/> حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
