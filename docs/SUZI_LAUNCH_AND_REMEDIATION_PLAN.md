# SUZI launch and remediation plan

Status: DRAFT FOR REVIEW. Documentation is not implementation or approval.
Recorded: 2026-10-30. Source: founder-led design discussion, 2026-10-29/30.

## 1. Purpose and evidence boundary

SUZI is intended as human-centered open-source AI infrastructure supporting free-forever public-benefit tools serving historically underinvested communities. The Wealth Salons is the public-benefit project steward and Lumenfolk is the build partner; detailed IP, runtime operations, and maintenance responsibilities require confirmation.

At this review, the default branch was inspected through GitHub and contained README.md and LICENSE. The repository was previously confirmed public with Apache-2.0. No runnable SUZI implementation, deployed inference service, passing test suite, or production integration was verified. Existing Resources code and documentation have been inspected selectively, not audited end to end. Proposed API endpoints, quotas, credentials, moderation processes, schemas, and tests are not operational guarantees.

This public-safe synthesis preserves the findings and design decisions discussed; it does not reproduce the full conversation or unexecuted code verbatim. Private grant evidence, beneficiary information, credentials, and internal operating details are excluded. Related internal coordination: controlplane issues #1184 and #1186; this document does not change those issues or grant claims.

## 2. Status discipline

Track decision status separately from delivery status. Decision: proposed, accepted, rejected, superseded. Delivery: not_started, in_progress, implemented, verified, retired. Every verified claim needs a source, scope, method, environment, date, and evidence reference. A document, merged PR, or model confidence score is not runtime verification. Founder-originated direction and assistant-proposed implementation details must remain distinguishable.

## 3. Proposed ADR-0001: ownership boundaries

Decision status: PROPOSED. Implementation: NOT_STARTED. Approval owner: project steward; specific technical and operational reviewers TBD.

SUZI owns reusable inference adapters, versioned tasks, prompts, evaluations, and deployment recipes. Resources/ResourceGraph owns canonical resource facts, evidence, source intake, verification, revisions, and publication. Products own user experience, local context, and workflow state. Existing controlplane authorities govern shared contracts and permissions. Runtime hosting does not transfer domain authority.

Non-goals: a second resource database, unrestricted public inference, automatic resource publication, global personal profiles, frontier-model fallback, or a new portfolio-wide governance system.

Alternatives considered: (A) SUZI owns data and inference together: simpler branding but duplicates Resources authority; not recommended. (B) SUZI is a reusable inference component with Resources integration: recommended. (C) defer reusable infrastructure and keep product-specific calls: lowest initial work but continued duplication.

Costs: maintainers, model/runtime operations, evaluations, security response, documentation, and support. Amounts are unknown until scoped. Acceptance requires one reproducible task, evidence-linked output, safe failure, and an independent setup test. Revisit when multiple production consumers or external service requirements materially change ownership.

Use one ADR per consequential decision. Record context, evidence/unknowns, decision drivers, real alternatives, ownership, interfaces, privacy/rights, non-goals, consequences, implementation authorization, acceptance evidence, rollback, open questions, and superseding decisions. Do not mark this ADR accepted without explicit review.

## 4. Gap register and release gates

