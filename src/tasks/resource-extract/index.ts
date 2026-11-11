export { createResourceExtractionService, MAX_TOTAL_EVIDENCE_UTF16 } from "./service.js";
export type {
  CreateResourceExtractionServiceOptions,
  ResourceExtractionService,
} from "./service.js";
export { createMockAdapter, MOCK_MODEL_REF } from "./adapters/mock.js";
export {
  createOpenAICompatibleAdapter,
  openAICompatibleConfigFromEnv,
  ModelConfigurationError,
  MODEL_ENV,
} from "./adapters/openai-compatible.js";
export type { OpenAICompatibleAdapterConfig } from "./adapters/openai-compatible.js";
export { computeEvidenceContentSha256 } from "./digest.js";
export { resolveQuote } from "./spans.js";
export { renderRequest, loadPromptPackage, PROMPT_PACKAGE_ID } from "./prompt.js";
export { validateInput, validateOutput, validateResultData } from "./schemas.js";
export * from "./types.js";
