import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase-external/proposed");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));

describe("proposed external SUZI migrations", () => {
  it("exist", () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    it(`${f} is labelled UNAPPLIED/PROPOSED`, () => {
      expect(sql.split("\n")[0]).toMatch(/UNAPPLIED \/ PROPOSED/);
      expect(sql).toMatch(/DO NOT EXECUTE/);
    });
    it(`${f} has no stray shell markers`, () => {
      expect(sql).not.toMatch(/<<\s*'?EOF|^\s*EOF\d*\s*$|\bcat\s+</m);
      expect(sql).not.toMatch(/^\s*(\$ |#!|```)/m);
    });
    it(`${f} revokes public execute on security definer functions`, () => {
      if (/SECURITY DEFINER/.test(sql)) expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION[\s\S]*FROM PUBLIC, anon/);
    });
  }
});