P0 G01 Scope drift: separate repository, hosted service, and data offering; accept ADR before implementation expansion.
P0 G02 Persistence/status: this record closes the conversation-only discovery gap only after committed; it does not implement controls.
P0 G03 Ownership and maintenance: name paid primary/backup maintainers, operator, review cadence, escalation contacts, and TWS/Lumenfolk IP responsibilities. OPEN.
P0 G04 Rights: inventory code, dependencies, weights, quantizations, prompts, fixtures, datasets, and contributions separately. Apache-2.0 is not a blanket data/model license. OPEN.
P0 G05 Repository security: verify actual MFA, permissions, branch rules, review gates, scanning, private reporting, Actions and release configuration. Not inspected or fixed by this record. OPEN.
P1 G06 Runnable release: one task/adapter, pinned model, synthetic fixtures, setup instructions, evaluations. OPEN.
P1 G07 Privacy/deletion: classify records, define retention and authorized deletion across evidence, logs, caches, backups, jobs, exports, and downstream notifications. OPEN.
P1 G08 Quality: evaluate factual support, free/conditional cost, false eligibility, language/accessibility, community usefulness, latency, and total cost. OPEN.
P1 G09 Operations: establish capacity, durable intake, restoration tests, incident response, budget alerts, hard workload caps, supported versions, rollback and retirement. OPEN.
P1 G10 API compatibility: version contracts, stable public IDs, pagination, errors, rights, withdrawals, cache semantics, and external reuse test. OPEN.
P2 G11 Deferred expansion: webhooks, exports, batch writes, billing, broad inference, multi-channel community management, and DPG registration. No commitment to ship.

## 5. Model adapter and first vertical slice

First proposed task: resource.extract.v1. Later tasks: need.interpret.v1 and match.explain.v1. Extraction returns candidate claims, not verification or eligibility decisions. Interpretation uses stated needs without sensitive identity inference. Explanation uses supplied matches and does not silently change ranking.

Separate task service from provider-neutral transport adapter. Task service owns authorization, minimization, approved prompts, schema and evidence validation. Adapter owns formatting, inference, capabilities, normalized errors, and receipts. Neither performs arbitrary tool actions or resource publication.

Deployment inventory must pin model revision, quantization, runtime/adapter versions, context limits, chat formatting, structured-output behavior, cancellation, licensing, region, price, and handling terms. OpenAI-compatible transport does not prove behavioral compatibility. Initial Phi-4-mini-instruct choice is a benchmark hypothesis, not verified suitability or guaranteed credit coverage. Preserve upstream model notices; do not claim the base model was trained by SUZI.

No mandatory or silent frontier fallback on the independent small-model core path. Use bounded transport retries, explicit challenger runs, deterministic/manual fallback, or honest failure. Receipt records actual attempts and identity assurance, unknown costs/tokens as unknown, finish reason, task/prompt/schema versions, and validation outcomes.

## 6. Prompt packages

Organize prompts by task and immutable package version, not product copies. Each package contains manifest, reviewed system instructions, synthetic/licensed examples, and changelog. Schemas remain canonical under contracts; evaluations use held-out cases.

Trusted instructions/examples remain separate from untrusted source content. Deterministic rendering serializes validated inputs; the adapter applies model chat tokens exactly once. Delimiters and JSON serialization are not security controls by themselves. No arbitrary caller system prompts, tools, endpoint URLs, or schema overrides.

Pin the full approved recipe: prompt digest, renderer, schemas, model revision, runtime and evaluation result. Prompt changes require regression testing. Temperature zero is not a reproducibility guarantee. Reject or explicitly split over-budget inputs; never silently truncate evidence.

## 7. Extraction contracts and provenance

Input: request identity, one target resource, requested fields, and bounded evidence sources with stable evidence/block IDs, exact text, retrieval/observation dates where known, source reference and content digest. A name hint is not evidence.

Output: extracted or abstained; supported claims with field, value, assertion kind and exact evidence quotations; unknown fields; conflicts; review flags. Runtime errors are not model abstentions. Use textual qualified claims initially; a separate tested normalization contract determines machine-readable cost, geography, or dates.

Trusted provenance: immutable/versioned upstream references for origin, contribution, collector, verification scope/event, rights, handling policy, and transformation chain. Anonymous contributors are permitted. Public responses exclude private contributor details and restricted references.

SUZI adds the result envelope and execution receipt; the model must not invent provenance or verification status. Resolve quotations to UTF-16 exclusive-end spans against exact model-visible block text. Reject unresolved/ambiguous quotes rather than guessing. A valid quotation is not proof of semantic support.

Cross-record validation: unique IDs; request correlation; complete snapshots; correct digests and provenance records; complete nonduplicate claim lineage; valid evidence/block references; quote/span equality; requested-field coverage; conflict integrity; resolvable rights/policy authorization and transformation continuity. No extraction-driven trust promotion.

