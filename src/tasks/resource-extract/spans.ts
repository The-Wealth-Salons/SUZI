import type { QuoteSpan } from "./types.js";

const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export type QuoteResolution =
  | { kind: "resolved"; span: QuoteSpan }
  | { kind: "not_found" }
  | { kind: "ambiguous" };

/**
 * Resolve a verbatim quotation to a UTF-16 code-unit span (exclusive end)
 * in the exact model-visible block text. No normalization, trimming or fuzzy
 * matching: the quote must occur exactly once (overlapping repeats count as
 * ambiguous). Ambiguous or missing quotes are rejected, never guessed.
 */
export function resolveQuote(blockText: string, quote: string): QuoteResolution {
  // A lone surrogate could otherwise match half of an emoji or other
  // astral character and produce a span that splits it.
  if (quote.length === 0 || LONE_SURROGATE.test(quote)) return { kind: "not_found" };
  const first = blockText.indexOf(quote);
  if (first === -1) return { kind: "not_found" };
  if (blockText.indexOf(quote, first + 1) !== -1) return { kind: "ambiguous" };
  return {
    kind: "resolved",
    span: { start: first, end: first + quote.length, unit: "utf16_code_unit" },
  };
}
