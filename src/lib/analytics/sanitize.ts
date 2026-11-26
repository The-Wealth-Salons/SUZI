/**
 * Candidate BPM event/user property allowlists for entity_scope "suzi".
 * Pending reconciliation with the Control Plane analytics gate before keys go live.
 */
export const EVENT_PROPS = [
  "entity_scope",
  "site",
  "page_path",
  "page_title",
  "route_name",
  "referrer_domain",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "cta_id",
  "cta_location",
  "cta_destination_type",
  "conversion_type",
  "contribution_kind",
  "viewport_class",
  "locale",
  "consent_version",
] as const;

export const USER_PROPS = [
  "entity_scope",
  "first_touch_utm_source",
  "first_touch_utm_medium",
  "first_touch_utm_campaign",
  "first_touch_referrer_domain",
  "first_touch_landing_path",
  "first_touch_at",
  "consent_version",
  "locale",
] as const;

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_RE = /(https?:\/\/|www\.)/i;

export function sanitizeValue(v: unknown): string | number | boolean | undefined {
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, 100);
  if (!s || EMAIL_RE.test(s) || URL_RE.test(s)) return undefined;
  return s;
}

export function sanitizeProps(
  props: Record<string, unknown>,
  allow: readonly string[] = EVENT_PROPS,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const k of allow) {
    if (!(k in props)) continue;
    let v = props[k];
    if (k === "page_path" || k === "first_touch_landing_path") {
      v = typeof v === "string" ? v.split(/[?#]/)[0] : undefined;
    }
    const clean = sanitizeValue(v);
    if (clean !== undefined) out[k] = clean;
  }
  return out;
}

export function referrerDomain(ref: string): string | undefined {
  try {
    return ref ? new URL(ref).hostname : undefined;
  } catch {
    return undefined;
  }
}
