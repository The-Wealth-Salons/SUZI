# SUZI

Human-centered, open-source AI infrastructure making intelligence accessible to everyone.

> **Status: early-stage.** This repository holds the first SUZI task contract,
> `resource.extract.v1`, with deterministic tests and an offline MOCK example. No model has
> been benchmarked yet, nothing is deployed, and no outputs are published.
> [`docs/SUZI_LAUNCH_AND_REMEDIATION_PLAN.md`](docs/SUZI_LAUNCH_AND_REMEDIATION_PLAN.md) is
> the design and remediation plan behind this work.

## resource.extract.v1

The task takes caller-supplied evidence about a community resource (for example, a career center
or a benefits program) and returns structured claims. **Every extracted value carries
a verbatim quote from the source plus its UTF-16 offsets** (`start` inclusive, `end`
exclusive) in a specific block. SUZI rejects the whole result if a quote is missing,
appears more than once or does not match exactly. It does not repair or guess. A field the
evidence does not state comes back as `unknown` with a reason. That is better than a
confident guess.

- Contracts (JSON Schema 2020-12): `contracts/tasks/resource.extract.v1/`
  (`input.schema.json`, `output.schema.json` = what the model must return,
  `result.schema.json` = the validated result with spans and receipt)
- Implementation: `src/tasks/resource-extract/`
- Pinned prompt package: `prompts/resource.extract.v1/1.0.0/` (digest checked at load)
- Tests: `tests/resource-extract/` (no network, no API keys)

The model sits behind a small pluggable interface:

```ts
interface ExtractionAdapter {
  readonly descriptor: { adapter_id: string; model_ref: string; mock: boolean };
  generate(request: unknown): Promise<{ outputText: string; finishReason: "stop" | "length" | "refusal"; usage?: ... }>;
}
const service = createResourceExtractionService({ adapter });
const result = await service.execute(input); // {status:"ok",data} | {status:"abstained",reason} | {status:"failed",error:{code}}
```

There are two adapters:

- `mock`: a canned response for the bundled example. Offline, and explicitly labeled.
- `openai-compatible`: any self-hosted OpenAI-compatible chat endpoint (llama.cpp
  `llama-server`, Ollama, vLLM) serving a **small, non-frontier open-weight model**. The
  first candidate is `microsoft/Phi-4-mini-instruct` (MIT license). This is a benchmark
  hypothesis, not a validated choice. The adapter makes one request with no retries and
  has no frontier-model fallback.

## Requirements

Node.js **20.19 or newer** (tested on 20.19.2 with npm 11.21.1; see `.nvmrc`).

## Commands

```bash
npm ci                                   # install exact locked dependencies
npm test                                 # vitest run (86 tests, offline)
npm run typecheck                        # tsc --noEmit, strict
npm run --silent example                 # offline MOCK example, JSON to stdout
npm run --silent example > result.json   # save the result
npm run --silent hash-evidence -- input.json   # print content_sha256 for each source
```

Sample output (truncated; full file at `examples/resource-extract/expected-output.json`):

```json
{
  "status": "ok",
  "data": {
    "outcome": "extracted",
    "claims": [
      {
        "claim_id": "c2",
        "field": "cost",
        "value": "Initial consultations are free.",
        "assertion_kind": "source_statement",
        "evidence": [{ "evidence_id": "ev-0001", "block_id": "b1",
          "quote": "Initial consultations are free.",
          "span": { "start": 23, "end": 54, "unit": "utf16_code_unit" } }]
      }
    ],
    "receipt": { "adapter": { "adapter_id": "mock-canned@1", "mock": true }, "attempts": 1 }
  }
}
```

stderr also shows `WARNING: MOCK MODE, NO MODEL ...`. See
[`examples/resource-extract/README.md`](examples/resource-extract/README.md) for exit codes,
failure codes and how to use your own input.

## Input format (summary)

- `contract_version` `"1.0"`, `request_id`, `target` (`new_candidate` with optional
  `name_hint`, or `existing_resource` with `resource_id`)
- `requested_fields`: a unique subset of `name, provider_name, description, cost,
  service_area, eligibility_description, availability, application_deadline,
  application_url, contact, hours, languages, accessibility, application_requirements`
- `evidence[]`: `evidence_id`, `source_ref`, `source_kind`, `retrieved_at`, `blocks[]`
  (`block_id`, `text`), `content_sha256` = SHA-256 of the UTF-8 bytes of
  `JSON.stringify(blocks.map(b => [b.block_id, b.text]))`, and `provenance` (origin,
  collection, verification, rights and handling-policy references, preparation events)

Total evidence over 48,000 UTF-16 code units is rejected as `INVALID_INPUT`, not truncated.
Provenance, URLs and digests are checked but never sent to the model. Evidence goes to the
model as untrusted data, separate from the trusted instructions.

## Running with a local small model

```bash
# for example, llama.cpp:
llama-server -m Phi-4-mini-instruct-Q4_K_M.gguf --port 8080
export SUZI_MODEL_BASE_URL=http://127.0.0.1:8080/v1
export SUZI_MODEL_ID=phi-4-mini-instruct
# optional, only if your server requires it: export SUZI_MODEL_API_KEY=...
npx tsx examples/resource-extract/run.ts --adapter openai-compatible --input your-input.json
```

The server must support `response_format: {type: "json_schema"}` or tolerate it. Outputs
that fail validation are reported as failures, never repaired.

## Limitations

- The mock example is not inference and shows nothing about accuracy.
- No small model has been evaluated: there is no held-out evaluation set and no accuracy,
  latency or cost numbers yet.
- Quote matching is exact. There is no Unicode or whitespace normalization, so an
  ambiguous quote is rejected even if a human could tell the spans apart.
- `verification_state` and all `*_ref` values are recorded as supplied. This task does not
  resolve them against an external registry.
- The receipt records `"unknown"` for token counts when the server does not report them.
- Nothing here publishes, verifies or ranks resources.
