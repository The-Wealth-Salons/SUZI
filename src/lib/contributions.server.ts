import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContributionInput } from "./contribution-schema";

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };
export const UNAVAILABLE = "Contributions are temporarily unavailable. Please check back soon.";
const FAILED = "We couldn't save this right now. Please try again later.";
const LIMIT_PER_HOUR = 5;

/** Writes only to the provided external SUZI client. Null client => fail closed, no I/O. */
export async function persistContribution(
  db: SupabaseClient | null,
  data: ContributionInput,
  clientHash: string,
): Promise<SubmitResult> {
  if (!db) return { ok: false, error: UNAVAILABLE };
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: rlErr } = await db
      .from("submission_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", clientHash)
      .gte("created_at", since);
    if (rlErr) return { ok: false, error: FAILED };
    if ((count ?? 0) >= LIMIT_PER_HOUR) return { ok: false, error: "Too many submissions. Please try again in an hour." };
    await db.from("submission_rate_limits").insert({ client_hash: clientHash });
    const email = data.email ? data.email : null;
    const { data: row, error } = await db
      .from("pinq_contributions")
      .insert({
        kind: data.kind,
        source_url: data.kind === "suggest_source" ? data.sourceUrl : null,
        body: data.body || null,
        contact_email: email,
        contact_permission: email ? data.permission : false,
      })
      .select("id")
      .single();
    if (error || !row?.id) {
      console.error("contribution insert failed", error?.code);
      return { ok: false, error: FAILED };
    }
    return { ok: true, id: String(row.id) };
  } catch {
    console.error("contribution handler failed");
    return { ok: false, error: FAILED };
  }
}
