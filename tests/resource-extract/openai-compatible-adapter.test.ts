import { describe, expect, it } from "vitest";
import {
  createOpenAICompatibleAdapter,
  createResourceExtractionService,
  ModelConfigurationError,
  openAICompatibleConfigFromEnv,
} from "../../src/tasks/resource-extract/index.js";
import { careerInput, careerOutput } from "./fixtures/builders.js";

type FetchArgs = Parameters<typeof fetch>;

function fakeFetch(body: unknown, status = 200) {
  const calls: FetchArgs[] = [];
  const impl = (async (...args: FetchArgs) => {
    calls.push(args);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

const completion = (content: string, finish_reason = "stop", extra: Record<string, unknown> = {}) => ({
  choices: [{ message: { role: "assistant", content, ...extra }, finish_reason }],
  usage: { prompt_tokens: 812, completion_tokens: 240 },
});

describe("OpenAI-compatible small-model adapter (no network: fetch is injected)", () => {
  it("sends one structured-output request and the service validates the reply", async () => {
    const { impl, calls } = fakeFetch(completion(JSON.stringify(careerOutput())));
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: "http://127.0.0.1:8080/v1/",
      model: "microsoft/Phi-4-mini-instruct@Q4_K_M",
      fetchImpl: impl,
    });
    const result = await createResourceExtractionService({ adapter }).execute(careerInput());
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.receipt.adapter).toEqual({
        adapter_id: "openai-compatible-chat@1",
        model_ref: "microsoft/Phi-4-mini-instruct@Q4_K_M",
        mock: false,
      });
      expect(result.data.receipt.usage).toEqual({ input_tokens: 812, output_tokens: 240 });
    }
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0] ?? [];
    expect(String(url)).toBe("http://127.0.0.1:8080/v1/chat/completions");
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(sent["model"]).toBe("microsoft/Phi-4-mini-instruct@Q4_K_M");
    expect(sent["temperature"]).toBe(0);
    expect((sent["response_format"] as Record<string, unknown>)["type"]).toBe("json_schema");
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
  });

  it("maps length, content_filter and refusal finish states", async () => {
    const cases: [unknown, string][] = [
      [completion("{", "length"), "MODEL_OUTPUT_TRUNCATED"],
      [completion("", "content_filter"), "MODEL_REFUSAL"],
      [completion("", "stop", { refusal: "I can't do that" }), "MODEL_REFUSAL"],
    ];
    for (const [body, expected] of cases) {
      const adapter = createOpenAICompatibleAdapter({ baseUrl: "http://x/v1", model: "m", fetchImpl: fakeFetch(body).impl });
      const result = await createResourceExtractionService({ adapter }).execute(careerInput());
      expect(result).toEqual({ status: "failed", error: { code: expected } });
    }
  });

  it("maps HTTP errors and malformed bodies to MODEL_UNAVAILABLE", async () => {
    for (const fetcher of [fakeFetch({ error: "boom" }, 500), fakeFetch({ nope: true })]) {
      const adapter = createOpenAICompatibleAdapter({ baseUrl: "http://x/v1", model: "m", fetchImpl: fetcher.impl });
      const result = await createResourceExtractionService({ adapter }).execute(careerInput());
      expect(result).toEqual({ status: "failed", error: { code: "MODEL_UNAVAILABLE" } });
    }
  });

  it("rejects an oversized streamed response with no Content-Length, in one call, leaking nothing", async () => {
    const filler = "A".repeat(512);
    let calls = 0;
    const impl = (async () => {
      calls += 1;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new TextEncoder().encode(filler));
        },
      });
      // No content-length header: the limit must be enforced on streamed bytes.
      return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: "http://x/v1",
      model: "m",
      fetchImpl: impl,
      maxResponseBytes: 1024,
    });
    const result = await createResourceExtractionService({ adapter }).execute(careerInput());
    expect(result).toEqual({ status: "failed", error: { code: "MODEL_UNAVAILABLE" } });
    expect(calls).toBe(1);
    expect(JSON.stringify(result)).not.toContain("AAAA");
  });

  it("rejects a response whose declared Content-Length exceeds the limit", async () => {
    const impl = (async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "2049" },
      })) as unknown as typeof fetch;
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: "http://x/v1",
      model: "m",
      fetchImpl: impl,
      maxResponseBytes: 1024,
    });
    await expect(
      adapter.generate({
        messages: [{ role: "user", content: "x" }],
        response_format: { name: "out", schema: {} },
        generation: { temperature: 0, max_output_tokens: 16 },
      }),
    ).rejects.toThrow("model response too large");
  });

  it("cancels an unfinished body when the declared Content-Length exceeds the limit", async () => {
    let cancelled = false;
    const impl = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{}"));
          // The stream is never closed: only cancellation releases it.
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "2049" },
      });
    }) as unknown as typeof fetch;
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: "http://x/v1",
      model: "m",
      fetchImpl: impl,
      maxResponseBytes: 1024,
    });
    await expect(
      adapter.generate({
        messages: [{ role: "user", content: "x" }],
        response_format: { name: "out", schema: {} },
        generation: { temperature: 0, max_output_tokens: 16 },
      }),
    ).rejects.toThrow("model response too large");
    expect(cancelled).toBe(true);
  });

  it("cancels a streaming error body and fails once, without retrying", async () => {
    let cancelled = false;
    let calls = 0;
    const impl = (async () => {
      calls += 1;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new TextEncoder().encode("error"));
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(stream, { status: 500, headers: { "content-type": "text/plain" } });
    }) as unknown as typeof fetch;
    const adapter = createOpenAICompatibleAdapter({ baseUrl: "http://x/v1", model: "m", fetchImpl: impl });
    const result = await createResourceExtractionService({ adapter }).execute(careerInput());
    expect(result).toEqual({ status: "failed", error: { code: "MODEL_UNAVAILABLE" } });
    expect(calls).toBe(1);
    expect(cancelled).toBe(true);
  });

  it("snapshots the configuration at construction, ignoring later caller mutation", async () => {
    const { impl, calls } = fakeFetch(completion(JSON.stringify(careerOutput())));
    const config = {
      baseUrl: "http://127.0.0.1:8080/v1",
      model: "original-model",
      apiKey: "original-key",
      fetchImpl: impl,
    };
    const adapter = createOpenAICompatibleAdapter(config);
    config.model = "mutated-model";
    config.apiKey = "mutated-key";
    config.baseUrl = "http://127.0.0.1:9999/v9";
    const result = await createResourceExtractionService({ adapter }).execute(careerInput());
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.receipt.adapter.model_ref).toBe("original-model");
    const [url, init] = calls[0] ?? [];
    expect(String(url)).toBe("http://127.0.0.1:8080/v1/chat/completions");
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(sent["model"]).toBe("original-model");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer original-key");
  });

  it("appends the chat route to the URL path when the base URL carries a query string", async () => {
    const { impl, calls } = fakeFetch(completion(JSON.stringify(careerOutput())));
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: "http://127.0.0.1:8080/v1?api-version=2024-10-21",
      model: "m",
      fetchImpl: impl,
    });
    const result = await createResourceExtractionService({ adapter }).execute(careerInput());
    expect(result.status).toBe("ok");
    expect(String(calls[0]?.[0])).toBe("http://127.0.0.1:8080/v1/chat/completions?api-version=2024-10-21");
  });

  it("does not follow redirects from the model server", async () => {
    const { impl, calls } = fakeFetch({ error: "redirect" }, 302);
    const adapter = createOpenAICompatibleAdapter({ baseUrl: "http://x/v1", model: "m", fetchImpl: impl });
    const result = await createResourceExtractionService({ adapter }).execute(careerInput());
    expect(result).toEqual({ status: "failed", error: { code: "MODEL_UNAVAILABLE" } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]?.redirect).toBe("manual");
  });

  it("sends a strict provider schema without the unsupported outcome conditionals", async () => {
    const { impl, calls } = fakeFetch(completion(JSON.stringify(careerOutput())));
    const adapter = createOpenAICompatibleAdapter({ baseUrl: "http://x/v1", model: "m", fetchImpl: impl });
    await createResourceExtractionService({ adapter }).execute(careerInput());
    const sent = JSON.parse(String(calls[0]?.[1]?.body)) as Record<string, unknown>;
    const rf = sent["response_format"] as { json_schema: { strict: boolean; schema: Record<string, unknown> } };
    expect(rf.json_schema.strict).toBe(true);
    expect(rf.json_schema.schema).not.toHaveProperty("allOf");
    expect(rf.json_schema.schema["properties"]).toHaveProperty("claims");
  });

  it("rejects a streamed body whose UTF-8 bytes exceed the limit while its string length does not", async () => {
    // "é" is one UTF-16 code unit but two UTF-8 bytes: this finite body's
    // string length stays under the cap while its encoded size exceeds it.
    const bodyText = JSON.stringify(completion("é".repeat(500)));
    expect(bodyText.length).toBeLessThan(1024);
    expect(new TextEncoder().encode(bodyText).byteLength).toBeGreaterThan(1024);
    const impl = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(bodyText));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: "http://x/v1",
      model: "m",
      fetchImpl: impl,
      maxResponseBytes: 1024,
    });
    await expect(
      adapter.generate({
        messages: [{ role: "user", content: "x" }],
        response_format: { name: "out", schema: {} },
        generation: { temperature: 0, max_output_tokens: 16 },
      }),
    ).rejects.toThrow("model response too large");
  });

  it("accepts a valid streamed response at under the byte limit", async () => {
    const bodyText = JSON.stringify(completion("ok"));
    expect(new TextEncoder().encode(bodyText).byteLength).toBeLessThan(1024);
    const impl = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(bodyText));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: "http://x/v1",
      model: "m",
      fetchImpl: impl,
      maxResponseBytes: 1024,
    });
    const response = await adapter.generate({
      messages: [{ role: "user", content: "x" }],
      response_format: { name: "out", schema: {} },
      generation: { temperature: 0, max_output_tokens: 16 },
    });
    expect(response.outputText).toBe("ok");
    expect(response.finishReason).toBe("stop");
  });

  it("sends an optional bearer token only in a header", async () => {
    const { impl, calls } = fakeFetch(completion(JSON.stringify(careerOutput())));
    const adapter = createOpenAICompatibleAdapter({ baseUrl: "http://x/v1", model: "m", apiKey: "local-test-token", fetchImpl: impl });
    await createResourceExtractionService({ adapter }).execute(careerInput());
    const [url, init] = calls[0] ?? [];
    expect(String(url)).not.toContain("local-test-token");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer local-test-token");
  });
});

