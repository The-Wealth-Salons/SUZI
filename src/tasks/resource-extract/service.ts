import { canonicalJson, computeEvidenceContentSha256, sha256Hex } from "./digest.js";
import { loadPromptPackage, renderRequest } from "./prompt.js";
import type { PromptPackage } from "./prompt.js";
import {
  inputSchemaDigest,
  outputSchemaDigest,
  validateInput,
  validateOutput,
  validateResultData,
} from "./schemas.js";
import { resolveQuote } from "./spans.js";
import type {
  AdapterResponse,
  EvidenceReference,
  ExtractionAdapter,
  FailureCode,
  ResourceExtractionInput,
  ResourceExtractionOutput,
  ResourceExtractionResult,
  ResourceExtractionResultData,
  ResourceField,
  ResultClaim,
  ResultReviewFlag,
  SpannedEvidenceReference,
} from "./types.js";

/**
 * Task budget for model-visible evidence text, in UTF-16 code units, across
 * all sources. Inputs above it are rejected (INVALID_INPUT), never truncated.
 * Sized well inside the 128k-token context of the Phi-4-mini-instruct
 * benchmark hypothesis; revisit with the pinned deployment inventory.
 */
export const MAX_TOTAL_EVIDENCE_UTF16 = 48_000;

export interface ResourceExtractionService {
  execute(input: unknown): Promise<ResourceExtractionResult>;
}

export interface CreateResourceExtractionServiceOptions {
  adapter: ExtractionAdapter;
}

class TaskFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
  }
}

const fail = (code: FailureCode): ResourceExtractionResult => ({
  status: "failed",
  error: { code },
});

export function createResourceExtractionService(
  options: CreateResourceExtractionServiceOptions,
): ResourceExtractionService {
  const { adapter } = options;
  // Fails fast (throws) at construction if the pinned prompt was altered.
  const pkg = loadPromptPackage();
  return {
    async execute(input: unknown): Promise<ResourceExtractionResult> {
      try {
        return await run(adapter, pkg, input);
      } catch (error) {
        if (error instanceof TaskFailure) return fail(error.code);
        // Never surface raw messages: they may contain source text or secrets.
        return fail("MODEL_UNAVAILABLE");
      }
    },
  };
}

async function run(
  adapter: ExtractionAdapter,
  pkg: PromptPackage,
  rawInput: unknown,
): Promise<ResourceExtractionResult> {
  // 1. Input: schema, then cross-record checks. The adapter is never invoked on invalid input.
  if (!validateInput(rawInput)) return fail("INVALID_INPUT");
  const input = rawInput;
  if (!inputCrossChecksPass(input)) return fail("INVALID_INPUT");

  // 2. Inference: exactly one attempt; no retries, no alternative adapter.
  const request = renderRequest(input, pkg);
  let response: AdapterResponse;
  try {
    response = await adapter.generate(request);
  } catch {
    return fail("MODEL_UNAVAILABLE");
  }
  if (!isAdapterResponse(response)) return fail("MODEL_UNAVAILABLE");

  // 3. Finish reason is checked before parsing.
  if (response.finishReason === "length") return fail("MODEL_OUTPUT_TRUNCATED");
  if (response.finishReason === "refusal") return fail("MODEL_REFUSAL");

  // 4. Parse and validate the model output.
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.outputText);
  } catch {
    return fail("INVALID_JSON");
  }
  if (!validateOutput(parsed)) return fail("OUTPUT_SCHEMA_INVALID");
  const output = parsed;

  // 5. Evidence: references exist, quotes resolve exactly once.
  const blocks = indexBlocks(input);
  const resolveRefs = (refs: EvidenceReference[]): SpannedEvidenceReference[] =>
    refs.map((ref) => spanReference(blocks, ref));
  for (const claim of output.claims) assertReferencesExist(blocks, claim.evidence);
  for (const flag of output.review_flags) assertReferencesExist(blocks, flag.evidence);
  const claims: ResultClaim[] = output.claims.map((claim) => {
    assertNoRepeatedQuotes(claim.evidence);
    return { ...claim, evidence: resolveRefs(claim.evidence) };
  });
  const reviewFlags: ResultReviewFlag[] = output.review_flags.map((flag) => ({
    code: flag.code,
    evidence: resolveRefs(flag.evidence),
  }));

  // 6. Requested-field coverage and claim/conflict integrity.
  checkFieldCoverage(input.requested_fields, output);
  checkClaimIntegrity(output);

  if (output.outcome === "abstained") {
    if (output.abstention_reason === null) return fail("OUTPUT_SCHEMA_INVALID");
    return { status: "abstained", reason: output.abstention_reason };
  }

  const data: ResourceExtractionResultData = {
    contract_version: "1.0",
    task: "resource.extract.v1",
    request_id: input.request_id,
    outcome: output.outcome,
    abstention_reason: output.abstention_reason,
    claims,
    unknown_fields: output.unknown_fields,
    conflicts: output.conflicts,
    review_flags: reviewFlags,
    receipt: {
      prompt_package: pkg.id,
      prompt_digest: pkg.digest,
      input_schema_digest: inputSchemaDigest,
      output_schema_digest: outputSchemaDigest,
      input_digest: sha256Hex(canonicalJson(input)),
      adapter: { ...adapter.descriptor },
      finish_reason: "stop",
      attempts: 1,
      usage: {
        input_tokens: response.usage?.inputTokens ?? "unknown",
        output_tokens: response.usage?.outputTokens ?? "unknown",
      },
      validation: {
        input_schema: "passed",
        output_schema: "passed",
        evidence_references: "passed",
        evidence_quotes: "passed",
        field_coverage: "passed",
        claim_integrity: "passed",
      },
    },
  };
  // The envelope itself must satisfy the published result contract.
  if (!validateResultData(data)) return fail("OUTPUT_SCHEMA_INVALID");
  return { status: "ok", data };
}

