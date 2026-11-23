# GAP-SYNC-TARGET — resolution record (2026-11-23)

**Status:** Resolved on evidence, with one owner UI act remaining (the Lovable→GitHub connection itself, §5). Until that act lands, the Lovable project is still not this repo's synced surface — but the gap is now fully characterised, the canonical surface is ruled, and nothing about the remaining step is unknown.

**Custody:** the Suzi Space work item "repoint and prove the connection" was Charon-owned. Charon is out; Kali Ma covers the desk; Ymir takes custody of the item for this resolution (2026-11-23).

## 1. The gap as filed (controlplane#1744, §7.2 — verbatim)

> The RQ-0280 census records the Lovable project **"SUZI | suzilabs" (`08e2b810-4497-454c-a746-cd5d92c78ca4`) as UNMATCHED**: it syncs somewhere outside this org — not to The-Wealth-Salons/SUZI. Until that is resolved, the Lovable project must not be treated as SUZI's surface: scaffolding built in the GitHub repo and features present in the Lovable project are two different bodies of work with no verified join. What must be resolved, in order: (1) where the Lovable project actually syncs (which repo/org), established by a read of the project's sync target; (2) whether that target is a deliberate separate home or a mis-pointing; (3) B.'s ruling on which surface is canonical for SUZI going forward.

A later review correction stands and is preserved here: the #1717 baseline refuted the org match but did **not** establish an outside-org target — the correct formulation until this record was "target unknown."

## 2. Resolution (1) — where the project actually syncs: nowhere in GitHub

Established 2026-11-23 by live reads (Lovable connector + GitHub REST, ymir-writer App):

- The project lives in B.'s Lovable workspace **"BPM Brands"** (`BdaIHxv2NjOeabK9ROiy`, owner ops@bpmbrands.org), created 2026-11-06, last edited 2026-11-17, published, `latest_commit_sha` `419cd9c019cb45ebe76a8d91f9cee3256853b04d`.
- That commit is **not** in this repo's history (GitHub API read 2026-11-23 returns 422 for it here and in controlplane) — re-verifying the #1717 baseline's refutation.
- GitHub code search for four strings that exist only in this project's code — `APPROVED_SUZI_PROJECT_REF`, `external-suzi-supabase`, `pinq_contributions`, `SUZI_EXTERNAL_WRITES_ENABLED` — returns **0 results anywhere on GitHub**. The code exists in no GitHub repo, public or org.
- The Lovable connector exposes no GitHub/sync field or tool for the project (full tool list reviewed 2026-11-23); its commit history is Lovable-internal.
- This repo (read live 2026-11-23) remains the 11-path docs/governance shell on `main`; its open work is SUZI#1 (brand foundation) and SUZI#3 (`resource.extract.v1`).

**Finding:** the project has no GitHub sync target. It does not sync "somewhere outside the org" — it syncs nowhere; the code lives only inside Lovable. (Residual limit of the reads: a private repo under a personal account would be invisible to the org App token and to public code search; nothing on any record points to one, and the Lovable account/workspace evidence points the other way.)

## 3. Resolution (2) — deliberate separate home, not a mis-pointing

The project was built deliberately as SUZI's public website (suzilabs.com): created 2026-11-06, and its first edit the same day is titled "Switched to external SUZI Supabase" — the owned-database architecture (§4) was designed in from day one. This repo was separately and deliberately developed as the governance/scaffolding home for SUZI Connect and Pinq. No repository was ever connected to the Lovable project, so nothing was mis-pointed; the gap is an **absence of connection**, not a wrong connection.

## 4. Database state — the ruled direction is already the code's design

B.'s correction of 2026-11-18: the Suzi Labs project connects **directly to the owned SUZI Supabase (`suumaiswxijllkkuybnz`)**, not a Lovable-managed database. Verified in the project's code 2026-11-23:

