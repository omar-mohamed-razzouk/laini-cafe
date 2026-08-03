import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { StoredUser } from "./permissions";

export function setupAuth() {
  setAuthTokenGetter(() => localStorage.getItem("brewdesk_token"));
}

export function setToken(token: string) {
  localStorage.setItem("brewdesk_token", token);
}

export function clearToken() {
  localStorage.removeItem("brewdesk_token");
  localStorage.removeItem("brewdesk_staff_id");
  localStorage.removeItem("brewdesk_user");
}

export function getToken() {
  return localStorage.getItem("brewdesk_token");
}

export function setStaffId(id: number) {
  localStorage.setItem("brewdesk_staff_id", String(id));
}

export function getStaffId(): number {
  return parseInt(localStorage.getItem("brewdesk_staff_id") ?? "1") || 1;
}

export function setStoredUser(user: StoredUser) {
  localStorage.setItem("brewdesk_user", JSON.stringify(user));
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem("brewdesk_user");
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}
