import { useState } from "react";
import {
  useListStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  getListStaffQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, UserCog, Trash2, Key, Shield, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import {
  ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS, ROLE_DEFAULTS,
  type PermKey,
} from "@/lib/permissions";

const roleLabels: Record<string, string> = {
  admin: "مدير عام", manager: "مدير", cashier: "كاشير", waiter: "نادل", kitchen: "مطبخ",
};
const roleColors: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400",
  manager: "bg-purple-500/20 text-purple-400",
  cashier: "bg-blue-500/20 text-blue-400",
  waiter: "bg-green-500/20 text-green-400",
  kitchen: "bg-orange-500/20 text-orange-400",
};

type Form = { name: string; username: string; password: string; role: string; phone: string; isActive: boolean };
const empty = (): Form => ({ name: "", username: "", password: "", role: "waiter", phone: "", isActive: true });

type PermMap = Record<string, boolean>;

export default function Staff() {
  const { data: staff, isLoading } = useListStaff();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, can } = usePermissions();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty());
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [permOpen, setPermOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<{ id: number; name: string; role: string } | null>(null);
  const [permMap, setPermMap] = useState<PermMap>({});
  const [useCustom, setUseCustom] = useState(false);

  const setField = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditId(null); setForm(empty()); setOpen(true); };
  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({ name: s.name, username: s.username, password: "", role: s.role, phone: s.phone ?? "", isActive: s.isActive });
    setOpen(true);
  };

  const openPerms = (s: any) => {
    setPermTarget({ id: s.id, name: s.name, role: s.role });
    const custom = s.permissions as PermMap | null;
    if (custom && Object.keys(custom).length > 0) {
      setPermMap(custom);
      setUseCustom(true);
    } else {
      const defaults = ROLE_DEFAULTS[s.role] ?? [];
      const map: PermMap = {};
      for (const p of ALL_PERMISSIONS) map[p] = defaults.includes(p as PermKey);
      setPermMap(map);
      setUseCustom(false);
    }
    setPermOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.username) { toast({ title: "يرجى ملء الاسم واسم المستخدم", variant: "destructive" }); return; }
    if (!editId && !form.password) { toast({ title: "يرجى إدخال كلمة المرور", variant: "destructive" }); return; }

    const inv = () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });

    if (editId) {
      const data: any = { name: form.name, role: form.role as any, phone: form.phone || undefined, isActive: form.isActive };
      if (form.password) data.password = form.password;
      updateStaff.mutate({ id: editId, data }, {
        onSuccess: () => { inv(); setOpen(false); toast({ title: "تم تعديل بيانات الموظف" }); },
        onError: () => toast({ title: "فشل التعديل", variant: "destructive" }),
      });
    } else {
      createStaff.mutate(
        { data: { name: form.name, username: form.username, password: form.password, role: form.role as any, phone: form.phone || undefined } },
        {
          onSuccess: () => { inv(); setOpen(false); toast({ title: "تم إضافة الموظف" }); },
          onError: (e: any) => toast({ title: e?.message?.includes("username") ? "اسم المستخدم مستخدم مسبقاً" : "فشل الإضافة", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    deleteStaff.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() }); setDeleteConfirm(null); toast({ title: "تم حذف الموظف" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "فشل الحذف", variant: "destructive" }),
    });
  };

  const handleSavePerms = () => {
    if (!permTarget) return;
    const permsToSave = useCustom ? permMap : {};
    updateStaff.mutate(
      { id: permTarget.id, data: { permissions: Object.keys(permsToSave).length > 0 ? permsToSave : null } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
          setPermOpen(false);
          toast({ title: `تم حفظ صلاحيات ${permTarget.name}` });
        },
        onError: () => toast({ title: "فشل حفظ الصلاحيات", variant: "destructive" }),
      }
    );
  };

  const resetToDefaults = () => {
    if (!permTarget) return;
    const defaults = ROLE_DEFAULTS[permTarget.role] ?? [];
    const map: PermMap = {};
    for (const p of ALL_PERMISSIONS) map[p] = defaults.includes(p as PermKey);
    setPermMap(map);
  };

  const grantAll = () => {
    const map: PermMap = {};
    for (const p of ALL_PERMISSIONS) map[p] = true;
    setPermMap(map);
  };

  const revokeAll = () => {
    const map: PermMap = {};
    for (const p of ALL_PERMISSIONS) map[p] = false;
    setPermMap(map);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">فريق العمل / Staff</h2>
          <p className="text-sm text-muted-foreground">{staff?.length ?? 0} موظف مسجل</p>
        </div>
        {can("staff.manage") && (
          <Button onClick={openAdd}><Plus className="w-4 h-4 ml-2"/> إضافة موظف</Button>
        )}
      </div>

      <Card className="bg-card border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-right">الموظف</TableHead>
              <TableHead className="text-right">اسم المستخدم</TableHead>
              <TableHead className="text-right">الدور</TableHead>
              <TableHead className="text-right">الصلاحيات</TableHead>
              <TableHead className="text-right">الهاتف</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              {can("staff.manage") && <TableHead className="text-right">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
            ) : staff?.map((s) => {
              const hasCustomPerms = s.permissions && Object.keys(s.permissions).length > 0;
              return (
                <TableRow key={s.id} className="border-border/50 hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                        {s.name.substring(0, 2)}
                      </div>
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{s.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-transparent ${roleColors[s.role] ?? ""}`}>
                      {roleLabels[s.role] ?? s.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.role === "admin" ? (
                      <span className="text-xs text-red-400 flex items-center gap-1"><Shield className="w-3 h-3"/> كاملة</span>
                    ) : hasCustomPerms ? (
                      <span className="text-xs text-amber-400">مخصصة</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">افتراضية للدور</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">{s.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.isActive}
                      disabled={!can("staff.manage")}
                      onCheckedChange={(val) =>
                        can("staff.manage") && updateStaff.mutate({ id: s.id, data: { isActive: val } }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() }),
                        })
                      }
                    />
                  </TableCell>
                  {can("staff.manage") && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50/10" onClick={() => openEdit(s)} title="تعديل">
                          <UserCog className="w-4 h-4"/>
                        </Button>
                        {isAdmin && s.role !== "admin" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:bg-amber-50/10" onClick={() => openPerms(s)} title="الصلاحيات">
                            <Shield className="w-4 h-4"/>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(s.id)} title="حذف">
                          <Trash2 className="w-4 h-4"/>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل بيانات موظف" : "إضافة موظف جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>الاسم الكامل *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="محمد أحمد"/></div>
              <div className="space-y-1.5">
                <Label>اسم المستخدم *</Label>
                <Input value={form.username} onChange={(e) => setField("username", e.target.value)} placeholder="mohammed" disabled={!!editId} dir="ltr"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Key className="w-3 h-3"/> {editId ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور *"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="••••••••"/>
              </div>
              <div className="space-y-1.5"><Label>رقم الهاتف</Label><Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+963..." dir="ltr"/></div>
            </div>
            <div className="space-y-1.5">
              <Label>الدور الوظيفي</Label>
              <Select value={form.role} onValueChange={(v) => setField("role", v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editId && (
              <div className="flex items-center gap-3">
                <Switch checked={form.isActive} onCheckedChange={(v) => setField("isActive", v)}/>
                <Label>الموظف نشط</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={createStaff.isPending || updateStaff.isPending}>
              {editId ? "حفظ التعديلات" : <><Plus className="w-4 h-4 ml-2"/> إضافة</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Matrix Dialog */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500"/> صلاحيات {permTarget?.name}</DialogTitle>
            <DialogDescription>
              الدور: {roleLabels[permTarget?.role ?? ""] ?? permTarget?.role} — يمكنك تخصيص الصلاحيات بشكل منفرد لهذا الموظف
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div className="flex items-center gap-2">
                <Switch checked={useCustom} onCheckedChange={setUseCustom}/>
                <span className="text-sm font-medium">صلاحيات مخصصة (تتجاوز الافتراضيات)</span>
              </div>
              {useCustom && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetToDefaults} className="h-7 text-xs gap-1"><RefreshCw className="w-3 h-3"/> إعادة للافتراضي</Button>
                  <Button variant="outline" size="sm" onClick={grantAll} className="h-7 text-xs text-green-500 border-green-500/30">منح الكل</Button>
                  <Button variant="outline" size="sm" onClick={revokeAll} className="h-7 text-xs text-red-500 border-red-500/30">سحب الكل</Button>
                </div>
              )}
            </div>

            {useCustom && (
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label} className="border border-border/50 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-muted/30 text-sm font-bold text-muted-foreground">{group.label}</div>
                    <div className="grid grid-cols-2 gap-0 divide-y divide-border/30">
                      {group.keys.map((perm) => (
                        <div key={perm} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                          <Checkbox
                            id={perm}
                            checked={!!permMap[perm]}
                            onCheckedChange={(v) => setPermMap((m) => ({ ...m, [perm]: !!v }))}
                          />
                          <label htmlFor={perm} className="flex flex-col cursor-pointer flex-1">
                            <span className="text-sm">{PERMISSION_LABELS[perm].ar}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{perm}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!useCustom && (
              <div className="p-4 bg-muted/20 rounded-lg text-sm text-muted-foreground text-center">
                سيتم استخدام الصلاحيات الافتراضية لدور «{roleLabels[permTarget?.role ?? ""] ?? permTarget?.role}»
                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                  {(ROLE_DEFAULTS[permTarget?.role ?? ""] ?? []).map((p) => (
                    <span key={p} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">{PERMISSION_LABELS[p as PermKey].ar}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermOpen(false)}>إلغاء</Button>
            <Button onClick={handleSavePerms} disabled={updateStaff.isPending} className="gap-2">
              <Shield className="w-4 h-4"/> حفظ الصلاحيات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteStaff.isPending}>
              <Trash2 className="w-4 h-4 ml-2"/> حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
