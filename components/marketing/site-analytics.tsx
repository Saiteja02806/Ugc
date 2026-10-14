"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_EVENT, analyticsEnabled, isPublicAnalyticsPage,
  readAnalyticsConsent, setAnalyticsConsent, updateAnalyticsPage,
  type AnalyticsConsent,
} from "@/lib/analytics/site-analytics";

export function SiteAnalytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsConsent | null>(null);
  const [available, setAvailable] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const sync = () => {
      setAvailable(analyticsEnabled());
      setChoice(readAnalyticsConsent());
      try { updateAnalyticsPage(window.location.pathname); } catch { /* Optional. */ }
    };
    sync();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [pathname]);

  if (!available || !isPublicAnalyticsPage(pathname)) return null;
  const choose = (value: AnalyticsConsent) => {
    setAnalyticsConsent(value);
    setShowPreferences(false);
  };

  if (choice !== null && !showPreferences) return (
    <button type="button" onClick={() => setShowPreferences(true)} className="fixed bottom-3 left-3 z-50 rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm hover:text-foreground">
      Analytics preferences
    </button>
  );

  return (
    <section aria-label="Analytics preferences" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-background p-5 text-foreground shadow-xl">
      <p className="font-semibold">Help us improve UGC Pilot</p>
      <p className="mt-2 text-sm text-muted-foreground">
        With your permission, Google Analytics measures public page visits and new accounts.
        You can change your choice here at any time. <Link href="/cookies" className="underline">Cookie policy</Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => choose("granted")} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Allow analytics</button>
        <button type="button" onClick={() => choose("denied")} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Reject analytics</button>
        {choice !== null && <button type="button" onClick={() => setShowPreferences(false)} className="px-3 py-2 text-sm underline">Close</button>}
      </div>
    </section>
  );
}
