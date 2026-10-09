"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestPublishingPreferences } from "@/lib/scheduling/publishing-preferences-client";

export function PublishingPreferencesSettings() {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [value, setValue] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void requestPublishingPreferences(undefined, controller.signal).then((preferences) => {
      if (controller.signal.aborted) return;
      setSaved(preferences.containsSyntheticMedia); setValue(preferences.containsSyntheticMedia);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load publishing preferences.");
    });
    return () => controller.abort();
  }, [retry]);

  async function save() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const preferences = await requestPublishingPreferences({ containsSyntheticMedia: value });
      setSaved(preferences.containsSyntheticMedia); setMessage("Publishing default saved for your account.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save publishing preferences."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="publishing-defaults-heading" className="space-y-4 border-t border-border px-5 py-5 sm:px-6">
    <div><h3 id="publishing-defaults-heading" className="text-sm font-bold text-foreground-strong">Publishing defaults</h3>
      <p className="mt-1 text-sm leading-6 text-muted">Set the AI content disclosure default for new TikTok and YouTube posts. You can change it for each post in publishing options. Existing schedules keep their settings.</p></div>
    <label className="flex items-center justify-between gap-4 text-sm font-semibold">
      <span>Contains AI-generated content by default</span>
      <input type="checkbox" checked={value} disabled={saved === null || busy} onChange={(event) => { setValue(event.target.checked); setMessage(null); }} className="size-4 accent-primary" />
    </label>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {saved === null ? error ? <Button variant="outline" onClick={() => { setError(null); setRetry((current) => current + 1); }}>Retry loading defaults</Button> : <p role="status" className="text-sm text-muted">Loading your publishing defaults…</p>
      : <Button disabled={busy || value === saved} onClick={save}>{busy ? "Saving…" : "Save publishing default"}</Button>}
    {message ? <p role="status" className="text-sm text-muted">{message}</p> : null}
  </section>;
}
