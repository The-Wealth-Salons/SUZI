export type ConsentState = "granted" | "denied" | "unset";

export const CONSENT_KEY = "suzi.analytics.consent.v1";
export const CONSENT_VERSION = "2026-11-v1";

type Listener = (s: ConsentState) => void;
const listeners = new Set<Listener>();

// Session-only fallback: when storage is unavailable (blocked cookies /
// private mode), the choice is kept in memory for this page session so the
// banner state and the analytics gate agree. Nothing is persisted.
// Precedence: a session choice whose persistence FAILED wins over storage
// (the stored value is stale — the write never landed). Otherwise readable
// storage is authoritative, including when it has been cleared externally:
// an emptied store means no recorded consent, not the remembered one.
let memoryConsent: ConsentState | null = null;
let persistenceFailed = false;

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  if (persistenceFailed && memoryConsent) return memoryConsent;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return memoryConsent ?? "unset";
  }
}

export function hasConsent(): boolean {
  return getConsent() === "granted";
}

export function setConsent(s: "granted" | "denied") {
  memoryConsent = s;
  try {
    window.localStorage.setItem(CONSENT_KEY, s);
    persistenceFailed = false;
  } catch {
    /* storage unavailable or write rejected: session-only, held in memory */
    persistenceFailed = true;
  }
  listeners.forEach((l) => l(s));
}

export function onConsentChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