Correct earlier draft inconsistencies before implementation: consolidate source_kind/origin_kind definitions; canonicalize field enums; define digest serialization once; separate model output from trusted envelope; compile AJV Draft 2020-12 strictly; derive types rather than suppressing fixture errors with casts. Earlier test samples were unexecuted and used placeholder hashes; there is no passing-test claim.

Test valid extraction, abstention, unknown/conditional cost, contradictory hours, firsthand reports, invented references, duplicated IDs, altered hashes, orphan lineage, invalid/repeated quotations, emoji offsets, invalid dates, injected instructions, multiple resources, malformed/truncated output, missing rights and unauthorized references. Recompute actual fixture hashes. Test production validators, not only test-local helpers.

## 8. Public data exchange and proposed API

Three front doors: use data; request coverage/suggest a source; contribute/correct/report. No GitHub account is required for resource contributions. API and embed work without model inference. Resources remains the data authority even if the public experience uses SUZI branding.

Proposed /api/v1 endpoints: discovery root, openapi.json, datasets and dataset detail, taxonomies, resource search/detail, contribution create/protected status, data-request create/protected status. Later approved features: change feed, scoped exports, partner batches, assisted-search and extraction jobs. These paths are proposals, not verified deployed endpoints. Existing Resources routes must be inventoried and mapped, not replaced blindly.

Reads return stable IDs/revisions, source/rights/freshness, uncertainty, coverage warnings, and pagination. Default 25/max 100 are provisional. Unknown availability is not closure; failed retrieval is not an empty result. Define safe withdrawal/replacement tombstones. Do not claim HSDS compliance without an explicit mapping and conformance review.

Writes durably stage before 202 acknowledgment, use principal-scoped idempotency, never directly publish, and return protected status access. Secret status tokens are not URL parameters. Submission acceptance is not publication. Restricted safety reports have a separate handling path. Use RFC 9457 errors and distinguish caller throttling 429 from service failure 503.

Exports need rights, snapshot consistency, expiration, refresh/withdrawal responsibilities, and byte/work limits. Public data licensing, model-training rights, software licensing and API service terms are separate decisions. No paid ranking or purchased verification.

## 9. Access, quotas, registration and keys

Proposed tiers: Community anonymous access; free Registered modest integrations; approved Partner free/sponsored/cost-recovery arrangements; optional separately quoted managed services. These are draft policies, not published pricing promises. No key or paid service is necessary for ordinary free end-user tools.

Pilot read proposals: anonymous search 30/minute and 1,000/rolling day; detail 60/minute and 3,000/day. Registered search 120/minute and 10,000/day; detail 300/minute and 30,000/day. These require load/cost testing; they are not guarantees. Token buckets, rolling quotas, concurrency and workload caps must be explicit.

Pilot submissions: anonymous contributions 3/minute, 10/hour, 25/day; data requests 2/minute, 5/hour, 10/day. Authenticated increases require abuse review. Shared-network fairness, accessible verification, and organizational credentials are required; IP is not person identity. Limit payloads and forbid initial public file attachments. Public reads do not trigger paid discovery or inference.

Registration: inspect data first, verify mailbox, register application, accept versioned terms, receive sandbox access, activate permitted production scopes. Email verification does not establish organizational authority. Public read approval may be automatic; inference/personal context, exports, automated contributions and batch writes need distinct approval.

Keys: random secret shown once; store one-way verifier and public lookup ID; headers not query strings; no browser secret keys. Scope equals intersection of key scopes, current application approval, environment and policy. Aggregate quota across keys. Proposed validity: production <=90 days, sandbox <=30 days; confirm usability before adoption.

Lifecycle: active -> retiring -> revoked/expired. Rotation creates immutable replacement, same-or-narrower scope, atomic links and deadline, bounded overlap <=24 hours or original expiry, deployment verification, then revocation. Never reset the old deadline through recovery. Lost displays require replacement, not secret revelation. Emergency compromise permits no overlap. Define concurrency, cache invalidation, account recovery and achievable revocation propagation before service promises.

