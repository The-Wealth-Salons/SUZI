import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy (draft) — SUZI" },
      { name: "description", content: "Draft privacy notice for suzilabs.com: what SUZI collects, why, and your choices." },
      { property: "og:title", content: "Privacy (draft) — SUZI" },
      { property: "og:description", content: "What suzilabs.com collects and your choices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-6 py-20 leading-relaxed sm:px-10">
      <p className="eyebrow">Draft · not yet reviewed by counsel</p>
      <h1 className="text-5xl">Privacy</h1>
      <h2 className="pt-4 text-2xl">What we collect</h2>
      <p className="text-muted-foreground">Only what you choose to send through the pinq contribution form: the option you picked, a public link or note, and an email if you give one with permission to contact you. Please don't include sensitive or confidential information.</p>
      <h2 className="pt-4 text-2xl">How it is used</h2>
      <p className="text-muted-foreground">A small SUZI team reviews contributions. Sending a link or dataset description does not grant SUZI any rights to train on it; rights are reviewed before any use. We do not add you to a mailing list.</p>
      <h2 className="pt-4 text-2xl">Analytics</h2>
      <p className="text-muted-foreground">No analytics scripts load unless you opt in. If you do, we use Amplitude and Google Analytics to count page views and button clicks. We never send your email, notes, dataset links, or form content to them. You can revoke at any time from “Analytics settings” in the footer.</p>
      <h2 className="pt-4 text-2xl">Abuse prevention</h2>
      <p className="text-muted-foreground">To limit spam, we store a one-way, daily-rotating hash of your network address for one hour's worth of rate limiting. We don't store the address itself.</p>
      <h2 className="pt-4 text-2xl">Your choices</h2>
      <p className="text-muted-foreground">You may ask us to delete a contribution. A contact address for privacy requests will be published before launch.</p>
    </article>
  );
}
