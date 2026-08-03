import { useState, useEffect } from "react";
import { getSettings, CafeSettings, SETTINGS_EVENT } from "@/lib/settings";

export function useSettings(): CafeSettings {
  const [settings, setSettings] = useState<CafeSettings>(getSettings);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CafeSettings>).detail;
      setSettings(detail);
    };
    window.addEventListener(SETTINGS_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_EVENT, handler);
  }, []);

  return settings;
}
