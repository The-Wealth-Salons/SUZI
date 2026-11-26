import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { contributionSchema } from "./contribution-schema";

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

// Public: returns only a boolean, never config or secrets.
export const getContributionAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { getExternalSuziStatus } = await import("./external-suzi-supabase.server");
  return { available: getExternalSuziStatus(process.env).state === "ready" };
});

export const submitContribution = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const parsed = contributionSchema.safeParse(input);
    if (!parsed.success) throw new Error("Please check the form and try again.");
    return parsed.data;
  })
  .handler(async ({ data }): Promise<SubmitResult> => {
    // External SUZI Supabase ONLY. No Lovable Cloud fallback. Never log content.
    const { getExternalSuziClient } = await import("./external-suzi-supabase.server");
    const { persistContribution } = await import("./contributions.server");
    const db = await getExternalSuziClient(process.env);
    if (!db) return persistContribution(null, data, "");
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0] || "unknown";
    const day = new Date().toISOString().slice(0, 10);
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`suzi:${day}:${ip}`));
    const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return persistContribution(db, data, hash);
  });