## 10. Webhooks: deferred, separately authorized

Current ResourceGraph live-pull authority must be amended before resource event-push is implemented. Begin, if necessary, with application-owned job/status notifications. Metadata itself can be private. Recheck ownership and disclosure before every delivery and replay.

Use minimal reference events, stable event IDs and new per-attempt IDs/timestamps, at-least-once delivery, no ordering guarantee, durable deduplication and API reconciliation. No beneficiary data, source documents, API/status tokens or export credentials in events.

HTTPS destination verification; no redirects; block private/reserved destinations, validate DNS on every connection and enforce egress isolation. Evaluate maintained signing standards/libraries before implementing the earlier custom HMAC proposal. If HMAC is used, signing secrets require encrypted recoverable storage, unlike incoming API-key verifiers. Sign exact bytes, verify freshness and constant-time MACs, and test dual-key rotation/emergency revocation.

Use durable outbox, bounded retries/jitter/horizon, per-app concurrency and quotas, protected replay, receiver durable acknowledgment, and explicit subscription pause/disable states. Destination changes require reverification and authorized treatment of queued private events. All numerical timeout/replay defaults remain provisional.

## 11. Contribution, moderation and verification

New resource form: name, plain-language service, geography, evidence path, cost including unknown, relationship, optional date/contact. Correction form: resource ID/revision, affected field, proposed change or recheck request, evidence/date, optional private contact. Do not require polished websites, institutional credentials or beneficiary records.

One queue across products: received -> screening -> moderation -> field verification -> accept/partial/clarify/decline/duplicate -> authorized publication -> notification/recheck. Separate review status from publication status.

Moderation handles spam, privacy, scope, urgency and safe routing. Verification determines field-level support: supported, qualified, unresolved, contradicted, not reviewed. Publication permission is separate: publishable, restricted, not permitted. A true confidential location may still be unsafe to publish.

Human/community observations remain evidence, not automatic canonical writes. SUZI proposes structure only. Routine reviewers can combine roles with separate audit events; consequential disputes/overrides need independent authorized review where feasible. No qualified reviewer means unresolved/restricted, not AI approval.

Check current revision before publishing; merge only approved fields; retain history and provenance subject to retention/deletion policy. Anonymous tips may initiate checks. Provider affiliation does not authorize suppression of contrary evidence. Safety responders can take recorded temporary protective action, not declare allegations proven. No unstaffed emergency-response promises.

Notifications give safe reasons and distinguish received, accepted and published. Appeals add evidence without rewriting history. Rechecks trigger on reports, expiry, provider changes, broken links and risk-based staleness. A successful fetch does not reset verification.

## 12. Public repository baseline

Before broad contribution invitations, add substantive README, CONTRIBUTING, GOVERNANCE, SECURITY, SUPPORT, CODE_OF_CONDUCT, maintainer responsibilities, issue/PR templates and CODEOWNERS with real reviewers. Do not invent monitored contacts or support SLAs. Confirm whether organization-wide community files already apply before duplicating them.

README must state early-stage status, actual implementation, first task, setup/tests, hardware and model downloads, limitations, ownership, licenses and support. Treat current mission language as aspiration. Apache appendix placeholders are instructional boilerplate; do not replace the license text merely to remove them. Add actual project notices in appropriate places after rights confirmation.

Async support only is acceptable: scoped issues/PRs, security privately, resource data through intake, published triage cadence, maintainer backup, clear right to decline requests. No founder office hours or chat community required. Define code-of-conduct enforcement contact, confidentiality and conflict-of-interest handling before claiming coverage.

Repository settings audit: privileged MFA, least privilege, branch/ruleset protection, required tests/review, sensitive CODEOWNERS enforcement, bypass policy, private advisories, secret scanning/push protection, dependency/security scanning and release permissions. A CODEOWNERS file does not enforce reviews alone. Settings remain UNVERIFIED.

