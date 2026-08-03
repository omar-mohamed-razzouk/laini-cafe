// All numbers across the app are displayed with English (Latin) digits.
// Dates keep Arabic month/day names but use Latin digits via -u-nu-latn.
export const AR_LATN = "ar-SY-u-nu-latn";

export function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  return n.toLocaleString("en-US");
}

export function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(AR_LATN);
}

export function fmtTime(d: string | Date): string {
  return new Date(d).toLocaleTimeString(AR_LATN, { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(d: string | Date): string {
  return new Date(d).toLocaleString(AR_LATN);
}

// Users may type Arabic-Indic (٠١٢٣٤٥٦٧٨٩) or Extended Arabic (۰۱۲۳۴۵۶۷۸۹)
// digits — plain parseInt/parseFloat return NaN for those, which silently
// falls back to defaults (e.g. 2 guests billed as 1). Normalize first.
export function toEnDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, ".")
    .replace(/[\u066c،,]/g, "");
}

export function intVal(s: string | null | undefined): number {
  if (!s) return NaN;
  return parseInt(toEnDigits(String(s)), 10);
}

export function numVal(s: string | null | undefined): number {
  if (!s) return NaN;
  return parseFloat(toEnDigits(String(s)));
}

export function fmtHoursLabel(h: number): string {
  return h % 1 === 0 ? `${h} س` : `${Math.floor(h)}.5 س`;
}
