/**
 * resource.extract.v1 runner.
 *
 *   npm run --silent example                       # offline MOCK demo, bundled input
 *   npm run --silent example -- --input my.json    # MOCK demo, your input file
 *   npm run --silent extract -- --adapter openai-compatible --input my.json
 *                                                  # real small model (needs SUZI_MODEL_* env)
 *
 * stdout: exactly one JSON result (safe to redirect). stderr: warnings/errors.
 * Exit codes: 0 ok or valid abstention; 1 extraction failed (status "failed");
 * 2 usage, file, JSON or model-configuration error; 3 unexpected runner error.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  createMockAdapter,
  createOpenAICompatibleAdapter,
  createResourceExtractionService,
  ModelConfigurationError,
  openAICompatibleConfigFromEnv,
} from "../../src/tasks/resource-extract/index.js";
import type { ExtractionAdapter } from "../../src/tasks/resource-extract/index.js";

const HERE = new URL("./", import.meta.url);
const DEFAULT_INPUT = fileURLToPath(new URL("input.json", HERE));
const MOCK_OUTPUT = fileURLToPath(new URL("mock-model-output.json", HERE));

const USAGE = `usage: run.ts --adapter <mock|openai-compatible> [--input <path>]
  --adapter mock               offline MOCK: canned response, no model, no network
  --adapter openai-compatible  self-hosted small model; requires SUZI_MODEL_BASE_URL and SUZI_MODEL_ID
  --input <path>               input JSON (default: examples/resource-extract/input.json)`;

class UsageError extends Error {}

function readJsonFile(path: string, label: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown";
    throw new UsageError(`cannot read ${label} (${code === "ENOENT" ? "file not found" : code})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new UsageError(`${label} is not valid JSON`);
  }
}

function buildAdapter(kind: string | undefined): ExtractionAdapter {
  if (kind === "mock") {
    process.stderr.write(
      "WARNING: MOCK MODE, NO MODEL. The adapter returns a canned response written for the bundled example evidence. " +
        "This demonstrates the offline workflow and real validation; it is not inference and says nothing about model accuracy.\n",
    );
    const canned = readFileSync(MOCK_OUTPUT, "utf8");
    return createMockAdapter({ cannedOutputText: canned });
  }
  if (kind === "openai-compatible") {
    return createOpenAICompatibleAdapter(openAICompatibleConfigFromEnv(process.env));
  }
  throw new UsageError(
    kind === undefined ? "--adapter is required (no default model)" : "unknown --adapter value",
  );
}

async function main(): Promise<number> {
  let values: { adapter?: string | undefined; input?: string | undefined; help?: boolean | undefined };
  try {
    ({ values } = parseArgs({
      options: {
        adapter: { type: "string" },
        input: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch {
    throw new UsageError("unrecognized arguments");
  }
  if (values.help) {
    process.stderr.write(`${USAGE}\n`);
    return 0;
  }
  const adapter = buildAdapter(values.adapter);
  const input = readJsonFile(values.input ?? DEFAULT_INPUT, "input file");
  const service = createResourceExtractionService({ adapter });
  const result = await service.execute(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "failed") {
    process.stderr.write(
      `error: extraction failed with ${result.error.code}. See examples/resource-extract/README.md for what each code means.\n`,
    );
    return 1;
  }
  if (result.status === "abstained") {
    process.stderr.write(`note: the task abstained (${result.reason}); this is a valid outcome.\n`);
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    if (error instanceof UsageError || error instanceof ModelConfigurationError) {
      process.stderr.write(`error: ${error.message}\n${USAGE}\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write("error: unexpected runner failure (details withheld)\n");
    process.exitCode = 3;
  },
);
