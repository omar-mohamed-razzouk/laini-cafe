import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin, useForceChangePassword } from "@workspace/api-client-react";
import { setToken, setStaffId, setStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, KeyRound } from "lucide-react";

type LoginErrorData = { error?: string; code?: string } | null | undefined;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loginMutation = useLogin();
  const forceChangeMutation = useForceChangePassword();

  const enterApp = (data: { token: string; staff: { id: number; name: string; role: string; permissions?: unknown } }) => {
    setToken(data.token);
    setStaffId(data.staff.id);
    setStoredUser({
      id: data.staff.id,
      name: data.staff.name,
      role: data.staff.role,
      permissions: (data.staff.permissions as Record<string, boolean> | null) ?? null,
    });
    setLocation("/dashboard");
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { username, password } },
      {
        onSuccess: (data) => enterApp(data),
        onError: (error) => {
          const err = error as unknown as { status?: number; data?: LoginErrorData };
          if (err?.status === 403 && err?.data?.code === "DEFAULT_PASSWORD") {
            setMustChangePassword(true);
            toast({
              title: "تغيير كلمة المرور مطلوب / Password Change Required",
              description: "كلمة المرور الحالية افتراضية — اختر كلمة مرور جديدة للمتابعة",
            });
            return;
          }
          const serverMessage = err?.data?.error;
          toast({
            variant: "destructive",
            title: "خطأ في تسجيل الدخول / Login Error",
            description: serverMessage || "يرجى التحقق من اسم المستخدم وكلمة المرور",
          });
        },
      }
    );
  };

  const handleForceChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "خطأ / Error",
        description: "كلمتا المرور غير متطابقتين",
      });
      return;
    }
    forceChangeMutation.mutate(
      { data: { username, currentPassword: password, newPassword } },
      {
        onSuccess: (data) => {
          toast({
            title: "تم بنجاح / Success",
            description: "تم تغيير كلمة المرور وتسجيل الدخول",
          });
          enterApp(data);
        },
        onError: (error) => {
          const err = error as unknown as { data?: LoginErrorData };
          toast({
            variant: "destructive",
            title: "خطأ / Error",
            description: err?.data?.error || "تعذر تغيير كلمة المرور",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-card-border p-8 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            {mustChangePassword ? <KeyRound className="w-8 h-8" /> : <ChefHat className="w-8 h-8" />}
          </div>
          <h1 className="text-3xl font-bold text-foreground">BrewDesk</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm uppercase tracking-widest">
            {mustChangePassword ? "New Password Required" : "Command Center"}
          </p>
        </div>

        {mustChangePassword ? (
          <form onSubmit={handleForceChange} className="space-y-6">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              كلمة المرور الحالية افتراضية ويجب تغييرها قبل الدخول.
              <br />
              اختر كلمة مرور جديدة (6 أحرف على الأقل).
            </p>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-bold text-foreground">كلمة المرور الجديدة / New Password</Label>
              <Input
                id="new-password" type="password" dir="ltr" placeholder="••••••••"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="h-12 bg-input/50 border-border focus:ring-primary font-mono text-lg" required minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-bold text-foreground">تأكيد كلمة المرور / Confirm Password</Label>
              <Input
                id="confirm-password" type="password" dir="ltr" placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 bg-input/50 border-border focus:ring-primary font-mono text-lg" required minLength={6}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-bold tracking-wide" disabled={forceChangeMutation.isPending}>
              {forceChangeMutation.isPending ? "جاري الحفظ..." : "تغيير ودخول / Change & Login"}
            </Button>
            <Button
              type="button" variant="ghost" className="w-full"
              onClick={() => { setMustChangePassword(false); setNewPassword(""); setConfirmPassword(""); }}
            >
              رجوع / Back
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-bold text-foreground">Username / اسم المستخدم</Label>
              <Input
                id="username" type="text" dir="ltr" placeholder="admin"
                value={username} onChange={(e) => setUsername(e.target.value)}
                className="h-12 bg-input/50 border-border focus:ring-primary font-mono text-lg" required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold text-foreground">Password / كلمة المرور</Label>
              <Input
                id="password" type="password" dir="ltr" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-input/50 border-border focus:ring-primary font-mono text-lg" required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-bold tracking-wide" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "جاري الدخول..." : "دخول / Login"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
