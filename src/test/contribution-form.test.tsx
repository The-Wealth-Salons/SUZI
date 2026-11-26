import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(), createServerFn: () => ({ inputValidator: () => ({ handler: () => vi.fn() }) }) }));
vi.mock("@/lib/contributions.functions", () => ({ submitContribution: vi.fn(), getContributionAvailability: vi.fn() }));
const trackConversion = vi.fn();
vi.mock("@/lib/analytics", () => ({ trackConversion: (...a: unknown[]) => trackConversion(...a) }));

import { contributionSchema } from "@/lib/contribution-schema";
import { ContributionForm } from "@/components/ContributionForm";

describe("contribution schema", () => {
  it("requires email for dataset offers", () => {
    expect(contributionSchema.safeParse({ kind: "offer_dataset", body: "A survey of 200 households", email: "", permission: false }).success).toBe(false);
  });
  it("requires permission when an email is given", () => {
    expect(contributionSchema.safeParse({ kind: "share_idea", body: "idea", email: "a@b.co", permission: false }).success).toBe(false);
    expect(contributionSchema.safeParse({ kind: "share_idea", body: "idea", email: "a@b.co", permission: true }).success).toBe(true);
  });
  it("rejects honeypot and non-https sources", () => {
    expect(contributionSchema.safeParse({ kind: "share_idea", body: "idea", permission: false, website: "spam" }).success).toBe(false);
    expect(contributionSchema.safeParse({ kind: "suggest_source", sourceUrl: "javascript:alert(1)", permission: false }).success).toBe(false);
  });
});

function fillIdea() {
  fireEvent.click(screen.getByLabelText("Share an idea"));
  fireEvent.change(screen.getByLabelText("Your idea"), { target: { value: "Translate local dialects" } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
}

describe("contribution form", () => {
  it("shows success and one conversion only after a durable write", async () => {
    trackConversion.mockClear();
    render(<ContributionForm available submit={async () => ({ ok: true, id: "row-1" })} />);
    fillIdea();
    await screen.findByText(/your note is saved/i);
    expect(trackConversion).toHaveBeenCalledTimes(1);
    expect(trackConversion).toHaveBeenCalledWith("row-1", "share_idea");
  });

  it("fails closed with no conversion when the write fails", async () => {
    trackConversion.mockClear();
    render(<ContributionForm available submit={async () => ({ ok: false, error: "We couldn't save this right now." })} />);
    fillIdea();
    await screen.findByRole("alert");
    expect(screen.queryByText(/saved/i)).toBeNull();
    expect(trackConversion).not.toHaveBeenCalled();
  });

  it("fails closed when the request throws", async () => {
    trackConversion.mockClear();
    render(<ContributionForm available submit={async () => { throw new Error("net"); }} />);
    fillIdea();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(trackConversion).not.toHaveBeenCalled();
  });

  it("shows unavailable state and never submits when external DB is not ready", () => {
    const submit = vi.fn();
    render(<ContributionForm submit={submit} />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    fillIdea();
    expect(submit).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /send/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
