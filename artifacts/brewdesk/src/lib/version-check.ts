const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/version`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

async function selfHeal(serverVersion: string): Promise<void> {
  const guardKey = `brewdesk_reloaded_for_${serverVersion}`;
  if (sessionStorage.getItem(guardKey)) return;
  sessionStorage.setItem(guardKey, "1");

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // best effort — reload regardless
  }

  window.location.reload();
}

async function check(): Promise<void> {
  const serverVersion = await fetchServerVersion();
  if (serverVersion && serverVersion !== __APP_VERSION__) {
    await selfHeal(serverVersion);
  }
}

export function startVersionCheck(): void {
  void check();
  setInterval(() => void check(), CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
}