describe("model configuration", () => {
  it("errors on missing configuration instead of falling back to a mock", () => {
    expect(() => openAICompatibleConfigFromEnv({})).toThrow(ModelConfigurationError);
    expect(() => openAICompatibleConfigFromEnv({ SUZI_MODEL_BASE_URL: "http://127.0.0.1:8080/v1" })).toThrow(/SUZI_MODEL_ID/);
    expect(() => openAICompatibleConfigFromEnv({ SUZI_MODEL_BASE_URL: "ftp://x", SUZI_MODEL_ID: "m" })).toThrow(ModelConfigurationError);
  });

  it("reads a complete configuration", () => {
    expect(openAICompatibleConfigFromEnv({ SUZI_MODEL_BASE_URL: "http://127.0.0.1:8080/v1", SUZI_MODEL_ID: "phi" })).toEqual({
      baseUrl: "http://127.0.0.1:8080/v1",
      model: "phi",
    });
  });

  it("rejects cleartext http for non-loopback hosts but allows loopback http and remote https", () => {
    expect(() =>
      openAICompatibleConfigFromEnv({ SUZI_MODEL_BASE_URL: "http://models.example.org:8080/v1", SUZI_MODEL_ID: "phi" }),
    ).toThrow(ModelConfigurationError);
    expect(
      openAICompatibleConfigFromEnv({ SUZI_MODEL_BASE_URL: "http://localhost:8080/v1", SUZI_MODEL_ID: "phi" }).baseUrl,
    ).toBe("http://localhost:8080/v1");
    expect(
      openAICompatibleConfigFromEnv({ SUZI_MODEL_BASE_URL: "https://models.example.org/v1", SUZI_MODEL_ID: "phi" }).baseUrl,
    ).toBe("https://models.example.org/v1");
  });
});
