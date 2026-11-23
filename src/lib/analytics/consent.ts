export type ConsentState = "granted" | "denied" | "unset";

export const CONSENT_KEY = "suzi.analytics.consent.v1";
export const CONSENT_VERSION = "2026-11-v1";

type Listener = (s: ConsentState) => void;
const listeners = new Set<Listener>();

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

export function hasConsent(): boolean {
  return getConsent() === "granted";
}

export function setConsent(s: "granted" | "denied") {
  try {
    window.localStorage.setItem(CONSENT_KEY, s);
  } catch {
    /* storage unavailable: treat as session-only */
  }
  listeners.forEach((l) => l(s));
}

export function onConsentChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
