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

/**
 * Hard bound on adapter output text, in UTF-16 code units, enforced before
 * JSON parsing. An adapter (or a compromised model endpoint behind it) that
 * returns more than this yields one bounded MODEL_UNAVAILABLE failure; the
 * oversized text is never parsed, retained or surfaced.
 */
export const MAX_MODEL_OUTPUT_LENGTH = 1_048_576;

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
  // The caller keeps ownership of the object it passed in and may mutate or
  // reuse it while the adapter call below is awaited. Execute against an
  // owned deep snapshot so rendering, evidence resolution, field coverage
  // and the receipt all describe the one input that passed validation and
  // the content-digest checks.
  const input = snapshotValidatedInput(rawInput);
  if (!inputCrossChecksPass(input)) return fail("INVALID_INPUT");
  // Owner-ruled deterministic gates (B., 2026-11-23): the existing-resource
  // target label must match the evidence, and the evidence must be free of
  // instruction-like text. Both run before rendering, so the adapter is
  // never invoked on a request that fails either check.
  if (!targetLabelMatchesEvidence(input)) return fail("INVALID_INPUT");
  if (!evidenceFreeOfInstructionLikeText(input)) return fail("INVALID_INPUT");

  // 2. Inference: exactly one attempt; no retries, no alternative adapter.
  const request = renderRequest(input, pkg);
  let response: AdapterResponse;
  try {
    response = await adapter.generate(request);
  } catch {
    return fail("MODEL_UNAVAILABLE");
  }
  if (!isAdapterResponse(response)) return fail("MODEL_UNAVAILABLE");
  if (response.outputText.length > MAX_MODEL_OUTPUT_LENGTH) {
    return fail("MODEL_UNAVAILABLE");
  }

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

  if (output.outcome === "abstained" && output.abstention_reason === null) {
    return fail("OUTPUT_SCHEMA_INVALID");
  }

  // Both outcomes build and validate the full trusted envelope: request
  // correlation, resolved review flags, unknown fields and the execution
  // receipt survive an abstention exactly as they survive an extraction.
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
  if (data.outcome === "abstained") {
    // abstention_reason is non-null here: checked before the envelope is built.
    return { status: "abstained", reason: data.abstention_reason as NonNullable<typeof data.abstention_reason>, data };
  }
  return { status: "ok", data };
}

function snapshotValidatedInput(input: ResourceExtractionInput): ResourceExtractionInput {
  // The validated input is plain JSON data (it just passed the JSON-schema
  // check), so a JSON round-trip is a complete, owned deep copy.
  return JSON.parse(JSON.stringify(input)) as ResourceExtractionInput;
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

/**
 * Text normalization for the target-label match: Unicode compatibility
 * folding, case folding, and collapsing every run of non-alphanumeric
 * characters to one space, so punctuation and whitespace differences
 * between the caller's label and the evidence do not defeat the match.
 */
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Scripts written without spaces between words (Han, kana, Hangul,
 * Thai, Lao). In these scripts a resource name in ordinary prose sits
 * directly against its neighbours, so substring presence — not a
 * space boundary — is the correct match semantics for a label written
 * entirely in such a script.
 */
const UNSPACED_SCRIPT_CHAR =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}]/u;

function isUnspacedScriptLabel(normalizedLabel: string): boolean {
  let sawUnspaced = false;
  for (const ch of normalizedLabel) {
    if (/\p{L}/u.test(ch)) {
      if (!UNSPACED_SCRIPT_CHAR.test(ch)) return false;
      sawUnspaced = true;
    }
  }
  return sawUnspaced;
}

/**
 * Owner ruling (B., 2026-11-23, approved as recommended): an
 * existing-resource request must carry an evidence-matchable target
 * label. The amended input schema requires `name_hint` for
 * `existing_resource`; this cross-check is the matchability half. The
 * normalized label must appear in at least one evidence block: as a
 * complete token phrase (space-padded on both sides, so "East Clinic"
 * matches neither "Northeast Clinic" nor "East Clinics") for labels in
 * space-delimited scripts, or as a plain substring for labels written
 * entirely in an unspaced script, where names carry no space boundary
 * in ordinary prose. A label that matches nothing is rejected
 * fail-closed (INVALID_INPUT) before inference, because without it the
 * model cannot tell the caller's target from any other resource the
 * evidence describes.
 */
