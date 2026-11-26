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
    // Quota check + reservation are a single atomic database operation
    // (reserve_submission_slot in the proposed migration): it takes a
    // per-client advisory lock, counts the window and inserts the
    // reservation in one transaction, so concurrent requests cannot all
    // pass the same count. Fail closed: a reservation error or a denied
    // slot stops the contribution write.
    const { data: reserved, error: rlErr } = await db.rpc("reserve_submission_slot", {
      _client_hash: clientHash,
      _limit: LIMIT_PER_HOUR,
      _window_seconds: 3600,
    });
    if (rlErr) return { ok: false, error: FAILED };
    if (!reserved)
      return { ok: false, error: "Too many submissions. Please try again in an hour." };
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
