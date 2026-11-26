# GAP-SYNC-TARGET — resolution record (2026-11-23)

**Status:** Resolved on evidence as narrowed in §2, with the canonical surface ruled (§5). The Lovable→GitHub connection path that an earlier version of this record prescribed is **superseded and must not be executed**: B. ruled on 2026-11-23 (~13:40 PT; PR comment 7115649971) to **download the code instead**, and the import is filed as SUZI#10 — The-Wealth-Salons/SUZI is SUZI's code home. No owner connect act remains outstanding under this record.

**Custody:** the Suzi Space work item "repoint and prove the connection" was Charon-owned. Charon is out; Kali Ma covers the desk; Ymir takes custody of the item for this resolution (2026-11-23).

## 1. The gap as filed (controlplane#1744, §7.2 — verbatim)

> The RQ-0280 census records the Lovable project **"SUZI | suzilabs" (`08e2b810-4497-454c-a746-cd5d92c78ca4`) as UNMATCHED**: it syncs somewhere outside this org — not to The-Wealth-Salons/SUZI. Until that is resolved, the Lovable project must not be treated as SUZI's surface: scaffolding built in the GitHub repo and features present in the Lovable project are two different bodies of work with no verified join. What must be resolved, in order: (1) where the Lovable project actually syncs (which repo/org), established by a read of the project's sync target; (2) whether that target is a deliberate separate home or a mis-pointing; (3) B.'s ruling on which surface is canonical for SUZI going forward.

A later review correction stands and is preserved here: the #1717 baseline refuted the org match but did **not** establish an outside-org target — the correct formulation until this record was "target unknown."

## 2. Resolution (1) — where the project actually syncs: target unknown on the accessible evidence

Checked 2026-11-23 by live reads (Lovable connector + GitHub REST, ymir-writer App). The verified findings are:

- The project lives in B.'s Lovable workspace **"BPM Brands"** (`BdaIHxv2NjOeabK9ROiy`, owner ops@bpmbrands.org), created 2026-11-06, last edited 2026-11-17, published, `latest_commit_sha` `419cd9c019cb45ebe76a8d91f9cee3256853b04d`.
- That commit is **not** in this repo's history (GitHub API read 2026-11-23 returns 422 for it here and in controlplane) — re-verifying the #1717 baseline's refutation.
- GitHub code search for four strings that exist only in this project's code — `APPROVED_SUZI_PROJECT_REF`, `external-suzi-supabase`, `pinq_contributions`, `SUZI_EXTERNAL_WRITES_ENABLED` — returns **0 results in the accessible search surface**. That search is access-limited (it cannot see private repositories outside the searching App's access), so this establishes only that the code was not found in any searched repository — not that it exists in no GitHub repository.
- The Lovable connector exposes no GitHub/sync field or tool for the project (full tool list reviewed 2026-11-23); its commit history is Lovable-internal.
- This repo (read live 2026-11-23) remains the 11-path docs/governance shell on `main`; its open work is SUZI#1 (brand foundation) and SUZI#3 (`resource.extract.v1`).

**Finding (narrowed on review 6032850916):** the project's GitHub sync target remains **unknown**. The reads above rule out the checked repositories (the 422 responses cover this repo and controlplane only), return no match on the access-limited search surface, and show the connector exposes no field or tool to inspect the actual GitHub connection — they do not establish that the project has no GitHub sync target, that its code exists in no GitHub repository, or that no repository was ever connected. A private repository under a personal account would be invisible to the org App token and to public code search; that visibility limit is unresolved in this record, and resolution (1) is **not** marked established solely on absence from accessible searches. What is established is the narrower set of verified findings above, plus the absence of any record pointing to a specific sync target.

## 3. Resolution (2) — deliberate separate home, not a mis-pointing

The project was built deliberately as SUZI's public website (suzilabs.com): created 2026-11-06, and its first edit the same day is titled "Switched to external SUZI Supabase" — the owned-database architecture (§4) was designed in from day one. This repo was separately and deliberately developed as the governance/scaffolding home for SUZI Connect and Pinq. No record available to this resolution shows a repository connection having been made or later mis-pointed, so on the accessible evidence the project reads as a deliberate separate home rather than a mis-pointing; the stronger claim that no repository was *ever* connected is not established (see the §2 visibility limit).

## 4. Database state — the ruled direction is already the code's design

