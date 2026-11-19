import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "./digest.js";
import { outputSchema } from "./schemas.js";
import type { ResourceExtractionInput } from "./types.js";

export const PROMPT_PACKAGE_VERSION = "1.0.0";
export const PROMPT_PACKAGE_ID = `resource.extract.v1@${PROMPT_PACKAGE_VERSION}`;
export const RENDERER_ID = "resource.extract.v1/render@1";

const PACKAGE_DIR = new URL(
  `../../../prompts/resource.extract.v1/${PROMPT_PACKAGE_VERSION}/`,
  import.meta.url,
);

interface PromptManifest {
  task: string;
  version: string;
  system_prompt_file: string;
  prompt_sha256: string;
  renderer: string;
  generation: { temperature: number; max_output_tokens: number };
}

function isPromptManifest(value: unknown): value is PromptManifest {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const gen = v["generation"];
  return (
    v["task"] === "resource.extract.v1" &&
    v["version"] === PROMPT_PACKAGE_VERSION &&
    typeof v["system_prompt_file"] === "string" &&
    typeof v["prompt_sha256"] === "string" &&
    v["renderer"] === RENDERER_ID &&
    gen !== null &&
    typeof gen === "object" &&
    typeof (gen as Record<string, unknown>)["temperature"] === "number" &&
    typeof (gen as Record<string, unknown>)["max_output_tokens"] === "number"
  );
}

export interface PromptPackage {
  id: string;
  systemPrompt: string;
  digest: string;
  generation: { temperature: number; max_output_tokens: number };
}

/**
 * Load the pinned prompt package and refuse to run if the system prompt
 * does not match the digest recorded in its manifest.
 */
export function loadPromptPackage(): PromptPackage {
  const manifestRaw: unknown = JSON.parse(
    readFileSync(fileURLToPath(new URL("manifest.json", PACKAGE_DIR)), "utf8"),
  );
  if (!isPromptManifest(manifestRaw)) {
    throw new Error("Prompt package manifest is invalid");
  }
  const systemPrompt = readFileSync(
    fileURLToPath(new URL(manifestRaw.system_prompt_file, PACKAGE_DIR)),
    "utf8",
  );
  const digest = sha256Hex(Buffer.from(systemPrompt, "utf8"));
  if (digest !== manifestRaw.prompt_sha256) {
    throw new Error(
      "Prompt package digest mismatch: system prompt changed without a new pinned version",
    );
  }
  return {
    id: PROMPT_PACKAGE_ID,
    systemPrompt,
    digest,
    generation: manifestRaw.generation,
  };
}

/** Provider-neutral request handed to an ExtractionAdapter. */
export interface RenderedExtractionRequest {
  task: "resource.extract.v1";
  prompt_package: string;
  renderer: string;
  messages: [
    { role: "system"; content: string },
    { role: "user"; content: string },
  ];
  response_format: {
    type: "json_schema";
    name: "resource_extract_v1_output";
    schema: Record<string, unknown>;
  };
  generation: { temperature: number; max_output_tokens: number };
}

/**
 * Deterministically serialize a VALIDATED input into the model-visible
 * request. Minimization: only the target, requested fields and evidence
 * text/ids go to the model. Provenance references, source URLs and digests
 * stay with SUZI. Trusted instructions (system message) are kept separate from
 * untrusted evidence (user message). Chat template tokens are applied once,
 * by the runtime behind the adapter, never here.
 */
export function renderRequest(
  input: ResourceExtractionInput,
  pkg: PromptPackage,
): RenderedExtractionRequest {
  const payload = {
    task: "resource.extract.v1",
    target: {
      mode: input.target.mode,
      ...(input.target.name_hint !== undefined
        ? { name_hint_not_evidence: input.target.name_hint }
        : {}),
    },
    requested_fields: input.requested_fields,
    untrusted_evidence: input.evidence.map((source) => ({
      evidence_id: source.evidence_id,
      source_kind: source.source_kind,
      ...(source.language_hint !== undefined
        ? { language_hint: source.language_hint }
        : {}),
      ...(source.published_at !== undefined
        ? { published_at: source.published_at }
        : {}),
      blocks: source.blocks.map((b) => ({ block_id: b.block_id, text: b.text })),
    })),
  };
  return {
    task: "resource.extract.v1",
    prompt_package: pkg.id,
    renderer: RENDERER_ID,
    messages: [
      { role: "system", content: pkg.systemPrompt },
      { role: "user", content: JSON.stringify(payload) },
    ],
    response_format: {
      type: "json_schema",
      name: "resource_extract_v1_output",
      schema: outputSchema,
    },
    generation: pkg.generation,
  };
}
