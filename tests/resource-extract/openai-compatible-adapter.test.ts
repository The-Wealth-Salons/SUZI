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
});