function targetLabelMatchesEvidence(input: ResourceExtractionInput): boolean {
  if (input.target.mode !== "existing_resource") return true;
  const label = input.target.name_hint;
  if (label === undefined) return false;
  const needle = normalizeForMatch(label);
  if (needle.length === 0) return false;
  const unspaced = isUnspacedScriptLabel(needle);
  for (const source of input.evidence) {
    for (const block of source.blocks) {
      const haystack = normalizeForMatch(block.text);
      if (unspaced ? haystack.includes(needle) : ` ${haystack} `.includes(` ${needle} `)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Deterministic patterns for instruction-like text in ingested source
 * material: override/disregard directives aimed at governing
 * instructions, prompt-disclosure directives, role reassignment of the
 * reader, chat-template role markers and tokens, "new instructions"
 * directives, and fake verification directives aimed at this pipeline.
 * Deliberately narrow — benign instructional prose ("Follow the
 * instructions on the application form") matches none of these and
 * passes; borderline text outside the set remains the model-flag
 * layer's job (system prompt rule 1).
 */
const INSTRUCTION_LIKE_PATTERNS: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass|do\s+not\s+follow)\b[^.!?\n]{0,40}\b(?:your|the|all|any|previous|prior|above|system|original|these|those)\s+(?:system\s+)?(?:instructions?|prompts?|rules?|directions?|guidelines?)\b/i,
  /\b(?:reveal|disclose|leak|print|repeat|output|show)\b[^.!?\n]{0,40}\b(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)\b/i,
  /\byour\s+(?:system\s+)?(?:prompt|instructions?)\b[^.!?\n]{0,40}\b(?:reveal|disclose|leak|print|repeat|output|show)\b/i,
  /\byou\s+are\s+now\s+(?:in\s+|a\s+|an\s+|the\s+)?[\w-]*\s*(?:mode|assistant|ai|model|bot|persona)\b/i,
  /\bact\s+as\s+(?:if\s+you\s+are\s+)?(?:an?\s+)?(?:ai|assistant|model|chatbot|llm)\b/i,
  /^\s*(?:system|assistant|developer)\s*[:>]/im,
  /<\|(?:im_start|im_end|system|assistant|user)\|>|\[\/?INST\]|<<\/?SYS>>/i,
  /\bnew\s+instructions?\s*[:—–-]/i,
  /\bmark\s+this\b[^.!?\n]{0,40}\b(?:verified|approved|validated|confirmed)\b/i,
];

/**
 * Owner ruling (B., 2026-11-23, approved as recommended):
 * instruction-like-text resistance in ingested sources is a HARD
 * DETERMINISTIC service-side check, not a model-only duty. Pure pattern
 * matching over the evidence text — no model call, same input always
 * gives the same verdict.
 */
export function detectInstructionLikeText(text: string): boolean {
  return INSTRUCTION_LIKE_PATTERNS.some((pattern) => pattern.test(text));
}

function evidenceFreeOfInstructionLikeText(input: ResourceExtractionInput): boolean {
  for (const source of input.evidence) {
    for (const block of source.blocks) {
      if (detectInstructionLikeText(block.text)) return false;
    }
  }
  return true;
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
  // Coverage applies to both outcomes (prompt rule 3): an abstention has
  // no claims by contract, so every requested field must be accounted for
  // in unknown_fields — otherwise the caller gets no reason for the fields
  // the abstention silently dropped while the receipt records coverage as
  // passed.
  for (const field of requested) {
    if (!claimed.has(field) && !unknown.has(field)) {
      throw new TaskFailure("FIELD_COVERAGE_INVALID");
    }
  }
}

function checkClaimIntegrity(output: ResourceExtractionOutput): void {
  const fieldById = new Map<string, ResourceField>();
  const claimSignatures = new Set<string>();
  for (const claim of output.claims) {
    if (fieldById.has(claim.claim_id)) throw new TaskFailure("CLAIM_INTEGRITY_INVALID");
    fieldById.set(claim.claim_id, claim.field);
    // Distinct claim_ids do not make two claims distinct facts: an exact
    // repeat (same field, value, assertion kind and evidence) would be
    // double-counted downstream, so reject it like a repeated id.
    const signature = JSON.stringify([
      claim.field,
      claim.value,
      claim.assertion_kind,
      claim.evidence
        .map((ref) => JSON.stringify([ref.evidence_id, ref.block_id, ref.quote]))
        .sort(),
    ]);
    if (claimSignatures.has(signature)) throw new TaskFailure("CLAIM_INTEGRITY_INVALID");
    claimSignatures.add(signature);
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
