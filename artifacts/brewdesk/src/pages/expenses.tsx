import { intVal, numVal } from "@/lib/format";
import { useState } from "react";
import {
  useListExpenses,
  useCreateExpense,
  useDeleteExpense,
  getListExpensesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar, Trash2, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const categoryColors: Record<string, string> = {
  rent: "bg-purple-500/20 text-purple-400",
  utilities: "bg-blue-500/20 text-blue-400",
  supplies: "bg-orange-500/20 text-orange-400",
  salary: "bg-green-500/20 text-green-400",
  maintenance: "bg-red-500/20 text-red-400",
  other: "bg-gray-500/20 text-gray-400",
};
const categoryLabels: Record<string, string> = {
  rent: "إيجار",
  utilities: "فواتير",
  supplies: "مستلزمات",
  salary: "رواتب",
  maintenance: "صيانة",
  other: "أخرى",
};

export default function Expenses() {
  const { data: expenses, isLoading } = useListExpenses();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const resetForm = () => { setTitle(""); setAmount(""); setCategory("other"); setDate(new Date().toISOString().split("T")[0]); setNotes(""); };

  const handleCreate = () => {
    if (!title || !amount) { toast({ title: "يرجى ملء العنوان والمبلغ", variant: "destructive" }); return; }
    createExpense.mutate(
      { data: { title, amount: intVal(amount), category: category as any, date, notes: notes || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
          setOpen(false);
          resetForm();
          toast({ title: "تم تسجيل المصروف" });
        },
        onError: () => toast({ title: "فشل التسجيل", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteExpense.mutate(
      { id },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() }); setDeleteConfirm(null); toast({ title: "تم الحذف" }); },
        onError: () => toast({ title: "فشل الحذف", variant: "destructive" }),
      }
    );
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const byCategory = Object.entries(categoryLabels).map(([ key, label]) => ({
    key, label,
    total: expenses?.filter((e) => e.category === key).reduce((s, e) => s + e.amount, 0) ?? 0,
  })).filter((c) => c.total > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">المصروفات / Expenses</h2>
          <p className="text-sm text-muted-foreground">{expenses?.length ?? 0} مصروف مسجل</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="w-4 h-4 ml-2"/> تسجيل مصروف
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-l-4 border-l-destructive md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4 text-destructive"/> إجمالي المصروفات
            </div>
            <div className="text-2xl font-black text-destructive">{totalExpenses.toLocaleString("en-US")} <span className="text-sm font-normal">SYP</span></div>
          </CardContent>
        </Card>
        {byCategory.map((c) => (
          <Card key={c.key} className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
              <div className="text-lg font-bold">{c.total.toLocaleString("en-US")} <span className="text-xs font-normal text-muted-foreground">SYP</span></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">الفئة</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
            ) : expenses?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">لا يوجد مصروفات مسجلة</TableCell></TableRow>
            ) : expenses?.map((expense) => (
              <TableRow key={expense.id} className="border-border/50 hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground"/>
                    {format(new Date(expense.date), "dd/MM/yyyy")}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{expense.title}</div>
                  {expense.notes && <div className="text-xs text-muted-foreground mt-0.5">{expense.notes}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`border-transparent ${categoryColors[expense.category]}`}>
                    {categoryLabels[expense.category] ?? expense.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-bold text-destructive">{expense.amount.toLocaleString("en-US")} SYP</span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(expense.id)}>
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تسجيل مصروف جديد</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>العنوان *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="إيجار شهري"/></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>المبلغ (SYP) *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label>التاريخ</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الفئة</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..."/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createExpense.isPending}><Plus className="w-4 h-4 ml-2"/> تسجيل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا المصروف؟</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteExpense.isPending}><Trash2 className="w-4 h-4 ml-2"/> حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
