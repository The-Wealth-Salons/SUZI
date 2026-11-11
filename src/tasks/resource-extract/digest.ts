import { createHash } from "node:crypto";
import type { EvidenceBlock } from "./types.js";

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * The single definition of evidence content_sha256.
 *
 * Serialization: UTF-8 bytes of JSON.stringify of the ordered array
 * [[block_id, text], ...] for the source's blocks, exactly as supplied.
 * Block order is significant. No Unicode normalization is applied, so the
 * digest covers the exact text the model sees and quotes are checked against.
 */
export function computeEvidenceContentSha256(
  blocks: readonly EvidenceBlock[],
): string {
  const canonical = JSON.stringify(blocks.map((b) => [b.block_id, b.text]));
  return sha256Hex(Buffer.from(canonical, "utf8"));
}

/**
 * Deterministic JSON with lexicographically sorted object keys, used for
 * receipt digests (input and schema digests). Not used for evidence digests.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    // Preserve every JSON key, including __proto__, as an own data property.
    const out: Record<string, unknown> = Object.create(null);
    for (const [k, v] of entries) {
      Object.defineProperty(out, k, {
        value: sortKeys(v),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return out;
  }
  return value;
}
