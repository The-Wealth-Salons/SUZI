import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { careerInput, source } from "./fixtures/builders.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const RUNNER = join(ROOT, "examples", "resource-extract", "run.ts");
const NO_NETWORK = join(ROOT, "tests", "resource-extract", "fixtures", "no-network.mjs");
const EXPECTED: unknown = JSON.parse(
  readFileSync(join(ROOT, "examples", "resource-extract", "expected-output.json"), "utf8"),
);

const tmp = mkdtempSync(join(tmpdir(), "suzi-example-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Environment with no model configuration and no proxies; network calls throw. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("SUZI_") || /proxy/i.test(k) || k === "NODE_OPTIONS") continue;
    env[k] = v;
  }
  env["NODE_OPTIONS"] = `--import=${NO_NETWORK}`;
  return env;
}

function runExample(args: string[], cwd = tmp) {
  // Run from an unrelated cwd to prove the default input resolves relative to the runner.
  return spawnSync(process.execPath, [TSX_CLI, RUNNER, ...args], {
    cwd,
    env: cleanEnv(),
    encoding: "utf8",
    timeout: 60_000,
  });
}

function writeTemp(name: string, content: string): string {
  const path = join(tmp, name);
  writeFileSync(path, content);
  return path;
}

describe("offline MOCK example (spawned subprocess, no model, no network)", () => {
  it("npm run example: exits 0 and prints exactly the expected JSON on stdout", () => {
    const res = spawnSync("npm", ["run", "--silent", "example"], {
      cwd: ROOT,
      env: cleanEnv(),
      encoding: "utf8",
      timeout: 90_000,
    });
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout)).toEqual(EXPECTED);
    expect(res.stdout).not.toMatch(/WARNING/);
    expect(res.stderr).toMatch(/MOCK MODE, NO MODEL/);
  });

  it("default input works from an unrelated cwd and preserves the qualified cost", () => {
    const res = runExample(["--adapter", "mock"]);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout) as { data: { claims: { field: string; value: string }[] } };
    expect(out).toEqual(EXPECTED);
    const costs = out.data.claims.filter((c) => c.field === "cost").map((c) => c.value);
    expect(costs).toEqual(["Initial consultations are free.", "Follow-up appointments cost $50."]);
    expect(res.stderr).toMatch(/MOCK MODE, NO MODEL/);
  });

  it("accepts an explicit --input file", () => {
    const path = writeTemp("explicit.json", readFileSync(join(ROOT, "examples", "resource-extract", "input.json"), "utf8"));
    const res = runExample(["--adapter", "mock", "--input", path]);
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout)).toEqual(EXPECTED);
  });

  it("missing file exits 2 with a bounded message and empty stdout", () => {
    const res = runExample(["--adapter", "mock", "--input", join(tmp, "nope.json")]);
    expect(res.status).toBe(2);
    expect(res.stdout).toBe("");
    expect(res.stderr).toMatch(/file not found/);
    expect(res.stderr).not.toMatch(/\n\s+at /);
  });

  it("malformed JSON exits 2 without echoing the input", () => {
    const path = writeTemp("bad.json", '{"secret_like": "sk-abc123", ');
    const res = runExample(["--adapter", "mock", "--input", path]);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/not valid JSON/);
    expect(res.stderr + res.stdout).not.toContain("sk-abc123");
  });

  it("wrong digest exits 1 with INVALID_INPUT", () => {
    const input = JSON.parse(readFileSync(join(ROOT, "examples", "resource-extract", "input.json"), "utf8")) as {
      evidence: { content_sha256: string }[];
    };
    const first = input.evidence[0];
    if (first) first.content_sha256 = "0".repeat(64);
    const res = runExample(["--adapter", "mock", "--input", writeTemp("digest.json", JSON.stringify(input))]);
    expect(res.status).toBe(1);
    expect(JSON.parse(res.stdout)).toEqual({ status: "failed", error: { code: "INVALID_INPUT" } });
  });

  it("changed evidence fails quote validation instead of returning canned claims", () => {
    const changed = careerInput({
      evidence: [source("ev-0001", [{ block_id: "b1", text: "Sample Job Hub. Every visit costs $20." }])],
    });
    const res = runExample(["--adapter", "mock", "--input", writeTemp("changed.json", JSON.stringify(changed))]);
    expect(res.status).toBe(1);
    expect(JSON.parse(res.stdout)).toEqual({ status: "failed", error: { code: "EVIDENCE_QUOTE_INVALID" } });
    expect(res.stdout + res.stderr).not.toContain("Sample Job Hub");
  });

  it("unsupported evidence (no requested-field coverage) exits nonzero", () => {
    const changed = careerInput({
      requested_fields: ["languages"],
      evidence: [source("ev-0001", [{ block_id: "b1", text: "Example Career Center. Initial consultations are free. Follow-up appointments cost $50." }])],
    });
    const res = runExample(["--adapter", "mock", "--input", writeTemp("fields.json", JSON.stringify(changed))]);
    expect(res.status).toBe(1);
    expect(JSON.parse(res.stdout)).toEqual({ status: "failed", error: { code: "FIELD_COVERAGE_INVALID" } });
  });

  it("requires an explicit adapter and never falls back to mock", () => {
    const none = runExample([]);
    expect(none.status).toBe(2);
    expect(none.stderr).toMatch(/--adapter is required/);
    const real = runExample(["--adapter", "openai-compatible"]);
    expect(real.status).toBe(2);
    expect(real.stdout).toBe("");
    expect(real.stderr).toMatch(/SUZI_MODEL_BASE_URL/);
    expect(real.stderr).not.toMatch(/MOCK MODE/);
  });
});
