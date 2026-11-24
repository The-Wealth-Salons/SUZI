export type ConsentState = "granted" | "denied" | "unset";

export const CONSENT_KEY = "suzi.analytics.consent.v1";
export const CONSENT_VERSION = "2026-11-v1";

type Listener = (s: ConsentState) => void;
const listeners = new Set<Listener>();

// Session-only fallback: when storage is unavailable (blocked cookies /
// private mode), the choice is kept in memory for this page session so the
// banner state and the analytics gate agree. Nothing is persisted.
let memoryConsent: ConsentState | null = null;

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    /* storage unavailable: fall through to the session-only value */
  }
  return memoryConsent ?? "unset";
}

export function hasConsent(): boolean {
  return getConsent() === "granted";
}

export function setConsent(s: "granted" | "denied") {
  memoryConsent = s;
  try {
    window.localStorage.setItem(CONSENT_KEY, s);
  } catch {
    /* storage unavailable: session-only, held in memory above */
  }
  listeners.forEach((l) => l(s));
}

export function onConsentChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
