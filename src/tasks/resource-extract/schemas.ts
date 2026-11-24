import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { canonicalJson, sha256Hex } from "./digest.js";
import type {
  ResourceExtractionInput,
  ResourceExtractionOutput,
  ResourceExtractionResultData,
} from "./types.js";

const addFormats = addFormatsModule.default;

const CONTRACT_DIR = new URL(
  "../../../contracts/tasks/resource.extract.v1/",
  import.meta.url,
);

function loadSchema(name: string): Record<string, unknown> {
  const text = readFileSync(fileURLToPath(new URL(name, CONTRACT_DIR)), "utf8");
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Schema ${name} is not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

export const inputSchema = loadSchema("input.schema.json");
export const outputSchema = loadSchema("output.schema.json");
export const resultSchema = loadSchema("result.schema.json");

export const inputSchemaDigest = sha256Hex(canonicalJson(inputSchema));
export const outputSchemaDigest = sha256Hex(canonicalJson(outputSchema));

/** Strict Draft 2020-12 compiler: unknown keywords, loose types and unsafe unions fail at compile time. */
export function createStrictAjv(): Ajv2020 {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: false,
    allowUnionTypes: false,
  });
  addFormats(ajv);
  return ajv;
}

const ajv = createStrictAjv();

export const validateInput: ValidateFunction<ResourceExtractionInput> =
  ajv.compile<ResourceExtractionInput>(inputSchema);
export const validateOutput: ValidateFunction<ResourceExtractionOutput> =
  ajv.compile<ResourceExtractionOutput>(outputSchema);
export const validateResultData: ValidateFunction<ResourceExtractionResultData> =
  ajv.compile<ResourceExtractionResultData>(resultSchema);
