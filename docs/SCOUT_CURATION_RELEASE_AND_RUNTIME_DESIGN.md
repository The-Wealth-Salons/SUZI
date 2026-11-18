# Scout, curation, release, and runtime identity design

Status: proposed design and implementation notes. The scripts and tests drafted in the design discussion have not been executed or integrated into this repository. This document does not claim production readiness or release authorization.

The discussion used Pinq as a working component name. Its relationship to SUZI and final package, task, and module names requires confirmation before implementation.

## 1. Pipeline and trust boundaries

Scout discovery -> candidate intake -> curation -> immutable example revision -> dataset release checks -> training -> model evaluation and approval -> application release -> deployment.

A dataset release does not update a model. A completed training job does not deploy it. Content approval does not grant training or distribution permission. Passing automated checks does not authorize publication.

The scout proposes useful coverage rather than maximizing collection volume. It searches only approved rules and sources within runner-enforced budgets. It treats fetched content as untrusted evidence, ignores embedded tool instructions, does not infer sensitive attributes, and does not approve contributions, modify datasets, train models, or deploy services. Public availability does not establish reuse permission. Reference-only material must not be copied into training records contrary to its policy.

## 2. Candidate interchange

Use JSONL with one candidate object per line, a separate run-summary JSON document, and a separate validation report. Proposed contract: pinq.scout.candidate.v1.

The trusted runner assigns authoritative IDs, timestamps, producer metadata, and source/execution references. The model supplies proposals rather than authoritative approvals.

Candidate sections:

- Trusted envelope: contract version, record type, candidate ID/revision, run ID, timestamp, producer references.
- Mapping: primary/secondary approved rules and exactly one existing task or new-task proposal under the current v1 design.
- Discovery: signal, failure pattern, novelty rationale, related-case group, duplicate status and references.
- Sources: authorized source-registry and evidence references, source type, claim status, collection mode.
- Handling: source policy, classification, pending/blocked reuse status, terms references, privacy flags, missing permission information.
- Proposed case: evidence basis, input, observable must/must-not criteria, clarification condition, optional illustrative answer, limitations. May be null for a reference-only lead.
- Optional actual model execution reference; null means no observed execution is established.
- Recommendation: proposed use, priority, missing context, held-out eligibility unverified.
- Initial review status: pending.

Retain sensitive source locators and evidence in authorized registries rather than broad candidate exports. Changing a name alone does not make a personal narrative synthetic.

## 3. Intake and quarantine

Intake outcomes: accepted, accepted_with_holds, quarantined, rejected. Dependency failure produces retryable_error rather than a content rejection. A prohibited payload cannot be retained merely because it is quarantined.

Validation order:

1. Transport limits and UTF-8 framing.
2. Strict JSON parsing, including rejection of duplicate keys and non-finite numbers.
3. Versioned schema, exact types, required fields, unknown-field rejection, bounded strings/arrays.
4. Trusted envelope, immutable revisions, idempotency.
5. Authorized reference resolution.
6. Source handling, privacy/security, evidence integrity.
7. Semantic consistency.
8. Duplicate and intended-use readiness checks.

Proposed initial bounds: 128 KiB per candidate; 200-character title; 12,000-character input; up to 10 must criteria, 10 must-not criteria, and 10 source references. These are configurable policy defaults, not measured requirements.

Replay rule: same runner intake key and canonical payload hash returns the original receipt; same key with changed content is quarantined. Cross-run rediscovery is separate duplicate analysis.

Quarantine examples: unresolved evidence, quote mismatch, artifact hash mismatch, conflicting trusted execution metadata, unauthorized handling where incident retention is permitted. Quarantine release requires remediation, complete revalidation, permitted destination, immutable revised content where applicable, and an audit record. It returns the candidate to review, not directly to a dataset.

Ordinary holds include permission pending, reference-only, task approval pending, target adjudication, missing context, duplicate checking, and unverified evaluation lineage. Holds specify owner, scope, reason, and resolution requirement.

