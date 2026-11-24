/**
 * Synthetic fixture builders. All data is invented; digests are computed with
 * the production helper so fixtures never carry placeholder hashes.
 */
import { computeEvidenceContentSha256 } from "../../../src/tasks/resource-extract/digest.js";
import type {
  EvidenceBlock,
  EvidenceReference,
  ModelClaim,
  ResourceExtractionOutput,
} from "../../../src/tasks/resource-extract/types.js";

export type Json = Record<string, unknown>;

export function source(evidenceId: string, blocks: EvidenceBlock[], overrides: Json = {}): Json {
  return {
    evidence_id: evidenceId,
    source_ref: `suzi-synthetic:source/${evidenceId}`,
    source_kind: "provider_material",
    retrieved_at: "2026-10-31T12:00:00Z",
    content_sha256: computeEvidenceContentSha256(blocks),
    blocks,
    provenance: {
      record_ref: `suzi-synthetic:record/${evidenceId}`,
      origin_kind: "provider_publication",
      collected_by_ref: "suzi-synthetic:collector/test",
      collection_method: "manual_entry",
      verification_state: "unreviewed",
      rights_record_ref: "suzi-synthetic:rights/test",
      handling_policy_ref: "suzi-synthetic:policy/test",
      preparation: [],
    },
    ...overrides,
  };
}

export const CAREER_TEXT =
  "Example Career Center. Initial consultations are free. Follow-up appointments cost $50.";

export function careerInput(overrides: Json = {}): Json {
  return {
    contract_version: "1.0",
    request_id: "req-test-1",
    target: { mode: "new_candidate", name_hint: "Example Career Center" },
    requested_fields: ["name", "cost", "hours"],
    evidence: [source("ev1", [{ block_id: "b1", text: CAREER_TEXT }])],
    ...overrides,
  };
}

export function ref(quote: string, evidenceId = "ev1", blockId = "b1"): EvidenceReference {
  return { evidence_id: evidenceId, block_id: blockId, quote };
}

export function claim(id: string, field: ModelClaim["field"], quote: string, extra: Partial<ModelClaim> = {}): ModelClaim {
  return {
    claim_id: id,
    field,
    value: quote,
    assertion_kind: "source_statement",
    evidence: [ref(quote)],
    ...extra,
  };
}

export function careerOutput(overrides: Partial<ResourceExtractionOutput> = {}): ResourceExtractionOutput {
  return {
    contract_version: "1.0",
    outcome: "extracted",
    abstention_reason: null,
    claims: [
      claim("c1", "name", "Example Career Center"),
      claim("c2", "cost", "Initial consultations are free."),
      claim("c3", "cost", "Follow-up appointments cost $50."),
    ],
    unknown_fields: [{ field: "hours", reason: "not_stated" }],
    conflicts: [],
    review_flags: [],
    ...overrides,
  };
}
