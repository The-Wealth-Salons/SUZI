import { z } from "zod";

const email = z.string().trim().email("Enter a valid email").max(255);
const optionalEmail = z.union([z.literal(""), email]).optional();
const permission = z.boolean();
const honeypot = z.string().max(0, "Invalid submission").optional();

export const contributionSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("suggest_source"),
      sourceUrl: z.string().trim().url("Enter a public link").max(500).refine((u) => /^https:\/\//i.test(u), "Use an https link"),
      body: z.string().trim().max(1000).optional(),
      email: optionalEmail,
      permission,
      website: honeypot,
    }),
    z.object({
      kind: z.literal("offer_dataset"),
      body: z.string().trim().min(10, "Briefly describe the dataset").max(2000),
      email,
      permission,
      website: honeypot,
    }),
    z.object({
      kind: z.literal("share_idea"),
      body: z.string().trim().min(3, "Add a short note").max(1000),
      email: optionalEmail,
      permission,
      website: honeypot,
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.email && !v.permission) {
      ctx.addIssue({ code: "custom", path: ["permission"], message: "Please confirm we may contact you at this email" });
    }
  });

export type ContributionInput = z.infer<typeof contributionSchema>;