## 4. Curation

Suggested records: curation_candidates, candidate_revisions, candidate_observations, review_decisions, example_revisions. These are proposed entities, not claims about an existing database.

Review categories: task fit, annotation, privacy/security, and intended-use permissions. Decisions bind exact revisions. Edits preserve prior revisions and require applicable new decisions; old approvals do not silently transfer.

Outcomes: accept content, request context, reject, or link a duplicate. Reference-only leads remain non-trainable. Promotion creates an immutable example revision with provenance and decision links, not a dataset release.

Readiness must remain multi-dimensional: content adjudication, development permission, training permission, evaluation eligibility, public distribution permission, and dataset membership. Use UUID internal keys if required by the eventual schema and separate readable labels such as CAND-0042.

## 5. Dataset release gates

Release requests pin one intended use, audience, destination, contract/policy versions, and an immutable selection manifest. Intended uses: development, training, model-development validation, held-out evaluation, public distribution.

Ten gates:

1. Manifest/artifact integrity, exact selected revisions, hashes and counts.
2. Required current adjudication decisions on the exact content; no applicable rejection, withdrawal, invalidation, or unresolved changes.
3. Permission covering exact revision, intended use, audience, destination, validity period, and conditions.
4. Authorized classification and destination, cleared holds, permitted export fields, no prohibited content.
5. Approved task-contract compatibility and reviewed export projection.
6. Exact duplicates, related-case groups, split separation, and comparison against relevant prior releases.
7. Use-specific exposure lineage; held-out eligibility scoped to a named model/experiment and blocked when required lineage is unknown.
8. Predeclared measurable coverage and quality thresholds; report distinct groups as well as raw counts.
9. Export-build provenance, exact membership/order as contracted, parsing, configuration, and artifact hashes.
10. Fresh final checks and separate authorization for the exact manifest, artifact, destination, and intended use.

Outcomes: passed, blocked, retryable_error. Proposed CLI exit codes: 0, 2, 3 respectively. Do not silently drop failing records; revise the manifest and recheck affected gates. Staging is not publication.

The publisher must coordinate a final refresh of revocations, withdrawals, holds, and lineage with authorization/publication. Snapshot freshness alone does not prevent state changes between checking and publishing. Released manifests remain historical records; subsequent withdrawal triggers incident handling and downstream tracing.

## 6. Release-check implementation and tests

Draft Python CLI inputs: release request, pinned manifest, trusted registry snapshot, staged JSONL artifact. Output: bounded machine-readable report. The checker consumes trusted attestations; it does not perform semantic review, authenticate its own registry snapshot, or publish content.

Required integration scenarios:

- Valid release and unchanged inputs.
- Pending, revoked, expired, not-yet-valid, wrong-scope, or missing permission.
- Wrong-revision, missing, and conflicting current reviews.
- Withdrawals, holds, stale/future snapshots, unavailable dependencies.
- Unresolved examples, manifest mismatch, export tampering, extra records.
- Split leakage, exact duplicates, incomplete duplicate checks, stale lineage.
- Missing held-out eligibility, invalid attestations, coverage failures.
- Strict JSON and stable replay decisions/hashes.

Two corrections identified during drafting:

- Check registry availability before reading policy fields so a minimal unavailable response remains retryable.
- Resolve all current decisions for selected examples, not only submitter-listed approvals. Conflicting current reviews must block. Permissions require equivalent authoritative revocation/conflict resolution.

Index current reviews once by example revision and category; do not scan all reviews for every example.

Performance suite proposal: opt-in runs at 1,000, 10,000, and 50,000 examples; repeated subprocess timing; configurable median budgets and hard timeout; separate fixture-generation timing; input byte counts; unchanged hashes; final-record revocation. Budget examples are placeholders, not benchmark results. Peak-memory and network-isolation tests remain outstanding.

## 7. Model and application identity

Track model revision, application release, and deployment separately.

