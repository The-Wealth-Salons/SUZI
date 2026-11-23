import { describe, expect, it, vi, afterEach } from "vitest";
import { getExternalSuziStatus, getExternalSuziClient } from "@/lib/external-suzi-supabase.server";
import { persistContribution, UNAVAILABLE } from "@/lib/contributions.server";

const GOOD = {
  SUZI_EXTERNAL_WRITES_ENABLED: "true",
  SUZI_SUPABASE_URL: "https://suumaiswxijllkkuybnz.supabase.co",
  SUZI_SUPABASE_SERVICE_ROLE_KEY: "test-only-mock",
};
const idea = { kind: "share_idea" as const, body: "idea", email: "", permission: false };

afterEach(() => vi.unstubAllGlobals());

describe("external SUZI adapter", () => {
  it("is disabled unless owner explicitly enables writes", () => {
    expect(getExternalSuziStatus({ ...GOOD, SUZI_EXTERNAL_WRITES_ENABLED: undefined }).state).toBe("disabled");
  });
  it("is unconfigured when url or key is missing", () => {
    expect(getExternalSuziStatus({ ...GOOD, SUZI_SUPABASE_SERVICE_ROLE_KEY: undefined }).state).toBe("unconfigured");
    expect(getExternalSuziStatus({ ...GOOD, SUZI_SUPABASE_URL: undefined }).state).toBe("unconfigured");
  });
  it("rejects the Lovable-managed project and any other ref", () => {
    expect(getExternalSuziStatus({ ...GOOD, SUZI_SUPABASE_URL: "https://acjsdlmklfypjgsizdqo.supabase.co" }).state).toBe("wrong_project");
    expect(getExternalSuziStatus({ ...GOOD, SUZI_SUPABASE_URL: "https://suumaiswxijllkkuybnz.supabase.co.evil.com" }).state).toBe("wrong_project");
    expect(getExternalSuziStatus({ ...GOOD, SUZI_SUPABASE_URL: "http://suumaiswxijllkkuybnz.supabase.co" }).state).toBe("invalid_url");
  });
  it("ignores Lovable Cloud env vars entirely (no fallback)", () => {
    expect(getExternalSuziStatus({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }).state).toBe("disabled");
  });
  it("is ready only for the approved ref", () => {
    expect(getExternalSuziStatus(GOOD)).toEqual({ state: "ready", projectRef: "suumaiswxijllkkuybnz" });
  });
  it("creates no client and makes no network call when not ready", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const factory = vi.fn();
    expect(await getExternalSuziClient({}, factory)).toBeNull();
    expect(factory).not.toHaveBeenCalled();
    expect(await persistContribution(null, idea, "h")).toEqual({ ok: false, error: UNAVAILABLE });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("writes through the mocked external client only when ready", async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: "r1" }, error: null }) }) }));
    const db = {
      from: (t: string) =>
        t === "submission_rate_limits"
          ? { select: () => ({ eq: () => ({ gte: async () => ({ count: 0, error: null }) }) }), insert: async () => ({}) }
          : { insert },
    };
    const client = await getExternalSuziClient(GOOD, () => db as never);
    expect(await persistContribution(client, idea, "h")).toEqual({ ok: true, id: "r1" });
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