function inputCrossChecksPass(input: ResourceExtractionInput): boolean {
  const evidenceIds = new Set<string>();
  let total = 0;
  for (const source of input.evidence) {
    if (evidenceIds.has(source.evidence_id)) return false;
    evidenceIds.add(source.evidence_id);
    const blockIds = new Set<string>();
    for (const block of source.blocks) {
      if (blockIds.has(block.block_id)) return false;
      blockIds.add(block.block_id);
      total += block.text.length;
    }
    if (computeEvidenceContentSha256(source.blocks) !== source.content_sha256) {
      return false;
    }
  }
  return total <= MAX_TOTAL_EVIDENCE_UTF16;
}

function isAdapterResponse(value: unknown): value is AdapterResponse {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v["outputText"] !== "string") return false;
  const fr = v["finishReason"];
  if (fr !== "stop" && fr !== "length" && fr !== "refusal") return false;
  const usage = v["usage"];
  if (usage === undefined) return true;
  if (usage === null || typeof usage !== "object") return false;
  const u = usage as Record<string, unknown>;
  const okCount = (n: unknown) =>
    n === undefined || (typeof n === "number" && Number.isInteger(n) && n >= 0);
  return okCount(u["inputTokens"]) && okCount(u["outputTokens"]);
}

type BlockIndex = Map<string, Map<string, string>>;

function indexBlocks(input: ResourceExtractionInput): BlockIndex {
  const index: BlockIndex = new Map();
  for (const source of input.evidence) {
    index.set(
      source.evidence_id,
      new Map(source.blocks.map((b) => [b.block_id, b.text])),
    );
  }
  return index;
}

function assertReferencesExist(index: BlockIndex, refs: EvidenceReference[]): void {
  for (const ref of refs) {
    if (index.get(ref.evidence_id)?.get(ref.block_id) === undefined) {
      throw new TaskFailure("EVIDENCE_REFERENCE_INVALID");
    }
  }
}

function assertNoRepeatedQuotes(refs: EvidenceReference[]): void {
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = JSON.stringify([ref.evidence_id, ref.block_id, ref.quote]);
    if (seen.has(key)) throw new TaskFailure("EVIDENCE_QUOTE_INVALID");
    seen.add(key);
  }
}

function spanReference(index: BlockIndex, ref: EvidenceReference): SpannedEvidenceReference {
  const text = index.get(ref.evidence_id)?.get(ref.block_id);
  if (text === undefined) throw new TaskFailure("EVIDENCE_REFERENCE_INVALID");
  const resolution = resolveQuote(text, ref.quote);
  if (resolution.kind !== "resolved") throw new TaskFailure("EVIDENCE_QUOTE_INVALID");
  return {
    evidence_id: ref.evidence_id,
    block_id: ref.block_id,
    quote: ref.quote,
    span: resolution.span,
  };
}

function checkFieldCoverage(
  requested: ResourceField[],
  output: ResourceExtractionOutput,
): void {
  const requestedSet = new Set<ResourceField>(requested);
  const claimed = new Set<ResourceField>();
  for (const claim of output.claims) {
    if (!requestedSet.has(claim.field)) throw new TaskFailure("FIELD_COVERAGE_INVALID");
    claimed.add(claim.field);
  }
  const unknown = new Set<ResourceField>();
  for (const entry of output.unknown_fields) {
    if (!requestedSet.has(entry.field) || unknown.has(entry.field) || claimed.has(entry.field)) {
      throw new TaskFailure("FIELD_COVERAGE_INVALID");
    }
    unknown.add(entry.field);
  }
  for (const conflict of output.conflicts) {
    if (!requestedSet.has(conflict.field)) throw new TaskFailure("FIELD_COVERAGE_INVALID");
  }
  if (output.outcome === "extracted") {
    for (const field of requested) {
      if (!claimed.has(field) && !unknown.has(field)) {
        throw new TaskFailure("FIELD_COVERAGE_INVALID");
      }
    }
  }
}

function checkClaimIntegrity(output: ResourceExtractionOutput): void {
  const fieldById = new Map<string, ResourceField>();
  for (const claim of output.claims) {
    if (fieldById.has(claim.claim_id)) throw new TaskFailure("CLAIM_INTEGRITY_INVALID");
    fieldById.set(claim.claim_id, claim.field);
  }
  const seenConflicts = new Set<string>();
  for (const conflict of output.conflicts) {
    for (const id of conflict.claim_ids) {
      if (fieldById.get(id) !== conflict.field) {
        throw new TaskFailure("CLAIM_INTEGRITY_INVALID");
      }
    }
    const key = JSON.stringify([conflict.field, [...conflict.claim_ids].sort()]);
    if (seenConflicts.has(key)) throw new TaskFailure("CLAIM_INTEGRITY_INVALID");
    seenConflicts.add(key);
  }
}
