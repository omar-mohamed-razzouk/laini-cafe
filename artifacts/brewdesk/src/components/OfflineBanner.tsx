import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

type Status = "online" | "offline" | "reconnected";

export default function OfflineBanner() {
  const [status, setStatus] = useState<Status>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online",
  );
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const goOnline = () => {
      setStatus("reconnected");
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => setStatus("online"), 3000);
    };
    const goOffline = () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      setStatus("offline");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  if (status === "online") return null;

  const isOffline = status === "offline";

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg sm:text-sm ${
        isOffline ? "bg-amber-600" : "bg-emerald-600"
      }`}
    >
      {isOffline ? (
        <WifiOff className="h-4 w-4 shrink-0" />
      ) : (
        <Wifi className="h-4 w-4 shrink-0" />
      )}
      <span>
        {isOffline
          ? "لا يوجد اتصال بالإنترنت — التطبيق يعرض آخر البيانات وسيتحدّث تلقائياً عند عودة الاتصال"
          : "عاد الاتصال — يتم تحديث البيانات الآن"}
      </span>
    </div>
  );
}
