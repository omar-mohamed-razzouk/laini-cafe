import { intVal, numVal } from "@/lib/format";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Store, Receipt, Printer, CheckCircle2, KeyRound, AlertTriangle, Download } from "lucide-react";
import { getSettings, saveSettings, CafeSettings } from "@/lib/settings";
import { setToken, getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useChangePassword, useResetData, type ResetDataScopes } from "@workspace/api-client-react";
import { usePermissions } from "@/hooks/use-permissions";

const RESET_SCOPE_LABELS: { key: keyof ResetDataScopes; label: string; hint: string }[] = [
  { key: "ordersSessions", label: "الطلبات والجلسات", hint: "حذف كل الطلبات والجلسات وتفريغ الطاولات والغرف" },
  { key: "bookings", label: "الحجوزات", hint: "حذف كل الحجوزات المسجلة" },
  { key: "invoices", label: "الفواتير", hint: "حذف كل الفواتير الصادرة" },
  { key: "expenses", label: "المصروفات", hint: "حذف كل المصروفات المسجلة" },
  { key: "customers", label: "الزبائن", hint: "حذف كل سجلات الزبائن" },
  { key: "inventory", label: "تصفير المخزون", hint: "تصفير كميات المخزون (تبقى الأصناف)" },
];

export default function Settings() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const canReset = can("data.reset");
  const [form, setForm] = useState<CafeSettings>(getSettings());
  const [saved, setSaved] = useState(false);

  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetData = useResetData();
  const [resetScopes, setResetScopes] = useState<ResetDataScopes>({
    ordersSessions: true, bookings: true, invoices: true, expenses: true, customers: false, inventory: false,
  });
  const [resetConfirm, setResetConfirm] = useState("");

  useEffect(() => { setForm(getSettings()); }, []);

  const set = (k: keyof CafeSettings, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    saveSettings(form);
    setSaved(true);
    toast({ title: "تم حفظ الإعدادات بنجاح ✓" });
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = () => {
    if (newPassword.length < 6) {
      toast({ title: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "تأكيد كلمة المرور غير مطابق", variant: "destructive" });
      return;
    }
    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: (res: any) => {
          if (res?.token) setToken(res.token);
          toast({ title: "تم تغيير كلمة المرور بنجاح ✓" });
          setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        },
        onError: (err: any) => {
          const msg = err?.error || err?.message || "تعذّر تغيير كلمة المرور";
          toast({ title: typeof msg === "string" ? msg : "تعذّر تغيير كلمة المرور", variant: "destructive" });
        },
      }
    );
  };

  const toggleScope = (k: keyof ResetDataScopes) =>
    setResetScopes((s) => ({ ...s, [k]: !s[k] }));

  const anyScopeSelected = RESET_SCOPE_LABELS.some((s) => resetScopes[s.key]);

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = getToken();
      const res = await fetch("/api/export/data", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `BrewDesk-Export-${today}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "تم تحميل الملف بنجاح ✓" });
    } catch {
      toast({ title: "تعذّر تصدير البيانات", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleResetData = () => {
    if (resetConfirm !== "RESET") {
      toast({ title: 'اكتب RESET للتأكيد', variant: "destructive" });
      return;
    }
    if (!anyScopeSelected) {
      toast({ title: "اختر نوعاً واحداً على الأقل", variant: "destructive" });
      return;
    }
    resetData.mutate(
      { data: { confirm: "RESET", scopes: resetScopes } },
      {
        onSuccess: (res: any) => {
          toast({ title: res?.message || "تم تصفير البيانات بنجاح ✓" });
          setResetConfirm("");
        },
        onError: (err: any) => {
          const msg = err?.error || err?.message || "تعذّر تصفير البيانات";
          toast({ title: typeof msg === "string" ? msg : "تعذّر تصفير البيانات", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">الإعدادات / Settings</h2>
          <p className="text-sm text-muted-foreground">إعدادات المقهى والفواتير والطباعة</p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          {saved && <CheckCircle2 className="w-4 h-4 text-green-400" />}
          حفظ التغييرات
        </Button>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="w-4 h-4 text-primary" /> معلومات المقهى / Cafe Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>اسم المقهى (عربي)</Label>
              <Input value={form.cafeNameAr} onChange={(e) => set("cafeNameAr", e.target.value)} placeholder="كافيه بريو ديسك" dir="rtl" />
            </div>
            <div className="space-y-1.5">
              <Label>Cafe Name (English)</Label>
              <Input value={form.cafeName} onChange={(e) => set("cafeName", e.target.value)} placeholder="BrewDesk Cafe" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+963 999 000 000" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="دمشق، سوريا" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4 text-primary" /> الفواتير / Invoicing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>نسبة الضريبة % (0 = بدون ضريبة)</Label>
              <Input type="number" min={0} max={100} value={form.taxPercent} onChange={(e) => set("taxPercent", numVal(e.target.value) || 0)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>رسوم الخدمة %</Label>
              <Input type="number" min={0} max={100} value={form.serviceCharge} onChange={(e) => set("serviceCharge", numVal(e.target.value) || 0)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>نص نهاية الفاتورة</Label>
            <Textarea value={form.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} placeholder="شكراً لزيارتكم!" rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="w-4 h-4 text-primary" /> الطباعة / Printing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
            <div>
              <div className="font-medium">طباعة الفاتورة تلقائياً عند الدفع</div>
              <div className="text-xs text-muted-foreground">تُطبع الفاتورة مباشرة بعد إتمام الدفع بدون نافذة معاينة</div>
            </div>
            <Switch checked={form.printAutomatically} onCheckedChange={(v) => set("printAutomatically", v)} />
          </div>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400 space-y-2">
            <div className="font-bold">كيفية الاتصال بالطابعة الحرارية (Thermal Printer)</div>
            <ol className="space-y-1 text-xs list-decimal list-inside text-blue-300">
              <li>وصّل الطابعة الحرارية بـ USB أو شبكة Wi-Fi للكمبيوتر</li>
              <li>ثبّت التعريف (Driver) وتأكد إنها تظهر في إعدادات الطابعات</li>
              <li>عند الضغط على "طباعة"، اختر الطابعة الحرارية من قائمة الطابعات</li>
              <li>في Chrome: Ctrl+P ← اختر الطابعة ← اضغط طباعة</li>
              <li>لضبط حجم الورق: استخدم 80mm × لا نهاية (No limit)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4 text-primary" /> تغيير كلمة المرور / Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">غيّر كلمة مرور حسابك من هنا دون الحاجة لأي إعدادات خارجية.</p>
          <div className="space-y-1.5">
            <Label>كلمة المرور الحالية</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" dir="ltr" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" dir="ltr" placeholder="6 أحرف على الأقل" />
            </div>
            <div className="space-y-1.5">
              <Label>تأكيد كلمة المرور الجديدة</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" dir="ltr" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
              className="gap-2"
            >
              <KeyRound className="w-4 h-4" /> {changePassword.isPending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="w-4 h-4 text-primary" /> تصدير البيانات / Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            تحميل كامل بيانات الكافيه ملف ZIP يحتوي ملفات CSV (فواتير، جلسات، طلبات، مصروفات، زبائن، مخزون، موظفين، قائمة الطعام، حجوزات). الملفات تفتح مباشرةً في Excel.
          </p>
          <div className="flex justify-start">
            <Button onClick={handleExport} disabled={exporting} className="gap-2">
              <Download className="w-4 h-4" />
              {exporting ? "جارٍ التصدير…" : "تحميل كامل البيانات (.zip)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {canReset && (
        <Card className="bg-card border-red-500/40 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-500">
              <AlertTriangle className="w-4 h-4" /> منطقة الخطر — تصفير البيانات / Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              يحذف هذا الإجراء البيانات المحددة نهائياً ولا يمكن التراجع عنه. تبقى إعدادات الطاولات والغرف والقائمة والموظفين كما هي. استخدمه عادةً بعد انتهاء الفترة التجريبية لتبدأ من الصفر.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESET_SCOPE_LABELS.map((s) => (
                <label key={s.key} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 accent-red-500"
                    checked={!!resetScopes[s.key]}
                    onChange={() => toggleScope(s.key)}
                  />
                  <div>
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.hint}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>اكتب <span className="font-mono font-bold text-red-500">RESET</span> للتأكيد</Label>
              <Input value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="RESET" dir="ltr" />
            </div>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={handleResetData}
                disabled={resetData.isPending || resetConfirm !== "RESET" || !anyScopeSelected}
                className="gap-2"
              >
                <AlertTriangle className="w-4 h-4" /> {resetData.isPending ? "جارٍ التصفير…" : "تصفير البيانات المحددة"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pb-6">
        <Button size="lg" onClick={handleSave} className="px-8">
          {saved ? "✓ تم الحفظ" : "حفظ جميع الإعدادات"}
        </Button>
      </div>
    </div>
  );
}