B.'s correction of 2026-11-18: the Suzi Labs project connects **directly to the owned SUZI Supabase (`suumaiswxijllkkuybnz`)**, not a Lovable-managed database. Verified in the project's code 2026-11-23:

- `supabase/config.toml` binds the project's Lovable Cloud database: **`acjsdlmklfypjgsizdqo`** (`get_database_status`: enabled, stack supabase). That database holds the **prototype** schema only (`pinq_contributions`, `submission_rate_limits`, `user_roles`, `has_role` per the generated types); the project's own proposed-migration header records it as "legacy/prototype-only" with its one test row deleted and no data to migrate.
- The production contribution path (`src/lib/contributions.functions.ts` → `src/lib/contributions.server.ts`) writes **only** through `src/lib/external-suzi-supabase.server.ts`, a server-only adapter pinned to `suumaiswxijllkkuybnz` (`APPROVED_SUZI_PROJECT_REF`), with **no Lovable Cloud fallback**, fail-closed. It activates only when the owner sets `SUZI_EXTERNAL_WRITES_ENABLED=true` with `SUZI_SUPABASE_URL` + `SUZI_SUPABASE_SERVICE_ROLE_KEY` in the server environment.
- The migration that would create the contribution tables in the owned project exists in the project as `supabase-external/proposed/0001_suzi_contributions.PROPOSED.sql` — **UNAPPLIED / PROPOSED** by its own header. Per TD-5 as ruled, the hold on the actual SUZI database stands until per-migration preflight and approval; **nothing was applied to `suumaiswxijllkkuybnz` in this resolution, and enabling the writes flag is part of that held step, not of this one.**
- Whether the writes flag is currently set in the deployed environment is not readable through the Lovable connector (server secrets are not exposed); either way the path fails closed and no SUZI application data lands in the Lovable-managed database.

So: SUZI's data home is the owned project by design and by ruling; the Lovable Cloud database is prototype/platform residue, holding no SUZI application data.

## 5. Resolution (3) — canonical surface ruled; connect path superseded by the download/import path

**Ruling (on record, unchanged):** TD-5 (B., 2026-11-18, controlplane#1744 comment 7000132547) as supplemented by B.'s 2026-11-18 database correction and B.'s direction of 2026-11-23 ("Resolve sync gap"): **the canonical code surface for SUZI is this repository, The-Wealth-Salons/SUZI; the canonical data home is the owned Supabase `suumaiswxijllkkuybnz`; Lovable remains the build/host tool.**

**Superseded path — historical, do not execute.** An earlier version of this section prescribed a Lovable→GitHub connect act (creating a new synced repository in the org) followed by a rename/port reconciliation of the two repositories. That path was first corrected on 2026-11-23 (Lovable Git sync cannot attach to an existing repository — it creates a new one and starts two-way sync immediately; sources: Lovable docs, "Sync your Lovable project with GitHub," updated 2026-11-17) and then **superseded outright by B.'s ruling of 2026-11-23 (~13:40 PT) to download the code instead** (recorded on this PR, comment 7115649971). The connect steps, the new-repository creation, and the rename/archive reconciliation proposal are retained here only as history: **do not connect the project, do not create a second code home, and do not rename or archive this repository under this record.**

**Current path — download/import (executed as SUZI#10).** Under the download ruling, the website code was downloaded out of the Lovable project and imported directly into The-Wealth-Salons/SUZI as **SUZI#10** ("Import SUZI website code from Lovable (snapshot 2026-11-23)"), which independently records that the connect/reconciliation plan is superseded and that later Lovable edits will drift from the imported snapshot. GitHub (The-Wealth-Salons/SUZI) is SUZI's code home; no further owner act under this record is required to establish it.

**Unblocked follow-on (not done here):** once the SUZI#10 import lands in this repository, SUZI's analytics instrumentation becomes a normal repo task in this repo. Note the Lovable app already carries `@amplitude/analytics-browser` and `src/lib/analytics/` (consent/sanitize) — the follow-on is verification and activation against the SUZI Amplitude project (915716, created 2026-11-22, 0 events), not a greenfield install. This follow-on depends on the SUZI#10 import, not on any connect or reconciliation step.

## 6. What this resolution did not do

No migration applied to `suumaiswxijllkkuybnz`; no domain touched; nothing deployed or published; project visibility unchanged; the research hold in resources#350 is untouched and still stands on its own terms.

Publish: not required — this PR is a record in the SUZI repo; no site, package, or runtime publish follows from it.