- `supabase/config.toml` binds the project's Lovable Cloud database: **`acjsdlmklfypjgsizdqo`** (`get_database_status`: enabled, stack supabase). That database holds the **prototype** schema only (`pinq_contributions`, `submission_rate_limits`, `user_roles`, `has_role` per the generated types); the project's own proposed-migration header records it as "legacy/prototype-only" with its one test row deleted and no data to migrate.
- The production contribution path (`src/lib/contributions.functions.ts` → `src/lib/contributions.server.ts`) writes **only** through `src/lib/external-suzi-supabase.server.ts`, a server-only adapter pinned to `suumaiswxijllkkuybnz` (`APPROVED_SUZI_PROJECT_REF`), with **no Lovable Cloud fallback**, fail-closed. It activates only when the owner sets `SUZI_EXTERNAL_WRITES_ENABLED=true` with `SUZI_SUPABASE_URL` + `SUZI_SUPABASE_SERVICE_ROLE_KEY` in the server environment.
- The migration that would create the contribution tables in the owned project exists in the project as `supabase-external/proposed/0001_suzi_contributions.PROPOSED.sql` — **UNAPPLIED / PROPOSED** by its own header. Per TD-5 as ruled, the hold on the actual SUZI database stands until per-migration preflight and approval; **nothing was applied to `suumaiswxijllkkuybnz` in this resolution, and enabling the writes flag is part of that held step, not of this one.**
- Whether the writes flag is currently set in the deployed environment is not readable through the Lovable connector (server secrets are not exposed); either way the path fails closed and no SUZI application data lands in the Lovable-managed database.

So: SUZI's data home is the owned project by design and by ruling; the Lovable Cloud database is prototype/platform residue, holding no SUZI application data.

## 5. Resolution (3) — canonical surface, and the one remaining act

**Ruling (on record):** TD-5 (B., 2026-11-18, controlplane#1744 comment 7000132547) as supplemented by B.'s 2026-11-18 database correction and B.'s direction of 2026-11-23 ("Resolve sync gap"): **the canonical code surface for SUZI is this repository, The-Wealth-Salons/SUZI; the canonical data home is the owned Supabase `suumaiswxijllkkuybnz`; Lovable remains the build/host tool, connected to this repo.**

The connection itself is a Lovable-website act that only the project owner can perform — Lovable's GitHub sync is an OAuth connection made in the editor; the connector exposes no tool for it (verified §2). **B.'s act, exact steps:**

1. Open the project: https://lovable.dev/projects/08e2b810-4497-454c-a746-cd5d92c78ca4
2. In the editor, open the GitHub connection (the GitHub button in the editor header, or Project settings → GitHub) and choose **Connect to GitHub**.
3. Authorize the Lovable GitHub App for the **The-Wealth-Salons** org if prompted.
4. Select repository **The-Wealth-Salons/SUZI**. (The repo is not empty — it carries the governance shell. If Lovable refuses a non-empty repo or offers a branch choice, note exactly what it says and stop; Ymir will reconcile from there.)
5. Let the first sync complete, then tell Ymir — do not edit the site in Lovable until the read-back below is done.

**Post-connection verification (Ymir, on B.'s word):** the project's head commit appears in this repo; the governance files (`.github/CODEOWNERS`, `.github/workflows/ci.yml`, `.mergify.yml`, `LICENSE`, `docs/`) are intact or any displacement is reconciled by PR before further Lovable edits; `supabase/config.toml` and the external adapter arrive unchanged. Note: the project currently shows `needs_attention / out_of_credits` in Lovable — the connection is a settings act, but if Lovable blocks it on credits, that message is the blocker to report.

**Unblocked follow-on (not done here):** once the code is in this repo, SUZI's analytics instrumentation becomes a normal repo task. Note the Lovable app already carries `@amplitude/analytics-browser` and `src/lib/analytics/` (consent/sanitize) — the follow-on is verification and activation against the SUZI Amplitude project (915716, created 2026-11-22, 0 events), not a greenfield install.

## 6. What this resolution did not do

No migration applied to `suumaiswxijllkkuybnz`; no domain touched; nothing deployed or published; project visibility unchanged; the research hold in resources#350 is untouched and still stands on its own terms.

Publish: not required — this PR is a record in the SUZI repo; no site, package, or runtime publish follows from it.
