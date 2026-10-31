/**
 * Print the content_sha256 for every evidence source in an input JSON file,
 * using the production digest helper. Usage:
 *   npm run hash-evidence -- path/to/input.json
 */
import { readFileSync } from "node:fs";
import { computeEvidenceContentSha256 } from "../src/tasks/resource-extract/digest.js";
import type { EvidenceBlock } from "../src/tasks/resource-extract/types.js";

function isBlocks(value: unknown): value is EvidenceBlock[] {
  return (
    Array.isArray(value) &&
    value.every(
      (b: unknown) =>
        b !== null &&
        typeof b === "object" &&
        typeof (b as Record<string, unknown>)["block_id"] === "string" &&
        typeof (b as Record<string, unknown>)["text"] === "string",
    )
  );
}

const path = process.argv[2];
if (!path) {
  process.stderr.write("usage: npm run hash-evidence -- <input.json>\n");
  process.exit(2);
}
const doc: unknown = JSON.parse(readFileSync(path, "utf8"));
const evidence =
  doc !== null && typeof doc === "object" ? (doc as Record<string, unknown>)["evidence"] : undefined;
if (!Array.isArray(evidence)) {
  process.stderr.write("input has no evidence array\n");
  process.exit(2);
}
for (const source of evidence) {
  const s = source as Record<string, unknown>;
  const blocks = s["blocks"];
  if (!isBlocks(blocks)) {
    process.stderr.write("an evidence source has malformed blocks\n");
    process.exit(2);
  }
  process.stdout.write(`${String(s["evidence_id"])}\t${computeEvidenceContentSha256(blocks)}\n`);
}
