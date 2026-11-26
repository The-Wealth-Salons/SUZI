// Server-only adapter for the EXTERNAL, customer-owned SUZI Supabase project.
// No fallback to Lovable Cloud, no guessed keys, no dual-write. Fails closed.
import type { SupabaseClient } from "@supabase/supabase-js";

export const APPROVED_SUZI_PROJECT_REF = "suumaiswxijllkkuybnz";

export type ExternalSuziStatus =
  | { state: "ready"; projectRef: string }
  | { state: "disabled" | "unconfigured" | "invalid_url" | "wrong_project" };

type Env = Record<string, string | undefined>;

/** Pure status check. Never performs network I/O. */
export function getExternalSuziStatus(env: Env): ExternalSuziStatus {
  // Owner must explicitly enable writes after verifying the project is active and migrated.
  if (env["SUZI_EXTERNAL_WRITES_ENABLED"] !== "true") return { state: "disabled" };
  const url = env["SUZI_SUPABASE_URL"];
  const key = env["SUZI_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return { state: "unconfigured" };
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return { state: "invalid_url" };
    host = u.hostname;
  } catch {
    return { state: "invalid_url" };
  }
  if (host !== `${APPROVED_SUZI_PROJECT_REF}.supabase.co`) return { state: "wrong_project" };
  return { state: "ready", projectRef: APPROVED_SUZI_PROJECT_REF };
}

type Factory = (url: string, key: string) => SupabaseClient;

/** Returns a client only when status is ready; otherwise null. */
export async function getExternalSuziClient(env: Env, factory?: Factory): Promise<SupabaseClient | null> {
  if (getExternalSuziStatus(env).state !== "ready") return null;
  const url = env["SUZI_SUPABASE_URL"]!;
  const key = env["SUZI_SUPABASE_SERVICE_ROLE_KEY"]!;
  if (factory) return factory(url, key);
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}
