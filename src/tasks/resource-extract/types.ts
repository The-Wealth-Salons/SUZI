/**
 * Types for resource.extract.v1.
 *
 * These interfaces mirror the canonical JSON Schemas under
 * contracts/tasks/resource.extract.v1/. The schemas are authoritative: values
 * only acquire these types through the compiled AJV validators in
 * ./schemas.ts (type guards), never through casts.
 */

export const RESOURCE_FIELDS = [
  "name",
  "provider_name",
  "description",
  "cost",
  "service_area",
  "eligibility_description",
  "availability",
  "application_deadline",
  "application_url",
  "contact",
  "hours",
  "languages",
  "accessibility",
  "application_requirements",
] as const;
export type ResourceField = (typeof RESOURCE_FIELDS)[number];

export type SourceKind =
  | "provider_material"
  | "government_material"
  | "community_submission"
  | "third_party_material"
  | "documented_verification";

export type OriginKind =
  | "provider_publication"
  | "government_publication"
  | "community_contribution"
  | "third_party_publication"
  | "documented_verification";

/**
 * source_kind (what the material is) and provenance.origin_kind (how it
 * entered the record) are both kept on the wire for compatibility with the
 * earlier draft. They must form one of these pairs; the input schema enforces it.
 */
export const SOURCE_ORIGIN_PAIRS: Readonly<Record<SourceKind, OriginKind>> = {
  provider_material: "provider_publication",
  government_material: "government_publication",
  community_submission: "community_contribution",
  third_party_material: "third_party_publication",
  documented_verification: "documented_verification",
};

export interface PreparationEvent {
  event_ref: string;
  operation:
    | "html_to_text"
    | "document_text_extraction"
    | "ocr"
    | "redaction"
    | "translation"
    | "normalization"
    | "segmentation";
  performed_at: string;
  performed_by_ref: string;
  implementation_ref: string;
  input_artifact_refs: string[];
  output_artifact_ref: string;
}

export interface Provenance {
  record_ref: string;
  origin_kind: OriginKind;
  contribution_ref?: string;
  collected_by_ref: string;
  collection_method:
    | "http_fetch"
    | "api_import"
    | "file_upload"
    | "community_form"
    | "manual_entry"
    | "documented_contact";
  verification_state:
    | "unreviewed"
    | "partially_verified"
    | "verified"
    | "disputed"
    | "rejected";
  verification_event_ref?: string;
  rights_record_ref: string;
  handling_policy_ref: string;
  preparation: PreparationEvent[];
}

export interface EvidenceBlock {
  block_id: string;
  text: string;
}

export interface EvidenceSource {
  evidence_id: string;
  source_ref: string;
  source_kind: SourceKind;
  source_url?: string;
  published_at?: string;
  observed_at?: string;
  retrieved_at: string;
  language_hint?: string;
  content_sha256: string;
  blocks: EvidenceBlock[];
  provenance: Provenance;
}

export interface ExtractionTarget {
  mode: "new_candidate" | "existing_resource";
  resource_id?: string;
  name_hint?: string;
}

export interface ResourceExtractionInput {
  contract_version: "1.0";
  request_id: string;
  target: ExtractionTarget;
  requested_fields: ResourceField[];
  evidence: EvidenceSource[];
}

export type AbstentionReason =
  | "insufficient_evidence"
  | "multiple_resources"
  | "target_not_identifiable"
  | "unsupported_language"
  | "outside_task_scope";

export interface EvidenceReference {
  evidence_id: string;
  block_id: string;
  quote: string;
}

export interface ModelClaim {
  claim_id: string;
  field: ResourceField;
  value: string;
  assertion_kind: "source_statement" | "reported_experience";
  evidence: EvidenceReference[];
}

export interface UnknownField {
  field: ResourceField;
  reason: "not_stated" | "ambiguous" | "unreadable" | "target_unclear";
}

export interface Conflict {
  field: ResourceField;
  claim_ids: string[];
  description: string;
}

