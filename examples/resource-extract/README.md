# resource.extract.v1: offline MOCK example

> **MOCK MODE, NO MODEL.** `--adapter mock` returns a canned model response written for
> the bundled synthetic evidence. Everything after the adapter is real: input and digest
> checks, the JSON parse, output-schema validation, the verbatim-quote and UTF-16 span
> checks, field coverage and the receipt. It shows the workflow and the validation. It
> does not show model accuracy.

## Run it

```bash
npm ci
npm run --silent example                   # JSON result on stdout, MOCK warning on stderr
npm run --silent example > result.json     # save the result (stdout only holds JSON)
```

Use `--silent` so npm's script banner stays out of stdout. You can also call the runner
directly:

```bash
npx tsx examples/resource-extract/run.ts --adapter mock --input path/to/input.json
```

The default `--input` is `input.json` next to `run.ts`, so it is found from any working
directory. The runner only reads files. It never writes or overwrites them.

## Files

| File | Purpose |
| --- | --- |
| `input.json` | Synthetic input: one source, one block, fields `name`, `cost`, `hours` |
| `mock-model-output.json` | The canned "model" reply used by `--adapter mock` |
| `expected-output.json` | The exact stdout of `npm run --silent example` (checked by tests) |
| `run.ts` | The CLI runner |

The synthetic evidence is: *"Example Career Center. Initial consultations are free.
Follow-up appointments cost $50."* The expected result keeps the qualified cost as two
separate quoted claims (free initial consultation; $50 follow-up). It never reduces this
to "free". `hours` comes back as `unknown` / `not_stated`.

## Using your own input

1. Copy `input.json` and change `request_id`, `target`, `requested_fields` and `evidence`.
2. Recompute each source's `content_sha256` with `npm run --silent hash-evidence -- your-input.json`.
3. Run `npx tsx examples/resource-extract/run.ts --adapter mock --input your-input.json`.

With the mock adapter, changed evidence **fails on purpose** (`EVIDENCE_QUOTE_INVALID`):
the canned quotes no longer appear in your text. To extract from new evidence, use the
small-model adapter (see the root README):

```bash
export SUZI_MODEL_BASE_URL=http://127.0.0.1:8080/v1   # llama.cpp / Ollama / vLLM server
export SUZI_MODEL_ID=phi-4-mini-instruct
npx tsx examples/resource-extract/run.ts --adapter openai-compatible --input your-input.json
```

If those variables are missing, the runner exits 2. It never falls back to the mock.

## Exit codes

| Code | Meaning | stdout |
| --- | --- | --- |
| 0 | `status: "ok"`, or a valid `status: "abstained"` | result JSON |
| 1 | `status: "failed"` with a bounded error code | result JSON |
| 2 | Usage, missing file, malformed JSON or missing model config | empty |
| 3 | Unexpected runner failure (details withheld) | empty |

Failure codes: `INVALID_INPUT`, `INVALID_JSON`, `OUTPUT_SCHEMA_INVALID`,
`EVIDENCE_REFERENCE_INVALID`, `EVIDENCE_QUOTE_INVALID`, `CLAIM_INTEGRITY_INVALID`,
`FIELD_COVERAGE_INVALID`, `MODEL_OUTPUT_TRUNCATED`, `MODEL_REFUSAL`, `MODEL_UNAVAILABLE`.
Errors never include raw model text, evidence text, stack traces or credentials.
