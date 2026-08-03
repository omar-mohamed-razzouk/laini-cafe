const SETTINGS_KEY = "brewdesk_settings";
const SETTINGS_EVENT = "brewdesk_settings_changed";

export interface CafeSettings {
  cafeName: string;
  cafeNameAr: string;
  phone: string;
  address: string;
  taxPercent: number;
  serviceCharge: number;
  printAutomatically: boolean;
  receiptFooter: string;
}

const defaults: CafeSettings = {
  cafeName: "BrewDesk Cafe",
  cafeNameAr: "كافيه بريو ديسك",
  phone: "+963 999 000 000",
  address: "دمشق، سوريا",
  taxPercent: 0,
  serviceCharge: 0,
  printAutomatically: false,
  receiptFooter: "شكراً لزيارتكم — Thank you for visiting!",
};

export function getSettings(): CafeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Partial<CafeSettings>): void {
  const current = getSettings();
  const next = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }));
}

export { SETTINGS_EVENT };
