import type { AdapterResponse, ExtractionAdapter, FinishReason } from "../types.js";

/**
 * Transport adapter for a self-hosted, OpenAI-compatible chat-completions
 * server (for example llama.cpp `llama-server`, Ollama, or vLLM) serving a
 * small open-weight model. The plan's benchmark hypothesis is
 * microsoft/Phi-4-mini-instruct (3.8B); that choice is not yet a verified
 * suitability claim. OpenAI-compatible transport does not prove behavioral
 * compatibility: pin and evaluate the exact model revision and quantization.
 *
 * This adapter makes one request. It never retries, never switches model or
 * provider, and never falls back to a mock or frontier model.
 */
export interface OpenAICompatibleAdapterConfig {
  /** Base URL ending before /chat/completions, e.g. http://127.0.0.1:8080/v1 */
  baseUrl: string;
  /** Exact served model id, ideally including revision/quantization. */
  model: string;
  /** Optional bearer token for servers that require one. Never logged. */
  apiKey?: string;
  timeoutMs?: number;
  /** Hard cap on the response body size in bytes. Defaults to MAX_MODEL_RESPONSE_BYTES. */
  maxResponseBytes?: number;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Hard byte limit on a model-server response body. `max_tokens` is only a
 * request parameter: an erroneous or compromised OpenAI-compatible server
 * can ignore it, so the body is read as a stream and rejected the moment it
 * exceeds this limit — including responses with no Content-Length.
 */
export const MAX_MODEL_RESPONSE_BYTES = 1_048_576;

async function readBodyWithLimit(res: Response, limit: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    throw new Error("model response too large");
  }
  const body = res.body;
  if (body === null || typeof body.getReader !== "function") {
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > limit) {
      throw new Error("model response too large");
    }
    return text;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw new Error("model response too large");
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export class ModelConfigurationError extends Error {}

export const MODEL_ENV = {
  baseUrl: "SUZI_MODEL_BASE_URL",
  model: "SUZI_MODEL_ID",
  apiKey: "SUZI_MODEL_API_KEY",
} as const;

/** Reads adapter config from the environment. Missing values are an error, not a mock fallback. */
export function openAICompatibleConfigFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): OpenAICompatibleAdapterConfig {
  const baseUrl = env[MODEL_ENV.baseUrl]?.trim();
  const model = env[MODEL_ENV.model]?.trim();
  const missing = [
    ...(baseUrl ? [] : [MODEL_ENV.baseUrl]),
    ...(model ? [] : [MODEL_ENV.model]),
  ];
  if (!baseUrl || !model) {
    throw new ModelConfigurationError(
      `Model is not configured: set ${missing.join(" and ")}. There is no automatic fallback.`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ModelConfigurationError(`${MODEL_ENV.baseUrl} is not a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ModelConfigurationError(`${MODEL_ENV.baseUrl} must use http or https.`);
  }
  const apiKey = env[MODEL_ENV.apiKey]?.trim();
  return { baseUrl, model, ...(apiKey ? { apiKey } : {}) };
}

interface RenderedRequestShape {
  messages: { role: string; content: string }[];
  response_format: { name: string; schema: Record<string, unknown> };
  generation: { temperature: number; max_output_tokens: number };
}

function isRenderedRequest(value: unknown): value is RenderedRequestShape {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const rf = v["response_format"];
  const gen = v["generation"];
  return (
    Array.isArray(v["messages"]) &&
    rf !== null &&
    typeof rf === "object" &&
    gen !== null &&
    typeof gen === "object"
  );
}

export function createOpenAICompatibleAdapter(
  config: OpenAICompatibleAdapterConfig,
): ExtractionAdapter {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    descriptor: {
      adapter_id: "openai-compatible-chat@1",
      model_ref: config.model,
      mock: false,
    },
    async generate(request: unknown): Promise<AdapterResponse> {
      if (!isRenderedRequest(request)) throw new Error("unsupported request");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 120_000);
      try {
        const res = await fetchImpl(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: request.messages,
            temperature: request.generation.temperature,
            max_tokens: request.generation.max_output_tokens,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: request.response_format.name,
                strict: true,
                schema: request.response_format.schema,
              },
            },
          }),
        });
        if (!res.ok) throw new Error(`model server returned HTTP ${res.status}`);
        const text = await readBodyWithLimit(res, config.maxResponseBytes ?? MAX_MODEL_RESPONSE_BYTES);
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error("bad response");
        }
        return parseChatCompletion(body);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function parseChatCompletion(body: unknown): AdapterResponse {
  if (body === null || typeof body !== "object") throw new Error("bad response");
  const choices = (body as Record<string, unknown>)["choices"];
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("no choices");
  const choice: unknown = choices[0];
  if (choice === null || typeof choice !== "object") throw new Error("bad choice");
  const c = choice as Record<string, unknown>;
  const message = c["message"];
  if (message === null || typeof message !== "object") throw new Error("no message");
  const m = message as Record<string, unknown>;
  const refusal = m["refusal"];
  const content = m["content"];
  let finishReason: FinishReason;
  if ((typeof refusal === "string" && refusal.length > 0) || c["finish_reason"] === "content_filter") {
    finishReason = "refusal";
  } else if (c["finish_reason"] === "length") {
    finishReason = "length";
  } else if (c["finish_reason"] === "stop") {
    finishReason = "stop";
  } else {
    throw new Error("unsupported finish reason");
  }
  const usage = (body as Record<string, unknown>)["usage"];
  const u = usage !== null && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  const count = (n: unknown) =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : undefined;
  const inputTokens = count(u["prompt_tokens"]);
  const outputTokens = count(u["completion_tokens"]);
  return {
    outputText: typeof content === "string" ? content : "",
    finishReason,
    ...(inputTokens !== undefined || outputTokens !== undefined
      ? {
          usage: {
            ...(inputTokens !== undefined ? { inputTokens } : {}),
            ...(outputTokens !== undefined ? { outputTokens } : {}),
          },
        }
      : {}),
  };
}
