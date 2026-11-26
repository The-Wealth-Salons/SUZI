import { describe, expect, it, vi } from "vitest";
import { persistContribution } from "@/lib/contributions.server";

const idea = { kind: "share_idea" as const, body: "idea", email: "", permission: false };

function fakeDb(rpcImpl: () => Promise<{ data: unknown; error: unknown }>) {
  const insert = vi.fn(() => ({
    select: () => ({ single: async () => ({ data: { id: "r1" }, error: null }) }),
  }));
  const rpc = vi.fn(rpcImpl);
  const db = { rpc, from: () => ({ insert }) };
  return { db: db as never, insert, rpc };
}

describe("persistContribution rate-limit reservation", () => {
  it("fails closed when the reservation errors: no contribution is written", async () => {
    const { db, insert } = fakeDb(async () => ({ data: null, error: { code: "XX000" } }));
    const res = await persistContribution(db, idea, "h");
    expect(res.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects without writing when the atomic reservation is denied", async () => {
    const { db, insert } = fakeDb(async () => ({ data: false, error: null }));
    const res = await persistContribution(db, idea, "h");
    expect(res).toEqual({ ok: false, error: "Too many submissions. Please try again in an hour." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("admits at most the hourly limit under concurrent submissions", async () => {
    // The fake rpc models the database function: the count-and-insert is
    // atomic (synchronous here, advisory-locked in Postgres), so exactly
    // five of eight simultaneous callers can reserve a slot.
    let reserved = 0;
    const { db, insert, rpc } = fakeDb(async () => {
      reserved += 1;
      return { data: reserved <= 5, error: null };
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => persistContribution(db, idea, "h")),
    );
    expect(rpc).toHaveBeenCalledTimes(8);
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok)).toHaveLength(3);
    expect(insert).toHaveBeenCalledTimes(5);
  });

  it("passes the client hash, limit and window to the atomic reservation", async () => {
    const { db, rpc } = fakeDb(async () => ({ data: true, error: null }));
    expect(await persistContribution(db, idea, "hash-1")).toEqual({ ok: true, id: "r1" });
    expect(rpc).toHaveBeenCalledWith("reserve_submission_slot", {
      _client_hash: "hash-1",
      _limit: 5,
      _window_seconds: 3600,
    });
  });
});
