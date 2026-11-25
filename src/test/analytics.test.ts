import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
const init = vi.fn();
vi.mock("@amplitude/analytics-browser", () => ({
  init: (...a: unknown[]) => init(...a),
  track: (...a: unknown[]) => track(...a),
  identify: vi.fn(),
  setOptOut: vi.fn(),
  reset: vi.fn(),
  Identify: class { setOnce() { return this; } },
}));

import { setConsent, CONSENT_KEY } from "@/lib/analytics/consent";
import { sanitizeProps } from "@/lib/analytics/sanitize";
import * as a from "@/lib/analytics";

const AMP = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  localStorage.clear();
  document.head.querySelectorAll("script").forEach((s) => s.remove());
  track.mockClear();
  init.mockClear();
  a.__resetForTests();
  vi.unstubAllEnvs();
});

describe("consent gate", () => {
  it("loads nothing without opt-in, even with keys", async () => {
    vi.stubEnv("VITE_SUZI_AMPLITUDE_API_KEY", AMP);
    vi.stubEnv("VITE_SUZI_GA4_MEASUREMENT_ID", "G-ABC1234");
    expect(await a.startAnalytics()).toBe(false);
    expect(init).not.toHaveBeenCalled();
    expect(document.querySelectorAll("script[data-suzi-analytics]")).toHaveLength(0);
  });

  it("loads nothing after opt-in when no keys are configured", async () => {
    setConsent("granted");
    expect(await a.startAnalytics()).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it("rejects malformed keys rather than guessing", () => {
    vi.stubEnv("VITE_SUZI_AMPLITUDE_API_KEY", "not-a-key");
    vi.stubEnv("VITE_SUZI_GA4_MEASUREMENT_ID", "UA-123");
    expect(a.getAnalyticsConfig()).toEqual({ amplitudeKey: undefined, gaId: undefined });
  });

  it("loads both after opt-in, and revoke removes GA script", async () => {
    vi.stubEnv("VITE_SUZI_AMPLITUDE_API_KEY", AMP);
    vi.stubEnv("VITE_SUZI_GA4_MEASUREMENT_ID", "G-ABC1234");
    setConsent("granted");
    expect(await a.startAnalytics()).toBe(true);
    expect(init).toHaveBeenCalledOnce();
    expect(document.querySelectorAll("script[data-suzi-analytics]")).toHaveLength(1);
    setConsent("denied");
    a.stopAnalytics();
    expect(localStorage.getItem(CONSENT_KEY)).toBe("denied");
    expect(document.querySelectorAll("script[data-suzi-analytics]")).toHaveLength(0);
    a.trackPageView("/");
    expect(track).not.toHaveBeenCalled();
  });
});

describe("no PII", () => {
  it("drops emails, URLs, unknown keys and query strings", () => {
    const out = sanitizeProps({
      cta_id: "a@b.com",
      cta_location: "https://example.com/data",
      page_path: "/pinq?email=a@b.com",
      body: "secret note",
      contact_email: "x@y.org",
      entity_scope: "suzi",
    });
    expect(out).toEqual({ page_path: "/pinq", entity_scope: "suzi" });
  });
});

describe("conversions", () => {
  it("emits exactly one conversion per persisted submission", async () => {
    vi.stubEnv("VITE_SUZI_AMPLITUDE_API_KEY", AMP);
    setConsent("granted");
    await a.startAnalytics();
    expect(a.trackConversion("id-1", "share_idea")).toBe(true);
    expect(a.trackConversion("id-1", "share_idea")).toBe(false);
    const conv = track.mock.calls.filter((c) => c[0] === "conversion_completed");
    expect(conv).toHaveLength(1);
    expect(JSON.stringify(conv[0]?.[1])).not.toMatch(/@|https?:/);
  });

  it("emits no conversion without a persisted id", () => {
    expect(a.trackConversion("", "share_idea")).toBe(false);
  });
});

describe("consent revocation during initialization", () => {
  it("does not initialize any vendor when consent is revoked while the import is pending", async () => {
    vi.stubEnv("VITE_SUZI_AMPLITUDE_API_KEY", AMP);
    vi.stubEnv("VITE_SUZI_GA4_MEASUREMENT_ID", "G-ABC1234");
    setConsent("granted");
    const pending = a.startAnalytics();
    // Revoke before the awaited vendor import resolves: stopAnalytics() has
    // no Amplitude handle or GA id to tear down yet.
    setConsent("denied");
    a.stopAnalytics();
    expect(await pending).toBe(false);
    expect(init).not.toHaveBeenCalled();
    expect(document.querySelectorAll("script[data-suzi-analytics]")).toHaveLength(0);
    a.trackPageView("/");
    expect(track).not.toHaveBeenCalled();
  });

  it("queues a conversion submitted during initialization and delivers it once ready", async () => {
    vi.stubEnv("VITE_SUZI_AMPLITUDE_API_KEY", AMP);
    setConsent("granted");
    const pending = a.startAnalytics();
    expect(a.trackConversion("id-pending", "share_idea")).toBe(true);
    expect(track).not.toHaveBeenCalled();
    expect(await pending).toBe(true);
    const conv = track.mock.calls.filter((c) => c[0] === "conversion_completed");
    expect(conv).toHaveLength(1);
    expect(a.trackConversion("id-pending", "share_idea")).toBe(false);
    expect(track.mock.calls.filter((c) => c[0] === "conversion_completed")).toHaveLength(1);
  });

  it("drops a queued conversion when consent is revoked before initialization completes", async () => {
    vi.stubEnv("VITE_SUZI_AMPLITUDE_API_KEY", AMP);
    setConsent("granted");
    const pending = a.startAnalytics();
    expect(a.trackConversion("id-dropped", "share_idea")).toBe(true);
    setConsent("denied");
    a.stopAnalytics();
    expect(await pending).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });
});

describe("session-only consent fallback", () => {
  it("retains the choice in memory when localStorage is unavailable", async () => {
    const throwing = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    const original = window.localStorage;
    Object.defineProperty(window, "localStorage", { value: throwing, configurable: true });
    try {
      const consent = await import("@/lib/analytics/consent");
      consent.setConsent("granted");
      expect(consent.getConsent()).toBe("granted");
      expect(consent.hasConsent()).toBe(true);
      consent.setConsent("denied");
      expect(consent.getConsent()).toBe("denied");
      expect(consent.hasConsent()).toBe(false);
    } finally {
      Object.defineProperty(window, "localStorage", { value: original, configurable: true });
    }
  });
});

describe("consent precedence: failed writes and cleared storage", () => {
  const throwingWrites = (store: Map<string, string>) => ({
    getItem: (k: string) => store.get(k) ?? null,
    setItem: () => { throw new Error("quota"); },
    removeItem: (k: string) => { store.delete(k); },
  });

  it("honors the session choice when its storage write fails, in both directions", async () => {
    const consent = await import("@/lib/analytics/consent");
    const store = new Map<string, string>([[consent.CONSENT_KEY, "granted"]]);
    const original = window.localStorage;
    Object.defineProperty(window, "localStorage", { value: throwingWrites(store), configurable: true });
    try {
      consent.setConsent("denied");
      expect(consent.getConsent()).toBe("denied");
      expect(consent.hasConsent()).toBe(false);
      store.set(consent.CONSENT_KEY, "denied");
      consent.setConsent("granted");
      expect(consent.getConsent()).toBe("granted");
      expect(consent.hasConsent()).toBe(true);
    } finally {
      Object.defineProperty(window, "localStorage", { value: original, configurable: true });
      consent.setConsent("denied");
      localStorage.clear();
    }
  });

  it("treats externally cleared storage as no consent, not the remembered grant", async () => {
    const consent = await import("@/lib/analytics/consent");
    consent.setConsent("granted");
    expect(consent.getConsent()).toBe("granted");
    localStorage.clear();
    expect(consent.getConsent()).toBe("unset");
    expect(consent.hasConsent()).toBe(false);
  });
});
