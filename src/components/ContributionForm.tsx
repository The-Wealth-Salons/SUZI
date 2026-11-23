import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { contributionSchema } from "@/lib/contribution-schema";
import { submitContribution } from "@/lib/contributions.functions";
import { trackConversion } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Kind = "suggest_source" | "offer_dataset" | "share_idea";
const KINDS: { id: Kind; label: string }[] = [
  { id: "suggest_source", label: "Suggest a source" },
  { id: "offer_dataset", label: "Offer a dataset" },
  { id: "share_idea", label: "Share an idea" },
];

export function ContributionForm({ submit, available = false }: { submit?: (d: unknown) => Promise<{ ok: boolean; id?: string; error?: string }>; available?: boolean }) {
  const serverSubmit = useServerFn(submitContribution);
  const send: (d: unknown) => Promise<{ ok: boolean; id?: string; error?: string }> =
    submit ?? ((d: unknown) => serverSubmit({ data: d as never }));
  const [kind, setKind] = useState<Kind>("suggest_source");
  const [sourceUrl, setSourceUrl] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!available) return;
    const payload = { kind, sourceUrl, body, email, permission, website };
    const parsed = contributionSchema.safeParse(payload);
    if (!parsed.success) {
      setStatus("error");
      setMessage(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setStatus("sending");
    try {
      const res = await send(parsed.data);
      if (res.ok && res.id) {
        trackConversion(res.id, kind);
        setStatus("done");
      } else {
        setStatus("error");
        setMessage(res.error ?? "We couldn't save this. Please try again later.");
      }
    } catch {
      setStatus("error");
      setMessage("We couldn't save this. Please try again later.");
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="space-y-2">
        <h3 className="text-2xl">Thank you. Your note is saved.</h3>
        <p className="text-sm text-muted-foreground">A person reviews every contribution. If you left an email and permission, we may follow up; there is no automated reply yet.</p>
      </div>
    );
  }

  const emailRequired = kind === "offer_dataset";
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-2">
        <legend className="eyebrow mb-2">How would you like to help?</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
          {KINDS.map((k) => (
            <label key={k.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="accent-forest" />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "suggest_source" && (
        <div className="space-y-2">
          <Label htmlFor="sourceUrl">Public dataset link</Label>
          <Input id="sourceUrl" type="url" inputMode="url" placeholder="https://" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} maxLength={500} required />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="body">
          {kind === "suggest_source" ? "Why it matters (optional)" : kind === "offer_dataset" ? "Describe the dataset" : "Your idea"}
        </Label>
        <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={kind === "offer_dataset" ? 2000 : 1000} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email {emailRequired ? "(required)" : "(optional)"}</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} required={emailRequired} />
      </div>
      {(email || emailRequired) && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} className="mt-1 accent-forest" required />
          <span>SUZI may contact me at this email about this contribution only. No mailing list.</span>
        </label>
      )}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" /></label>
      </div>

      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Please share no sensitive, personal, or confidential information.</li>
        <li>Submitting does not grant training rights. Rights are reviewed before any dataset is used.</li>
        <li>No file uploads yet — links and descriptions only.</li>
      </ul>

      {!available && (
        <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          Contributions are temporarily unavailable. Nothing you type here is sent or stored.
        </p>
      )}
      {status === "error" && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <Button type="submit" disabled={!available || status === "sending"}>{status === "sending" ? "Saving…" : "Send contribution"}</Button>
    </form>
  );
}
