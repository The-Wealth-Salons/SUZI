import { createFileRoute } from "@tanstack/react-router";
import { PinqLogo } from "@/components/PinqMark";
import { ContributionForm } from "@/components/ContributionForm";
import { getContributionAvailability } from "@/lib/contributions.functions";

export const Route = createFileRoute("/pinq")({
  head: () => ({
    meta: [
      { title: "pinq — early research by SUZI" },
      { name: "description", content: "pinq is SUZI's exploratory human-intelligence research. Suggest sources, offer datasets, or share ideas." },
      { property: "og:title", content: "pinq — early research by SUZI" },
      { property: "og:description", content: "Translate community so the world can serve it properly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async () => {
    try { return await getContributionAvailability(); } catch { return { available: false }; }
  },
  component: Pinq,
});

function Pinq() {
  const { available } = Route.useLoaderData();
  return (
    <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-6 py-12 sm:px-12 lg:min-h-[calc(960px-9rem)] lg:grid-cols-[1fr_512px] lg:gap-20 lg:px-32 lg:py-16">
      <section>
        <PinqLogo className="w-48 sm:w-60" />
        <p className="eyebrow mt-8">Early research</p>
        <h1 className="mt-4 max-w-xl text-4xl leading-[1.1] lg:text-[52px]">Translate community so the world can serve it properly.</h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          pinq is a future, research-stage model SUZI intends to own — not an available trained model. SUZI Connect is planned as SUZI's first public tool. Rights are reviewed before anything is used.
        </p>
      </section>
      <section aria-labelledby="contribute" className="rounded-lg border bg-card p-6 sm:p-10">
        <h2 id="contribute" className="mb-6 text-3xl">Help shape pinq.</h2>
        <ContributionForm available={available} />
      </section>
    </div>
  );
}