- Dataset update: data artifact only.
- Prompt/retrieval/tool-policy update: new application composition, not automatically new weights.
- Adapter update: effective identity includes exact base, adapter, and activation configuration.
- Full fine-tune: new model weights and configuration.
- Hosted fine-tune: provider model ID plus provenance, rather than assuming downloadable weights.
- Conversion/quantization: distinct execution artifact requiring evaluation.
- Rollback: previous immutable release, new deployment record.

Different hashes establish different bytes, not better behavior. Evaluation establishes task-specific comparisons. Approval and active deployment are separate records.

## 8. Application versioning

Use a readable application version, full Git source commit, canonical manifest SHA-256, and separate deployment ID. The manifest pins runtime image digest, model manifest, prompt, retrieval snapshot, inference configuration, and tool policy. No mutable latest references in approved composition.

Proposed version convention: major for breaking contracts, minor for compatible capabilities/composition updates, patch for compatible fixes. Same version and same digest is idempotent; same version and different digest is rejected. Promotion between environments reuses artifacts. Environment-specific behavioral settings require their own pinned deployment configuration; never store secret values in release metadata.

Keep approval/signatures and operational timestamps in separate records referencing the manifest digest to avoid circular identity and unnecessary identity changes.

## 9. Runtime build metadata

Embed application version and source commit at build time. Load the verified final application manifest at startup. Do not embed the final release digest in an image whose digest is itself included in that manifest.

Proposed Go layout, subject to the repository's eventual implementation choice:

- internal/buildinfo/buildinfo.go: linker-set string variables and Current().
- cmd/pinq/main.go: build-info subcommand and --version alias, handled before service startup.
- cmd/pinq/metadata_test.go: command-handler tests.
- cmd/pinq/metadata_integration_test.go: opt-in binary-build integration test.

Output fields: application_version, source_commit, build_time, go_version, os, architecture. Draft build_time uses the source commit timestamp for stability; rename to source_time before adoption if necessary to avoid misrepresenting actual build execution time. Actual CI timing belongs in a build attestation.

Linker injection uses -X <module>/internal/buildinfo.ApplicationVersion=<version> and equivalent SourceCommit/BuildTime values. Production builds require a clean checkout and post-build verification of embedded values, including the executable packaged in the image. Python implementations can package an equivalent generated metadata module; Go is not a required architecture decision.

## 10. Metadata integration test execution

The integration file begins with //go:build integration followed by a blank line and package main. It builds the real CLI using fixed metadata, runs from an empty directory, replaces metadata environment variables with spoofed values, checks one JSON value, validates both aliases, and checks invalid arguments return code 2. It forces native target settings for execution and uses bounded subprocess timeouts.

From the Go module root, after implementing the proposed files:

```bash
go test -tags=integration -run '^TestIntegrationBuiltBinaryMetadata$' -count=1 -timeout=3m -v ./cmd/pinq
```

List matching tests:

```bash
go test -tags=integration -list '^TestIntegrationBuiltBinaryMetadata$' ./cmd/pinq
```

Ordinary handler tests:

```bash
go test ./cmd/pinq
```

Do not retain the older untagged metadata_binary_test.go if replacing it with the dedicated integration test. An empty working directory does not independently prove absence of network access.

## 11. Implementation follow-up

1. Confirm SUZI/Pinq component naming, implementation language, and repository layout.
2. Turn proposed contracts into strict versioned schemas, including registry input schemas.
3. Implement trusted adapters and explicit current-decision conflict/revocation semantics.
4. Consolidate the draft checker with the identified fixes and complete policy coverage, including boundary-case requirements and all applicable rule checks.
5. Add bounded/streaming handling and resource tests before claiming large-file readiness.
6. Implement coordinated publication authorization, rollback, and post-release withdrawal tracing.
7. Add runtime manifest verification and actual loaded-component reporting.
8. Run integration, security, and performance tests in CI; record actual results separately.

No code execution, benchmark success, model improvement, or production deployment is asserted by this document.
