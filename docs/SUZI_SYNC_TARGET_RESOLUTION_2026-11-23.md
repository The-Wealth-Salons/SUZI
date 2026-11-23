# GAP-SYNC-TARGET — resolution record (2026-11-23)

**Status:** Resolved on evidence, with one owner UI act remaining (the Lovable→GitHub connection itself, §5). Until that act lands, the Lovable project is still not this repo's synced surface — but the gap is now fully characterised, and the canonical surface is ruled. **§5's owner steps were corrected later on 2026-11-23 after a verified defect** — Lovable's connect cannot attach to an existing repository, so the remaining step is now a connect act plus a reconciliation (see the correction note opening §5).

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

## 5. Resolution (3) — canonical surface, the remaining act, and the reconciliation it requires

**Correction (2026-11-23, later the same day):** the first version of this §5 told B. to "select repository The-Wealth-Salons/SUZI" in Lovable's connect flow. **That step does not exist.** A mail-side check flagged it, and verification against Lovable's own documentation (read 2026-11-23) confirms the flag: Lovable Git sync **cannot attach to an existing repository** — connecting a project **creates a new repository and starts two-way sync immediately**. Sources: Lovable docs, "Sync your Lovable project with GitHub" (page updated 2026-11-17), Limitations — "Connecting a project to a repository that already exists. Git sync always creates a new repository."; same page, "Link a project to a GitHub repository" — "When you connect a project, Lovable creates a new GitHub repository. The repository is private by default"; "Sync your Lovable project code with GitHub, GitLab, or Bitbucket" (Git sync overview) — "When you first link a project, Lovable creates a new repository and starts two-way sync automatically."; Lovable FAQ — "When you connect a project to GitHub, GitLab, or Bitbucket, Lovable creates a new repository from the project, and you cannot connect an existing one." The Lovable connector's tool surface corroborates the boundary: of its 38 tools, none performs or inspects a GitHub connection — the act is UI-only, and there is no connector route around it. **Nothing has been connected yet and B. has not clicked — no harm done; do not follow the earlier version of these steps.**

**Ruling (on record, unchanged):** TD-5 (B., 2026-11-18, controlplane#1744 comment 7000132547) as supplemented by B.'s 2026-11-18 database correction and B.'s direction of 2026-11-23 ("Resolve sync gap"): **the canonical code surface for SUZI is this repository, The-Wealth-Salons/SUZI; the canonical data home is the owned Supabase `suumaiswxijllkkuybnz`; Lovable remains the build/host tool.** What the correction changes is the path: the connect act alone cannot land the site's code in this repo, so reaching the ruled end-state takes the connect act **plus** a reconciliation (proposed below for B.'s approval — not executed).

The connection itself is a Lovable-website act that only the project owner can perform — Lovable's GitHub sync is an OAuth/App connection made in the editor; the connector exposes no tool for it (verified §2). **B.'s act, corrected — what you will actually see:**

1. Open the project: https://lovable.dev/projects/08e2b810-4497-454c-a746-cd5d92c78ca4
2. Open **Project settings → Git → GitHub** (or the GitHub button in the editor header) and start the connection.
3. **Workspace connection first — this picks the account, not a repository.** If Lovable lists GitHub accounts/organizations with an existing Lovable GitHub App installation, click **Connect** next to **The-Wealth-Salons**. If the org is not listed, choose **Add connection** and install/authorize the Lovable GitHub App on the **The-Wealth-Salons** org. This choice decides where the new repository gets created — it must be the org, not a personal account.
4. **Connect the project.** There is **no repository picker, and no way to choose the existing SUZI repo**. On connect, Lovable immediately **creates a brand-new private repository in the The-Wealth-Salons org** (its name is assigned by Lovable at creation) and **starts two-way sync at once** — the project's current code (Lovable head `419cd9c0…`) lands in the new repo. The existing The-Wealth-Salons/SUZI is not offered, not touched, and not merged into.
5. Note the **new repository's name and URL** and tell Ymir — then pause: do not edit the site in Lovable until the read-back below is done and the reconciliation is decided. (Note: the project currently shows `needs_attention / out_of_credits` in Lovable — the connection is a settings act, but if Lovable blocks it on credits, that message is the blocker to report.)

**Post-connection verification (Ymir, on B.'s word):** the new repository exists in the org and carries the project's code (the Lovable `419cd9c0…` lineage) with sync status in-sync; `supabase/config.toml` and the external owned-Supabase adapter arrived unchanged; the existing The-Wealth-Salons/SUZI governance repo is untouched.

**Reconciliation plan (PROPOSAL for B.'s approval — not executed):** after the connect, two repos exist: this governance repo (The-Wealth-Salons/SUZI — docs, `.github/CODEOWNERS`, `.github/workflows/ci.yml`, `.mergify.yml`, `LICENSE`, and the SUZI#1/#3 work) and the new Lovable-synced code repo. Recommended end-state, matching the ruling that The-Wealth-Salons/SUZI is the canonical code surface:

- **R1 — port the governance shell into the synced code repo by PR** (`.github/CODEOWNERS`, `.github/workflows/ci.yml`, `.mergify.yml`, `LICENSE`, `docs/` including this record), so the code home carries the same gates as every other fleet repo.
- **R2 — rename into place:** rename the current governance repo to `SUZI-governance` (kept, then archived read-only once the port lands — its history and PRs stay reachable), then rename the synced code repo to `SUZI`. This is sync-safe on GitHub: Lovable's Git sync overview lists repository renames on GitHub as "followed automatically." Records that name the repo (controlplane#1756 canonical-URL registration, controlplane#1744, resources#350) get pointer updates in the same pass.
- **Alternative (not recommended):** keep both repos as-is — this repo keeps the name `SUZI` as a governance-only home and the code repo keeps its Lovable-assigned name — and amend the canonical-surface ruling to a two-repo split. Recorded for completeness; it leaves the ruled end-state unmet and splits every future reference across two homes.
- Until B. approves a reconciliation, neither repo is renamed, nothing is ported, and the analytics follow-on below waits.

**Unblocked follow-on (not done here):** once the code sits in its canonical repo (post-reconciliation), SUZI's analytics instrumentation becomes a normal repo task. Note the Lovable app already carries `@amplitude/analytics-browser` and `src/lib/analytics/` (consent/sanitize) — the follow-on is verification and activation against the SUZI Amplitude project (915716, created 2026-11-22, 0 events), not a greenfield install.

## 6. What this resolution did not do

No migration applied to `suumaiswxijllkkuybnz`; no domain touched; nothing deployed or published; project visibility unchanged; the research hold in resources#350 is untouched and still stands on its own terms.

Publish: not required — this PR is a record in the SUZI repo; no site, package, or runtime publish follows from it.
