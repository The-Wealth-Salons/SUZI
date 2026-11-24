import { CONSENT_VERSION, hasConsent } from "./consent";
import { EVENT_PROPS, USER_PROPS, referrerDomain, sanitizeProps } from "./sanitize";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const AMP_RE = /^[a-f0-9]{32}$/i;
const GA_RE = /^G-[A-Z0-9]{4,}$/;

export function getAnalyticsConfig() {
  const amp = (import.meta.env["VITE_SUZI_AMPLITUDE_API_KEY"] as string | undefined)?.trim();
  const ga = (import.meta.env["VITE_SUZI_GA4_MEASUREMENT_ID"] as string | undefined)?.trim();
  return {
    amplitudeKey: amp && AMP_RE.test(amp) ? amp : undefined,
    gaId: ga && GA_RE.test(ga) ? ga : undefined,
  };
}

type Amp = typeof import("@amplitude/analytics-browser");
let amp: Amp | null = null;
let gaId: string | null = null;
let started = false;
// Bumped by stopAnalytics(); a startAnalytics() continuation that resumes
// after an await with a stale generation must not initialize any vendor.
let initGeneration = 0;
const conversions = new Set<string>();
const pendingConversions: Array<{ id: string; kind: string }> = [];

function baseProps(): Record<string, unknown> {
  const w = window.innerWidth;
  const q = new URLSearchParams(window.location.search);
  return {
    entity_scope: "suzi",
    site: "suzilabs.com",
    page_path: window.location.pathname,
    page_title: document.title,
    referrer_domain: referrerDomain(document.referrer),
    utm_source: q.get("utm_source") ?? undefined,
    utm_medium: q.get("utm_medium") ?? undefined,
    utm_campaign: q.get("utm_campaign") ?? undefined,
    utm_content: q.get("utm_content") ?? undefined,
    utm_term: q.get("utm_term") ?? undefined,
    viewport_class: w < 640 ? "small" : w < 1024 ? "medium" : "large",
    locale: navigator.language,
    consent_version: CONSENT_VERSION,
  };
}

const FIRST_TOUCH_KEY = "suzi.analytics.first_touch.v1";
function firstTouch(): Record<string, unknown> {
  try {
    const existing = localStorage.getItem(FIRST_TOUCH_KEY);
    if (existing) return JSON.parse(existing);
    const b = baseProps();
    const ft = {
      entity_scope: "suzi",
      first_touch_utm_source: b["utm_source"],
      first_touch_utm_medium: b["utm_medium"],
      first_touch_utm_campaign: b["utm_campaign"],
      first_touch_referrer_domain: b["referrer_domain"],
      first_touch_landing_path: b["page_path"],
      first_touch_at: new Date().toISOString().slice(0, 10),
      consent_version: CONSENT_VERSION,
      locale: b["locale"],
    };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(sanitizeProps(ft, USER_PROPS)));
    return ft;
  } catch {
    return {};
  }
}

function loadGa(id: string) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false;
  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false, allow_google_signals: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  s.dataset["suziAnalytics"] = "ga4";
  document.head.appendChild(s);
}

/** Loads vendor SDKs. No-op without consent or without valid per-site keys. */
export async function startAnalytics(): Promise<boolean> {
  if (started || typeof window === "undefined" || !hasConsent()) return started;
  const cfg = getAnalyticsConfig();
  if (!cfg.amplitudeKey && !cfg.gaId) return false;
  started = true;
  const generation = initGeneration;
  if (cfg.amplitudeKey) {
    const m = await import("@amplitude/analytics-browser");
    // Consent may have been revoked while the vendor import was pending:
    // stopAnalytics() ran with no vendor handles to tear down, so this
    // continuation must recheck before initializing anything.
    if (generation !== initGeneration || !hasConsent()) return false;
    m.init(cfg.amplitudeKey, { autocapture: false, defaultTracking: false } as never);
    const id = new m.Identify();
    Object.entries(sanitizeProps(firstTouch(), USER_PROPS)).forEach(([k, v]) => id.setOnce(k, v));
    m.identify(id);
    amp = m;
  }
  if (generation !== initGeneration || !hasConsent()) return false;
  if (cfg.gaId) {
    gaId = cfg.gaId;
    loadGa(cfg.gaId);
  }
  flushPendingConversions();
  return true;
}

export function stopAnalytics() {
  initGeneration++;
  pendingConversions.length = 0;
  amp?.setOptOut(true);
  amp?.reset();
  amp = null;
  if (gaId) (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = true;
  document.querySelectorAll("script[data-suzi-analytics]").forEach((n) => n.remove());
  try {
    localStorage.removeItem(FIRST_TOUCH_KEY);
  } catch {
    /* ignore */
  }
  started = false;
}

function emit(
  name: "page_viewed" | "cta_clicked" | "conversion_completed",
  extra: Record<string, unknown>,
): boolean {
  if (!started || !hasConsent()) return false;
  const delivered = amp !== null || (gaId !== null && typeof window.gtag === "function");
  if (!delivered) return false;
  const props = sanitizeProps({ ...baseProps(), ...extra }, EVENT_PROPS);
  amp?.track(name, props);
  if (gaId && window.gtag) {
    window.gtag("event", name === "page_viewed" ? "page_view" : name, props);
  }
  return true;
}

function flushPendingConversions() {
  if (!pendingConversions.length) return;
  const queued = pendingConversions.splice(0, pendingConversions.length);
  for (const { id, kind } of queued) {
    if (conversions.has(id)) continue;
    if (
      emit("conversion_completed", {
        conversion_type: "pinq_contribution",
        contribution_kind: kind,
      })
    ) {
      conversions.add(id);
    }
  }
}

export function trackPageView(routeName: string) {
  emit("page_viewed", { route_name: routeName });
}

export function trackCta(ctaId: string, location: string, destinationType: string) {
  emit("cta_clicked", {
    cta_id: ctaId,
    cta_location: location,
    cta_destination_type: destinationType,
  });
}

/** Exactly one conversion per persisted submission id. */
export function trackConversion(submissionId: string, kind: string): boolean {
  if (!submissionId || conversions.has(submissionId)) return false;
  if (pendingConversions.some((c) => c.id === submissionId)) return false;
  if (!started || !hasConsent()) return false;
  // Only record the id as converted once a vendor has actually received the
  // event; while initialization is still pending, queue it for the flush at
  // the end of startAnalytics() instead of suppressing it forever.
  if (
    emit("conversion_completed", { conversion_type: "pinq_contribution", contribution_kind: kind })
  ) {
    conversions.add(submissionId);
    return true;
  }
  pendingConversions.push({ id: submissionId, kind });
  return true;
}

export function __resetForTests() {
  amp = null;
  gaId = null;
  started = false;
  initGeneration++;
  pendingConversions.length = 0;
  conversions.clear();
}
