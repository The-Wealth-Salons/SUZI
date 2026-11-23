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
    // Terminate the body before rejecting: it may never end on its own, and
    // the caller has already given up on this response.
    await res.body?.cancel().catch(() => undefined);
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

/**
 * The transport policy every configuration path enforces: the base URL
 * must be a valid http(s) URL, and plain http is only acceptable for a
 * loopback host — evidence and the optional bearer token would otherwise
 * cross the network in cleartext. Plain HTTP is only acceptable for a
 * model server on this same host (the documented self-hosted setup).
 * `label` names the value in error messages (the env var on the env path).
 */
function assertSafeModelBaseUrl(baseUrl: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ModelConfigurationError(`${label} is not a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ModelConfigurationError(`${label} must use http or https.`);
  }
  if (parsed.protocol === "http:" && !isLoopbackHost(parsed.hostname)) {
    throw new ModelConfigurationError(
      `${label} uses http for a non-loopback host; use https so evidence and credentials are not sent in cleartext.`,
    );
  }
}

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
  assertSafeModelBaseUrl(baseUrl, MODEL_ENV.baseUrl);
  const apiKey = env[MODEL_ENV.apiKey]?.trim();
  return { baseUrl, model, ...(apiKey ? { apiKey } : {}) };
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * Build the chat-completions endpoint from the configured base URL. The
 * path segment is appended to the URL path, so a query string in the base
 * URL (for example an api-version parameter) stays a query string instead
 * of swallowing the route.
 */
function chatCompletionsEndpoint(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/chat/completions`;
    return url.toString();
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  }
}

/**
 * The provider-facing strict schema is a subset of the contract schema:
 * the top-level `allOf` outcome conditionals use keywords strict
 * Structured-Outputs grammars do not support, and a strict endpoint can
 * reject the whole request before inference. Those conditionals stay
 * enforced after parsing by the full AJV validation and the service's
 * outcome checks; everything else is sent unchanged.
 */
function providerStrictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  delete copy["allOf"];
  return copy;
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
  // Enforce the same transport policy as the env-config path before
  // snapshotting: direct callers must not be able to send evidence and
  // the optional bearer token over cleartext http to a remote host.
  assertSafeModelBaseUrl(config.baseUrl, "baseUrl");
  // Snapshot the configuration at construction. The caller keeps ownership
  // of the object it passed in; if it mutates or reuses that object later,
  // the request must still go to the model the descriptor (and therefore
  // the receipt) names, with the credentials and limits captured here.
  const snapshot = {
    baseUrl: config.baseUrl,
    model: config.model,
    ...(config.apiKey !== undefined ? { apiKey: config.apiKey } : {}),
    timeoutMs: config.timeoutMs ?? 120_000,
    maxResponseBytes: config.maxResponseBytes ?? MAX_MODEL_RESPONSE_BYTES,
    fetchImpl: config.fetchImpl ?? fetch,
  };
  const endpoint = chatCompletionsEndpoint(snapshot.baseUrl);
  return {
    descriptor: {
      adapter_id: "openai-compatible-chat@1",
      model_ref: snapshot.model,
      mock: false,
    },
    async generate(request: unknown): Promise<AdapterResponse> {
      if (!isRenderedRequest(request)) throw new Error("unsupported request");
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, snapshot.timeoutMs);
      let completed = false;
      try {
        const res = await snapshot.fetchImpl(endpoint, {
          method: "POST",
          signal: controller.signal,
          // Never follow redirects: a compromised or misconfigured model
          // server must not be able to send evidence and credentials to a
          // destination the operator never configured. A 3xx is not ok
          // and fails below like any other non-2xx response.
          redirect: "manual",
          headers: {
            "content-type": "application/json",
            ...(snapshot.apiKey ? { authorization: `Bearer ${snapshot.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: snapshot.model,
            messages: request.messages,
            temperature: request.generation.temperature,
            max_tokens: request.generation.max_output_tokens,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: request.response_format.name,
                strict: true,
                schema: providerStrictSchema(request.response_format.schema),
              },
            },
          }),
        });
        if (!res.ok) {
          // Release the connection before failing: an error body may be
          // never-ending, and this adapter will not read it.
          await res.body?.cancel().catch(() => undefined);
          throw new Error(`model server returned HTTP ${res.status}`);
        }
        const text = await readBodyWithLimit(res, snapshot.maxResponseBytes);
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error("bad response");
        }
        const parsed = parseChatCompletion(body);
        completed = true;
        return parsed;
      } finally {
        clearTimeout(timer);
        // On every failure path, terminate the request so an erroneous or
        // compromised server cannot retain the connection after the failure
        // has already been reported.
        if (!completed) controller.abort();
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
