"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestPublishingPreferences } from "@/lib/scheduling/publishing-preferences-client";
import { DEFAULT_PUBLISHING_PREFERENCES, type PublishingPreferences } from "@/lib/scheduling/publishing-preferences";

export function PublishingPreferencesSettings() {
  const [saved, setSaved] = useState<PublishingPreferences | null>(null);
  const [value, setValue] = useState<PublishingPreferences>(DEFAULT_PUBLISHING_PREFERENCES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void requestPublishingPreferences(undefined, controller.signal).then((preferences) => {
      if (controller.signal.aborted) return;
      setSaved(preferences); setValue(preferences);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load publishing preferences.");
    });
    return () => controller.abort();
  }, [retry]);

  async function save() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const preferences = await requestPublishingPreferences(value);
      setSaved(preferences); setValue(preferences); setMessage("Publishing defaults saved for your account.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save publishing preferences."); }
    finally { setBusy(false); }
  }

  function update<K extends keyof PublishingPreferences>(key: K, setting: PublishingPreferences[K]) {
    setValue((current) => ({ ...current, [key]: setting })); setMessage(null);
  }

  const disabled = saved === null || busy;
  const unchanged = saved !== null && Object.keys(value).every((key) => value[key as keyof PublishingPreferences] === saved[key as keyof PublishingPreferences]);

  return <section aria-labelledby="publishing-defaults-heading" className="space-y-4 border-t border-border px-5 py-5 sm:px-6">
    <div><h3 id="publishing-defaults-heading" className="text-sm font-bold text-foreground-strong">Publishing defaults</h3>
      <p className="mt-1 text-sm leading-6 text-muted">New posts use these defaults. Existing schedules keep their settings.</p></div>
    <label className="flex items-center justify-between gap-4 text-sm font-semibold">
      <span>Contains AI-generated content by default</span>
      <input type="checkbox" checked={value.containsSyntheticMedia} disabled={disabled} onChange={(event) => update("containsSyntheticMedia", event.target.checked)} className="size-4 accent-primary" />
    </label>
    <fieldset disabled={disabled} className="space-y-4 border-t border-border pt-4">
      <legend className="text-sm font-bold text-foreground-strong">TikTok defaults</legend>
      <label className="block text-sm font-semibold">
        Visibility
        <select value={value.tiktokPrivacyLevel} onChange={(event) => update("tiktokPrivacyLevel", event.target.value as PublishingPreferences["tiktokPrivacyLevel"])} className="mt-2 h-10 w-full rounded-control border border-border bg-card px-3 text-sm text-foreground-strong">
          <option value="PUBLIC_TO_EVERYONE">Everyone</option>
          <option value="FOLLOWER_OF_CREATOR">Followers</option>
          <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
          <option value="SELF_ONLY">Only me</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-4 text-sm font-semibold">
        <span>Allow comments</span>
        <input type="checkbox" checked={value.tiktokAllowComments} onChange={(event) => update("tiktokAllowComments", event.target.checked)} className="size-4 accent-primary" />
      </label>
      <div className="space-y-2">
        <label className="flex items-center justify-between gap-4 text-sm font-semibold">
          <span>Label posts as promotional content</span>
          <input type="checkbox" checked={value.tiktokBrandOrganic} aria-describedby="tiktok-promotional-content-description" onChange={(event) => update("tiktokBrandOrganic", event.target.checked)} className="size-4 accent-primary" />
        </label>
        <p id="tiktok-promotional-content-description" className="text-sm leading-6 text-muted">Off by default. Turn on for posts promoting your own brand, product or business. TikTok will display “Promotional content”. This is separate from AI content disclosure and paid partnerships.</p>
      </div>
      <p className="text-sm leading-6 text-muted">Applies to new posts. Account restrictions may limit visibility or turn comments off.</p>
    </fieldset>
    <fieldset disabled={disabled} className="space-y-4 border-t border-border pt-4">
      <legend className="text-sm font-bold text-foreground-strong">YouTube defaults</legend>
      <label className="block text-sm font-semibold">
        Visibility
        <select value={value.youtubePrivacyStatus} onChange={(event) => update("youtubePrivacyStatus", event.target.value as PublishingPreferences["youtubePrivacyStatus"])} className="mt-2 h-10 w-full rounded-control border border-border bg-card px-3 text-sm text-foreground-strong">
          <option value="public">Everyone (Public)</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-4 text-sm font-semibold">
        <span>Made for kids</span>
        <input type="checkbox" checked={value.youtubeMadeForKids} onChange={(event) => update("youtubeMadeForKids", event.target.checked)} className="size-4 accent-primary" />
      </label>
      <label className="flex items-center justify-between gap-4 text-sm font-semibold">
        <span>Notify subscribers</span>
        <input type="checkbox" checked={value.youtubeNotifySubscribers} onChange={(event) => update("youtubeNotifySubscribers", event.target.checked)} className="size-4 accent-primary" />
      </label>
    </fieldset>
    <p className="text-sm leading-6 text-muted">Comment moderation and age restrictions are managed on the destination platform.</p>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {saved === null ? error ? <Button variant="outline" onClick={() => { setError(null); setRetry((current) => current + 1); }}>Retry loading defaults</Button> : <p role="status" className="text-sm text-muted">Loading your publishing defaults…</p>
      : <Button disabled={busy || unchanged} onClick={save}>{busy ? "Saving…" : "Save publishing defaults"}</Button>}
    {message ? <p role="status" className="text-sm text-muted">{message}</p> : null}
  </section>;
}
