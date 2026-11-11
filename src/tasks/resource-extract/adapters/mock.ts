import type { AdapterResponse, ExtractionAdapter, FinishReason } from "../types.js";

export const MOCK_MODEL_REF = "MOCK canned response (no model, no inference)";

export interface MockAdapterOptions {
  /** Exact text the "model" returns. It does not look at the request. */
  cannedOutputText: string;
  finishReason?: FinishReason;
}

/**
 * Offline MOCK adapter for demonstrations and contract tests. It performs no
 * inference: it returns one fixed response regardless of the request, so it
 * is only "correct" for the evidence it was written for. Never use it as a
 * fallback for a missing or failing model configuration.
 */
export function createMockAdapter(options: MockAdapterOptions): ExtractionAdapter & {
  readonly calls: number;
} {
  let calls = 0;
  const response: AdapterResponse = {
    outputText: options.cannedOutputText,
    finishReason: options.finishReason ?? "stop",
  };
  return {
    descriptor: { adapter_id: "mock-canned@1", model_ref: MOCK_MODEL_REF, mock: true },
    get calls() {
      return calls;
    },
    async generate(): Promise<AdapterResponse> {
      calls += 1;
      return { ...response };
    },
  };
}
