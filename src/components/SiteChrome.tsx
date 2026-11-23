import { Link, useRouterState } from "@tanstack/react-router";
import wordmark from "@/assets/brand/suzi-wordmark-forest.svg";
import { useEffect, useState } from "react";
import { getConsent, onConsentChange, setConsent, type ConsentState } from "@/lib/analytics/consent";
import { getAnalyticsConfig, startAnalytics, stopAnalytics, trackPageView } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

export const GITHUB_URL = "https://github.com/The-Wealth-Salons/SUZI";

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onPinq = pathname.startsWith("/pinq");
  return (
    <header className={`mx-auto flex max-w-[1440px] items-center justify-between px-6 sm:px-12 lg:px-32 ${onPinq ? "py-4" : "py-7"}`}>
      <Link to="/" aria-label="SUZI home">
        <img src={wordmark} alt="SUZI" className={onPinq ? "h-8 w-auto" : "h-10 w-auto"} />
      </Link>
      {onPinq ? (
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to SUZI</Link>
      ) : (
        <nav className="flex items-center gap-5 text-sm text-muted-foreground sm:gap-8">
          <a href="/#approach" className="hover:text-foreground">Our approach</a>
          <Link to="/pinq" className="hover:text-foreground">pinq</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-sm border border-primary px-3 py-1.5 font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">GitHub</a>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <footer className="mx-auto flex max-w-[1440px] flex-col gap-3 border-t px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between sm:px-12 lg:px-32">
      <p>SUZI · nonprofit technology within The Wealth Salons · SUZI Labs builds at suzilabs.com</p>
      <div className="flex gap-5">
        <Link to="/privacy">Privacy</Link>
        <button type="button" onClick={onOpenSettings} className="underline-offset-4 hover:underline">Analytics settings</button>
      </div>
    </footer>
  );
}

/** Consent banner + settings. Analytics only loads after explicit opt-in. */
export function ConsentControls({ open, setOpen, pathname }: { open: boolean; setOpen: (b: boolean) => void; pathname: string }) {
  const [state, setState] = useState<ConsentState>("unset");
  const configured = Boolean(getAnalyticsConfig().amplitudeKey || getAnalyticsConfig().gaId);

  useEffect(() => {
    setState(getConsent());
    return onConsentChange(setState);
  }, []);

  useEffect(() => {
    if (state !== "granted") return;
    startAnalytics().then((on) => on && trackPageView(pathname));
  }, [state, pathname]);

  // Nothing to consent to until per-site keys exist.
  if (!configured) {
    return open ? (
      <Panel>
        <p>Analytics are not configured on this site. Nothing is collected.</p>
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
      </Panel>
    ) : null;
  }
  if (state !== "unset" && !open) return null;
  return (
    <Panel>
      <p>
        May we use privacy-respecting analytics (Amplitude, Google Analytics) to learn which pages help? Nothing loads unless you agree. No form content or email is ever sent.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { setConsent("granted"); setOpen(false); }}>Allow analytics</Button>
        <Button size="sm" variant="outline" onClick={() => { setConsent("denied"); stopAnalytics(); setOpen(false); }}>
          {state === "granted" ? "Revoke" : "No thanks"}
        </Button>
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div role="dialog" aria-label="Analytics settings" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-lg border bg-card p-5 text-sm shadow-sm sm:flex-row sm:items-center">
      {children}
    </div>
  );
}
