import { createFileRoute, Link } from "@tanstack/react-router";
import { trackCta } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { PinqLogo } from "@/components/PinqMark";
import { GITHUB_URL } from "@/components/SiteChrome";
import symbol from "@/assets/brand/suzi-symbol-color.svg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SUZI — Intelligence for everyone" },
      { name: "description", content: "SUZI is the nonprofit technology arm of The Wealth Salons, building human-intelligence technology grounded in lived experience." },
      { property: "og:title", content: "SUZI — Intelligence for everyone" },
      { property: "og:description", content: "Human-intelligence technology grounded in needs, lived experience, and communities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const PRINCIPLES = [
  { n: "01", t: "Context", h: "People, in context.", d: "Understand people in the setting they actually live in, not an average of everyone." },
  { n: "02", t: "Evidence", h: "Grounded, not guessed.", d: "Prefer what communities can show and verify over what models assume." },
  { n: "03", t: "Agency", h: "Choice stays human.", d: "Keep decisions with the people affected. Technology should widen choices, not make them." },
];

// Illustrative examples of what others might build — not SUZI Connect integrations.
const TOOLS = [
  { id: "tools_wealthypedia", name: "Wealthypedia", d: "An example of making financial information easier to understand and act on.", cta: "Explore Wealthypedia", href: "https://wealthypedia.org/" },
  { id: "tools_groundwork", name: "Groundwork", d: "An example of helping people navigate local resources and practical next steps.", cta: "Explore Groundwork", href: "https://groundwork.trylumenfolk.com/" },
];

const wrap = "mx-auto max-w-[1440px] px-6 sm:px-12 lg:px-32";

function Home() {
  return (
    <div>
      <section className={`${wrap} grid items-center gap-12 py-16 lg:grid-cols-[55fr_45fr] lg:py-24`}>
        <div>
          <p className="eyebrow mb-6">Human-centered. Open by design.</p>
          <h1 className="text-6xl leading-[0.98] sm:text-7xl lg:text-[104px]">
            Intelligence
            <br />
            for everyone.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            SUZI builds human-intelligence technology that starts from real needs and lived experience. SUZI Connect is planned as our first public tool.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Button asChild size="lg">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackCta("explore_github", "home_hero", "github")}>
                Explore SUZI on GitHub
              </a>
            </Button>
            <a href="#approach" className="text-sm font-medium underline decoration-gold underline-offset-8">Meet SUZI →</a>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Early-stage project. Research and components are in development.</p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <img src={symbol} alt="" className="h-auto w-56 sm:w-[300px]" />
        </div>
      </section>

      <section id="approach" aria-labelledby="approach-h" className={`${wrap} scroll-mt-8 border-t py-20`}>
        <h2 id="approach-h" className="max-w-2xl text-4xl sm:text-5xl">Built around people, not assumptions.</h2>
        <div className="mt-14 grid gap-12 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.t}>
              <p className="eyebrow !text-gold">{p.n} / {p.t.toUpperCase()}</p>
              <div className="rule-gold mt-3" />
              <h3 className="mt-5 text-2xl sm:text-3xl">{p.h}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className={`${wrap} flex flex-col items-start justify-between gap-8 py-16 sm:flex-row sm:items-center`}>
          <div>
            <h2 className="text-4xl">An open starting point.</h2>
            <p className="mt-3 max-w-xl text-sm opacity-80">Read how SUZI works in the open on GitHub.</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackCta("explore_github", "home_band", "github")}>
              Explore on GitHub
            </a>
          </Button>
        </div>
      </section>

      <section id="tools" aria-labelledby="tools-h" className={`${wrap} scroll-mt-8 py-20`}>
        <div className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:gap-20">
          <div>
            <p className="eyebrow">Tools in the wild</p>
            <h2 id="tools-h" className="mt-4 text-4xl sm:text-5xl">What we hope to make possible.</h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
              We're building SUZI so more people can use trusted community data and human-centered tools to create useful experiences. Wealthypedia and Groundwork offer a glimpse of the kinds of products we hope SUZI will help others build.
            </p>
          </div>
          <div>
            <ul className="divide-y border-y">
              {TOOLS.map((t) => (
                <li key={t.id} className="py-8">
                  <h3 className="text-2xl sm:text-3xl">{t.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.d}</p>
                  <a href={t.href} target="_blank" rel="noopener noreferrer" onClick={() => trackCta(t.id, "home_tools", "external")} className="mt-4 inline-block text-sm font-medium underline decoration-gold underline-offset-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t.cta} →<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">These are existing ecosystem products and illustrative examples, not current SUZI Connect integrations.</p>
          </div>
        </div>
      </section>

      <section className={`${wrap} py-20`}>
        <div className="grid items-center gap-8 rounded-lg border p-8 sm:p-12 md:grid-cols-2">
          <div className="flex items-center gap-6">
            <PinqLogo className="w-40 shrink-0 sm:w-48" />
            <p className="text-sm text-muted-foreground">pinq is SUZI's early human-intelligence research.</p>
          </div>
          <div className="md:justify-self-end md:text-right">
            <h2 className="text-3xl">Help shape pinq.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Suggest a source, offer a dataset, or share an idea.</p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/pinq" onClick={() => trackCta("pinq_invite", "home_pinq", "internal")}>Contribute to pinq</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