export type ReviewFlagCode =
  | "possible_personal_data"
  | "possible_confidential_location"
  | "instruction_like_source_text"
  | "ambiguous_temporal_context"
  | "possible_multiple_resources";

export interface ModelReviewFlag {
  code: ReviewFlagCode;
  evidence: EvidenceReference[];
}

/** What the model is allowed to return (output.schema.json). */
export interface ResourceExtractionOutput {
  contract_version: "1.0";
  outcome: "extracted" | "abstained";
  abstention_reason: AbstentionReason | null;
  claims: ModelClaim[];
  unknown_fields: UnknownField[];
  conflicts: Conflict[];
  review_flags: ModelReviewFlag[];
}

/** UTF-16 code-unit span, exclusive end, into the exact model-visible block text. */
export interface QuoteSpan {
  start: number;
  end: number;
  unit: "utf16_code_unit";
}

export interface SpannedEvidenceReference extends EvidenceReference {
  span: QuoteSpan;
}

export interface ResultClaim extends Omit<ModelClaim, "evidence"> {
  evidence: SpannedEvidenceReference[];
}

export interface ResultReviewFlag {
  code: ReviewFlagCode;
  evidence: SpannedEvidenceReference[];
}

export interface AdapterDescriptor {
  /** Stable adapter implementation id, e.g. "openai-compatible-chat@1". */
  adapter_id: string;
  /** Pinned model reference the adapter is configured for (or a MOCK label). */
  model_ref: string;
  /** True only for canned, non-inference adapters. */
  mock: boolean;
}

export interface ExecutionReceipt {
  prompt_package: string;
  prompt_digest: string;
  input_schema_digest: string;
  output_schema_digest: string;
  input_digest: string;
  adapter: AdapterDescriptor;
  finish_reason: "stop";
  attempts: 1;
  usage: {
    input_tokens: number | "unknown";
    output_tokens: number | "unknown";
  };
  validation: {
    input_schema: "passed";
    output_schema: "passed";
    evidence_references: "passed";
    evidence_quotes: "passed";
    field_coverage: "passed";
    claim_integrity: "passed";
  };
}

/** Envelope SUZI returns (result.schema.json). Claims are candidates, not verified facts. */
export interface ResourceExtractionResultData {
  contract_version: "1.0";
  task: "resource.extract.v1";
  request_id: string;
  outcome: "extracted" | "abstained";
  abstention_reason: AbstentionReason | null;
  claims: ResultClaim[];
  unknown_fields: UnknownField[];
  conflicts: Conflict[];
  review_flags: ResultReviewFlag[];
  receipt: ExecutionReceipt;
}

export const FAILURE_CODES = [
  "INVALID_INPUT",
  "INVALID_JSON",
  "OUTPUT_SCHEMA_INVALID",
  "EVIDENCE_REFERENCE_INVALID",
  "EVIDENCE_QUOTE_INVALID",
  "FIELD_COVERAGE_INVALID",
  "CLAIM_INTEGRITY_INVALID",
  "MODEL_OUTPUT_TRUNCATED",
  "MODEL_REFUSAL",
  "MODEL_UNAVAILABLE",
] as const;
export type FailureCode = (typeof FAILURE_CODES)[number];

export type ResourceExtractionResult =
  | { status: "ok"; data: ResourceExtractionResultData }
  | { status: "abstained"; reason: AbstentionReason }
  | { status: "failed"; error: { code: FailureCode } };

export type FinishReason = "stop" | "length" | "refusal";

export interface AdapterResponse {
  outputText: string;
  finishReason: FinishReason;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * Provider-neutral transport. The task service owns validation; the adapter
 * only formats the rendered request for its runtime and returns raw text.
 * Adapters must not retry with a different model or provider.
 */
export interface ExtractionAdapter {
  readonly descriptor: AdapterDescriptor;
  generate(request: unknown): Promise<AdapterResponse>;
}
