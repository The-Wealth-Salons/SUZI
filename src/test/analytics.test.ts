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
