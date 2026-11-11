# resource.extract.v1: implementation notes

Status: local implementation on `feat/resource-extract-v1`. Not reviewed, not deployed.

## What is implemented (mapped to the plan)

| Plan requirement | Where |
| --- | --- |
| Input/output contracts, Draft 2020-12, strict AJV | `contracts/tasks/resource.extract.v1/*.schema.json`, `src/tasks/resource-extract/schemas.ts` |
| Every claim quotes the source verbatim; UTF-16 exclusive-end spans; unresolved or ambiguous quotes rejected | `spans.ts`, `service.ts` (`EVIDENCE_QUOTE_INVALID`) |
| Source digest checked before the model is called | `digest.ts`, `service.ts` (`INVALID_INPUT`) |
| Field coverage: every requested field is known or `unknown` with a reason, with no extras | `service.ts` (`FIELD_COVERAGE_INVALID`) |
| Pinned prompt package with digest; trusted instructions separate from untrusted evidence; minimized model input | `prompts/resource.extract.v1/1.0.0/`, `prompt.ts` |
| Over-budget evidence rejected, never truncated (48,000 UTF-16 units) | `service.ts` |
| Finish reason checked before parsing; no retries; no raw text in errors | `service.ts` |
| Small non-frontier model behind a pluggable adapter; no frontier fallback | `adapters/openai-compatible.ts` (Phi-4-mini-instruct is the first benchmark candidate) |
| Receipt: prompt/schema/input digests, adapter and model reference, mock flag, attempts, tokens or `"unknown"` | `result.schema.json`, `service.ts` |
| Offline MOCK example with exit-code contract | `examples/resource-extract/` |
| Deterministic contract tests, no network | `tests/resource-extract/` (example tests preload a fetch/socket blocker) |

## Decisions to review

- Added the failure code `CLAIM_INTEGRITY_INVALID` for duplicate claim IDs, conflicts that
  point to unknown claims or claims for another field, and duplicate conflict entries. The
  original spec had no code that fit these cases.
- Unexpected exceptions inside the adapter call map to `MODEL_UNAVAILABLE`.
- The model output schema has no spans. SUZI computes spans from the quotes, so the model
  is never trusted for offsets.
- `*_ref` values allow `@` and `+` so version-pinned implementation references validate.
- TypeScript types are hand-written to mirror the schemas. They are not generated from
  them; the tests check that the field enums match.

## Not done (see the root README limitations)

- No held-out evaluation set, no model benchmark, no pinned model revision or quantization.
- No external registry resolution for references; no rights inventory.
- No hosted demo, users or deployment.
