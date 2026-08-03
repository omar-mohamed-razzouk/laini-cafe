import { useState } from "react";
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useGetCustomerSummary,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Plus, Phone, Building2, Star, TrendingUp, Calendar, Trash2, Edit3, ChevronRight, X, Search
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: number; name: string; nameAr?: string | null; phone?: string | null;
  email?: string | null; company?: string | null; notes?: string | null;
  totalVisits: number; totalSpent: number; createdAt: string;
};

const emptyForm = { name: "", nameAr: "", phone: "", email: "", company: "", notes: "" };

export default function Customers() {
  const { data: customers, isLoading } = useListCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: summary } = useGetCustomerSummary(selected?.id ?? 0, {
    query: { enabled: !!selected && detailOpen, queryKey: [] },
  });

  const filtered = customers?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.nameAr ?? "").includes(search) ||
    (c.phone ?? "").includes(search) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = () => {
    if (!form.name) return;
    createCustomer.mutate(
      { data: { name: form.name, nameAr: form.nameAr || undefined, phone: form.phone || undefined, email: form.email || undefined, company: form.company || undefined, notes: form.notes || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          setAddOpen(false); setForm(emptyForm);
          toast({ title: "تم إضافة الزبون" });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  const handleEdit = () => {
    if (!selected || !form.name) return;
    updateCustomer.mutate(
      { id: selected.id, data: { name: form.name, nameAr: form.nameAr || undefined, phone: form.phone || undefined, email: form.email || undefined, company: form.company || undefined, notes: form.notes || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          setEditOpen(false);
          toast({ title: "تم تحديث بيانات الزبون" });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCustomer.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          setDetailOpen(false);
          toast({ title: "تم حذف الزبون" });
        },
      }
    );
  };

  const openEdit = (c: Customer) => {
    setSelected(c);
    setForm({ name: c.name, nameAr: c.nameAr ?? "", phone: c.phone ?? "", email: c.email ?? "", company: c.company ?? "", notes: c.notes ?? "" });
    setEditOpen(true);
  };

  const openDetail = (c: Customer) => {
    setSelected(c);
    setDetailOpen(true);
  };

  const statCard = (label: string, value: number | string, sub?: string) => (
    <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
      <div className="text-xl font-black text-primary">{typeof value === "number" ? value.toLocaleString("en-US") : value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );

  const FormFields = () => (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>الاسم (عربي) <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="محمد أحمد" />
        </div>
        <div className="space-y-1.5">
          <Label>Name (English)</Label>
          <Input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="Mohammad Ahmad" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>رقم الهاتف</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+963 999 ..." dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>الشركة / الجهة</Label>
          <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="شركة الأمل" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>الإيميل</Label>
        <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="تفاصيل الاحتياجات الخاصة..." />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">الزبائن الدائمون / Regular Customers</h2>
          <p className="text-sm text-muted-foreground">إدارة الزبائن الثابتين وتتبع سجل حجوزاتهم ومدفوعاتهم</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setAddOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> إضافة زبون
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pr-9" placeholder="بحث بالاسم أو الهاتف أو الشركة..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Stats Bar */}
      {customers && customers.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-primary">{customers.length}</div>
              <div className="text-xs text-muted-foreground">إجمالي الزبائن</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-green-500">{customers.reduce((s, c) => s + c.totalSpent, 0).toLocaleString("en-US")}</div>
              <div className="text-xs text-muted-foreground">إجمالي الإيرادات (SYP)</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-black text-amber-500">{customers.reduce((s, c) => s + c.totalVisits, 0)}</div>
              <div className="text-xs text-muted-foreground">إجمالي الزيارات</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">{search ? "لا يوجد نتائج" : "لا يوجد زبائن مسجّلون"}</p>
          <p className="text-sm">{search ? "جرّب بحثاً مختلفاً" : "اضغط على «إضافة زبون» لتسجيل أول زبون دائم"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c.id} className="bg-card border-border/50 hover:border-primary/30 transition-all cursor-pointer" onClick={() => openDetail(c)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{c.name}</span>
                    {c.totalVisits >= 10 && <Badge className="text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30"><Star className="w-2.5 h-2.5 ml-0.5" />VIP</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                    {c.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.company}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0 text-right">
                  <div>
                    <div className="text-sm font-bold text-green-500">{c.totalSpent.toLocaleString("en-US")} SYP</div>
                    <div className="text-[10px] text-muted-foreground">إجمالي المدفوع</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold">{c.totalVisits}</div>
                    <div className="text-[10px] text-muted-foreground">زيارة</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground my-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>إضافة زبون دائم جديد</DialogTitle></DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!form.name || createCustomer.isPending}><Plus className="w-4 h-4 ml-2" /> إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>تعديل بيانات — {selected?.name}</DialogTitle></DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEdit} disabled={!form.name || updateCustomer.isPending}>حفظ التغييرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">
                {selected?.name.charAt(0)}
              </div>
              {selected?.name}
              {selected && selected.totalVisits >= 10 && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30"><Star className="w-3 h-3 ml-1" />VIP</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Contact info */}
            <div className="flex flex-wrap gap-3 text-sm">
              {selected?.phone && <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full"><Phone className="w-3.5 h-3.5" />{selected.phone}</span>}
              {selected?.company && <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full"><Building2 className="w-3.5 h-3.5" />{selected.company}</span>}
              {selected?.email && <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full text-xs">{selected.email}</span>}
              {selected?.notes && <span className="text-muted-foreground text-xs italic">{selected.notes}</span>}
            </div>

            {/* Payment summary */}
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />ملخص المدفوعات</h3>
              {summary ? (
                <div className="grid grid-cols-5 gap-3">
                  {statCard("اليوم", summary.payments.today, "SYP")}
                  {statCard("هذا الأسبوع", summary.payments.thisWeek, "SYP")}
                  {statCard("هذا الشهر", summary.payments.thisMonth, "SYP")}
                  {statCard("هذا العام", summary.payments.thisYear, "SYP")}
                  {statCard("الإجمالي", summary.payments.allTime, "SYP")}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              )}
            </div>

            {/* Visit stats */}
            {summary && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="text-3xl font-black text-primary">{summary.visitCount}</div>
                  <div className="text-sm text-muted-foreground">إجمالي الجلسات</div>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="text-3xl font-black text-amber-500">{summary.bookingCount}</div>
                  <div className="text-sm text-muted-foreground">حجوزات مسبقة</div>
                </div>
              </div>
            )}

            {/* Recent invoices */}
            {summary && summary.invoices && summary.invoices.length > 0 && (
              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />آخر الفواتير</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {summary.invoices.slice(0, 10).map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg border border-border/30 text-sm">
                      <div>
                        <div className="font-medium">فاتورة #{inv.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString("ar-SY-u-nu-latn")} — {inv.paymentMethod === "cash" ? "كاش" : "بطاقة"}
                        </div>
                      </div>
                      <div className="font-bold text-primary">{inv.total.toLocaleString("en-US")} SYP</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => selected && handleDelete(selected.id)}>
              <Trash2 className="w-4 h-4 ml-1" /> حذف الزبون
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { if (selected) openEdit(selected); setDetailOpen(false); }}><Edit3 className="w-4 h-4 ml-1" /> تعديل</Button>
              <Button variant="outline" onClick={() => setDetailOpen(false)}><X className="w-4 h-4 ml-1" /> إغلاق</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
