# Fleet verify-runner — adoption for SUZI's `ci` context

**Status:** adoption record and wiring, filed 2026-11-25 under program
CI-UNBLOCK (RQ-0466). This PR files the trusted plan and this record; the
inaugural paired run is executed by the controller against this PR's head
under the operator-held copy of the same manifest bytes (identical SHA-256,
§4), and its evidence is posted on this PR.
**Activation:** the poster result is produced per paired run under the
standing fleet verify contract (execution + independent replay must agree
before the publisher posts). No ruleset is edited by this PR.
**Authority:** B.'s direction of 2026-11-25 (CI unblocking is the fleet's top
priority) and the rule of 2026-11-20 — a removal and its successor land
together, client repo first, so no PR is left stuck — applied to the
Actions-removal wave. Pattern of record: controlplane#1801 (fleet
verify-runner pilot), our-bible#338 (first client-repo adoption),
thebrainconsole#210 (successor wiring, 2026-11-25). Contract frame:
controlplane#1851 (T-CI — one verified executing check name per repo).

## 1. What is being succeeded

The `ci` status context on pull requests to `main`. Its only producer was
GitHub Actions (the `ci` job in `.github/workflows/ci.yml`). Actions has
been disabled org-wide since 2026-11-20, so the context cannot be produced
at all: every PR to `main` sits blocked on a gate whose producer no longer
exists (impossible-gate census 2026-11-24: SUZI#10 head `3d3670d7`, committed
2026-11-25, carries no `ci` check at all).

## 2. Consumer analysis (live-verified 2026-11-25)

- **Branch ruleset "required-ci" (id 26547220)** requires the status context
  `ci` — a plain context name with **no integration binding**. A check run
  named `ci` posted by the fleet publisher (bpm-verify-poster, App 5860705,
  `checks: write` only) satisfies it. **No ruleset edit is needed** for the
  fleet successor to carry this gate.
- **Ruleset 26574161** (one non-author approval, last-push approval,
  dismiss-stale) and the baseline rulesets 18414150 / 18416179 are untouched
  by this adoption.
- **Mergify** (`.mergify.yml`) holds a protection "CI executed and green on
  this head" requiring `check-success = @github-actions/ci`; a fleet-posted
  check does not satisfy that app-qualified condition. A companion PR
  re-points that one condition to `@bpm-verify-poster/ci`, preserving every
  other protection verbatim.

## 3. The pattern (from controlplane#1801, unchanged)

Three separated roles; no role holds another's credential:

| Role | What it does | Credential |
| --- | --- | --- |
| Controller (VM control point) | Pins the trusted runner revision and the manifest digest from a reviewed source; launches the worker; authenticates the paired evidence | Owns the poster credential; never enters the worker |
| Execution worker (`run_verify.mjs`, pinned runner `61f6cea11bdef7af3118aba3e86df7bfed57fc95`) | Fresh clone → verifies the merge result's parents are the exact base + head → authorizes the pinned manifest → executes each step with Actions shell semantics → emits a diagnostic `run-manifest.json` | A scoped repo token only. It **never** calls the Checks/Statuses write APIs and refuses to start if a poster/publisher token is present in its environment |
| Publisher (separate trusted process) | Authenticates the execution evidence plus an independent replay, re-mints its token immediately before posting, and posts exactly one terminal check run named `ci` | bpm-verify-poster (App 5860705, installation 184303155, `checks: write` only) |

`success` is posted only when both paired runs agree that every in-scope
step actually executed and exited 0; an executed failure posts `failure`
naming the step; a verify that did not run to completion is NO_RESULT —
visible, blocking, never dressed as a pass.

## 4. The wiring filed by this PR

- **Trusted plan:** `scripts/fleet-verify/SUZI-ci.manifest.json` — a
  **command manifest** (manifest_version 2, `source_mode:
  command-manifest`, `workflow_retired: true`), SHA-256
  `b4dda69ecd1f722884008227febf68b7bb8ba090e020d9bd3c85ebe223a77d62`.
- **Why a command manifest, not a workflow extraction:** the workflow sets
  no `timeout-minutes:`, so the pinned extractor emits
  `job_timeout_minutes: null`, which the runner refuses outright
  ("invalid trusted job timeout", attempt `ci-unblock-2026-11-25-suzi11-exec`,
  NO_RESULT, 0 steps); and pinning a timeout into the extraction breaks the
  runner's extraction-equality check instead ("candidate workflow/plan
  differs from the controller-pinned manifest", attempt
  `ci-unblock-2026-11-25-suzi11b-exec`, NO_RESULT, 0 steps). The command
  manifest therefore pins, as reviewed commands, the job's deterministic
  gate — the smoke check, verbatim — with `job_timeout_minutes: 45` (the
  fleet pattern value, thebrainconsole#210). The checkout step is
  provisioning, not enrolled: the worker materializes the exact merge tree
  itself. `workflow_retired` records that the workflow no longer produces
  this context (Actions disabled org-wide); the file itself is not edited,
  and the manifest pins its blob so any future drift requires
  reconciliation.
- **Reviewed source:** `.github/workflows/ci.yml` on main @
  `600c5f3a6d1e815a1c963fc7633ff4a0e6b87aed`, workflow blob
  `024c1da278c04d3d2a91fe404bc8e5ae7a6b4786` (pinned in the manifest; the
  runner refuses to run if the workflow in the tree being verified has
  drifted from it).
- **Toolchain pins:** `.nvmrc` (`22.23.2`) and `.bun-version` (`1.4.0`),
  filed by this PR. The runner measures the sandbox runtime against the
  repo's exact pins and fails closed on any difference ("runtime differs
  from exact repository pins", attempt `ci-unblock-2026-11-25-suzi11c-exec`
  before these files were added); this repo carried neither pin. The pins
  name the fleet toolchain of record — the same values every enrolled repo
  carries (controlplane, our-bible, thebrainconsole) — and change no
  application behavior: this tree has no package manager, lockfile, or
  build for them to act on today.
- The job itself is simple: no workflow/job `defaults` or `env`, no
  unsupported job semantics, `runs-on: ubuntu-latest`, two steps
  (checkout provisioning + the smoke check).

## 5. Divergences from the Actions job

- **Producer only.** The enrolled steps are the job's own steps, executed
  verbatim with Actions shell semantics in the fleet sandbox; the checkout
  step is provisioning (the worker clones the exact merge tree itself).
  No command, file list, or flag changed.
- The job uses no secrets and no services; nothing is excluded from the
  enrolled set.
- The Actions workflow file itself is **not** edited: if Actions is ever
  re-enabled org-wide, the workflow would resume producing the same context
  and this adoption should be revisited.