Actions: minimum token permissions; no secrets/production data for untrusted fork code; avoid privileged pull_request_target checkout; reviewed pinned dependencies/actions; protect workflow edits; separate release jobs; no public PRs on privileged persistent self-hosted runners; short-lived restricted deployment credentials. Never let arbitrary PRs trigger unbounded GPU costs, model remote code, downloads, or deployment.

Releases need pinned source/dependencies/model artifacts, license notices, reproducible run/evals, limitations, changelog, compatibility/security support, rollback. Do not place large weights or real user fixtures into Git by default. Consider SBOMs/attestations as distribution matures.

## 13. Additional remediations and unresolved operating decisions

Design clarifications in this record: keep data authority separate; separate approval/implementation/verification; keep source trust separate from claim support; reconcile duplicate fields/states; distinguish private/raw lineage from public provenance; keep rates and service targets provisional; distinguish API-key hashing from webhook-secret encryption; add deletion/withdrawal and downstream propagation; require backend conformance; reject speculative compatibility, test and funding claims. These are documentation corrections, not deployed fixes.

Still required: named operator and contacts; paid capacity; rights/legal review; retention matrix including backups and user access/deletion; threat model; credential/account recovery; incident notification policy; dependency/model supply-chain review; restore and rollback test; accessibility of forms/docs/embeds; participant compensation/consent; budgets beyond credits; cost alerts and hard caps; supported versions; project transfer/archive plan if maintenance ends.

Measure successful next steps, misunderstanding of eligibility/cost, mobile/language/access barriers and harmful exclusions, not just JSON validity. Do not infer identity from ZIP/name/style. Missing eligibility information is not ineligibility. Optional durable cross-product context requires explicit applicable consent and identity policy; shared inference is not consent.

## 14. Staged launch and evidence gates

A. Foundation: public-safe documentation, rights inventory, maintainer/operator assignments, reviewed boundaries and verified settings.
B. Prototype: one extraction task/adapter, deterministic local tests, held-out evals, pinned recipe, no production beneficiary dependency.
C. External reuse: one independent person clones/runs/tests and submits feedback; record maintenance effort.
D. Hosted pilot: only demanded endpoints, durable intake, authorization, privacy/deletion, quotas, costs and recovery verified.
E. Expansion: approve exports/webhooks/batches/registration scaling only on real demand and funded ownership.

For every gate record criterion, accountable owner, evidence reference, environment, date, outcome and remaining risk. Owner names and dates must be assigned, not invented. DPG recognition can follow a mature reusable artifact and demonstrated partner value; it is not a funding guarantee or certification of every deployment.

## 15. Sources and discovery

Project context: this founder-led discussion; The-Wealth-Salons/SUZI README and LICENSE; Resources docs/RESOURCES_RESOURCEGRAPH_AUTHORITY.md and docs/resources-portfolio-reuse-toolkit-v0.1.md; existing controlplane intelligence documents, whose candidate/active status must be independently checked before implementation. Internal links are references, not copied private evidence.

Public guidance consulted:
- GitHub repository practices: https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories
- GitHub community profile: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories
- GitHub Actions security: https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- OpenSSF concise guide: https://best.openssf.org/Concise-Guide-for-Developing-More-Secure-Software
- Maintainer boundaries: https://opensource.guide/maintaining-balance-for-open-source-maintainers/
- W3C provenance: https://www.w3.org/TR/prov-primer/
- OWASP security guidance: https://cheatsheetseries.owasp.org/
- Open Referral API: https://docs.openreferral.org/en/latest/hsds/api_reference.html
- HTTP semantics: https://www.rfc-editor.org/rfc/rfc9110.html
- API errors: https://www.rfc-editor.org/rfc/rfc9457.html

Next action: review this record; accept or revise ADR-0001; assign P0 owners; split approved implementation into small reviewed PRs. Nothing here grants deployment or publication authority.
