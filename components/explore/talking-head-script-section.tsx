"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { estimateTalkingHeadSpeechSeconds } from "@/lib/explore/talking-head-script-remix";
import { readTalkingHeadScriptDraft } from "@/lib/explore/talking-head-script-draft";

type Source = { referenceId: string; sourceSha256: string; transcriptSha256: string; fullText: string; hookText: string; hookEndMs: number };
type Pending = { requestKey: string; referenceId: string; sourceSha256: string; transcriptSha256: string; businessProfileVersion: number; script: string; reviewed: true };
type Saved = { version: 1; script: string | null; reviewed: boolean; pending: Pending | null };
export function TalkingHeadScriptSection({ ownerId, referenceId, sourceSha256, draftId, initialScript, preferInitialScript = false, onChange }: {
  ownerId: string; referenceId: string; sourceSha256: string; draftId: string; initialScript?: string; preferInitialScript?: boolean; onChange: (text: string) => void;
}) {
  const storageKey = `ugc-talking-head-script:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(draftId)}:${referenceId}:${sourceSha256}`;
  const [restored] = useState<{ value: Saved; error: string | null }>(() => {
    // Create words belong only to the active source. A different reference
    // starts from its own saved draft or fetched hook, never another video's text.
    const fallback: Saved = { version: 1, script: preferInitialScript ? initialScript ?? "" : null, reviewed: false, pending: null };
    try {
      const value = readTalkingHeadScriptDraft(localStorage.getItem(storageKey), referenceId, sourceSha256) ?? fallback;
      return { value: preferInitialScript ? { ...value, script: initialScript ?? "", reviewed: false } : value, error: null };
    } catch { return { value: fallback, error: "The saved script request could not be verified. Restore its saved request before starting another remix." }; }
  });
  const [saved, setSaved] = useState<Saved>(restored.value);
  const [source, setSource] = useState<Source | null>(null);
  const [business, setBusiness] = useState<{ name: string | null; version: number | null; ready: boolean } | null>(null);
  const [enabled, setEnabled] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0), [olderResult, setOlderResult] = useState<string | null>(null);
  const revision = useRef(0), active = useRef(true), current = useRef(saved), inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (current.current.script !== null) onChange(current.current.script); }, [onChange]);
  function remember(next: Saved, requireStorage = false) {
    try { if (restored.error) { if (requireStorage) throw Error("Saved request needs recovery."); } else localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { if (requireStorage) throw Error("Could not save request recovery. No remix was submitted."); setError("Browser saving is unavailable. Keep this panel open to retain your edits."); }
    current.current = next; setSaved(next);
  }
  function edit(script: string, reviewed = false) {
    revision.current++; remember({ ...current.current, script, reviewed }); setOlderResult(null); onChange(script);
  }
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await getCurrentUserIdToken(ownerId);
        if (!token) throw Error("Sign in to load your script.");
        const response = await fetch(`/api/explore/talking-head-script?referenceId=${encodeURIComponent(referenceId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.ok) throw Error(data.message || "Could not load the source transcript.");
        if (data.source?.referenceId !== referenceId || data.source?.sourceSha256 !== sourceSha256 || typeof data.source?.hookText !== "string" || typeof data.source?.fullText !== "string" || !/^[a-f0-9]{64}$/u.test(data.source?.transcriptSha256 ?? "")) throw Error("This transcript does not match the selected source.");
        if (controller.signal.aborted) return;
        setSource(data.source); setBusiness(data.business); setEnabled(data.enabled === true);
        const text = current.current.script ?? data.source.hookText;
        if (current.current.script === null) {
          const next = { ...current.current, script: text }; current.current = next; setSaved(next);
          try { if (!restored.error) localStorage.setItem(storageKey, JSON.stringify(next)); } catch { setError("Browser saving is unavailable. Keep this panel open to retain your edits."); }
        }
        onChange(text);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load your script."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [ownerId, referenceId, sourceSha256, storageKey, attempt, onChange, restored.error]);
  async function remix(recover = false) {
    if (inFlight.current || busy || !recover && (restored.error || !source || !enabled || !business?.ready || business.version === null || !saved.reviewed || !saved.script?.trim())) return;
    const revisionAtStart = revision.current;
    let pending = current.current.pending;
    if (recover && !pending) return;
    if (!recover && pending) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const token = await getCurrentUserIdToken(ownerId);
      if (!active.current) return;
      if (!token) throw Error("Sign in before remixing.");
      if (!pending) {
        if (revision.current !== revisionAtStart || !current.current.reviewed) throw Error("Your words changed. Review them before remixing.");
        pending = { requestKey: crypto.randomUUID(), referenceId, sourceSha256, transcriptSha256: source!.transcriptSha256, businessProfileVersion: business!.version!, script: current.current.script!, reviewed: true };
        remember({ ...current.current, pending }, true);
      }
      const response = await fetch(recover ? `/api/explore/talking-head-script?requestKey=${pending.requestKey}` : "/api/explore/talking-head-script", {
        method: recover ? "GET" : "POST", cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(!recover ? { "Content-Type": "application/json", "Idempotency-Key": pending.requestKey } : {}) },
        ...(!recover ? { body: JSON.stringify(pending) } : {}), signal: AbortSignal.timeout(75000),
      });
      const result = await response.json();
      if (!active.current) return;
      if (!response.ok || !result.ok) {
        if (result.outcome === "failed" || !recover && !result.outcome && response.status >= 400 && response.status < 500) remember({ ...current.current, pending: null });
        throw Error(result.message || "The request could not be confirmed. Check the saved remix.");
      }
      if (result.referenceId !== referenceId || result.sourceSha256 !== sourceSha256 || typeof result.script !== "string" || !result.script.trim() || result.script.length > 6000) throw Error("The saved script could not be verified.");
      remember({ ...current.current, pending: null });
      if (revision.current === revisionAtStart && current.current.script === pending.script) edit(result.script, true);
      else { setOlderResult(result.script); setError("The remix finished for earlier words. Your newer edits are kept."); }
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : "Could not remix. Your script is kept."); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  return <section aria-label="Talking Head script" className="space-y-3 rounded-xl border border-border p-4">
    <div><h2 className="text-sm font-semibold">Talking Head script</h2><p className="mt-1 text-xs leading-5 text-muted">Review the spoken hook while your starting image generates. Your demo stays separate.</p></div>
    {loading ? <p role="status" className="text-xs text-muted">Loading source transcript…</p> : null}
    {source ? <details><summary className="cursor-pointer text-sm">Original hook · 0–{(source.hookEndMs / 1000).toFixed(2)}s</summary><p className="mt-2 whitespace-pre-wrap text-sm">{source.hookText}</p><details className="mt-3"><summary className="cursor-pointer text-xs text-muted">Full source transcript draft · may include demo narration</summary><p className="mt-2 whitespace-pre-wrap text-sm">{source.fullText}</p></details></details> : null}
    <label className="block space-y-2 text-sm"><span>Your script</span><textarea aria-label="Talking Head script" rows={5} maxLength={6000} value={saved.script ?? ""} onChange={event => edit(event.target.value)} className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-6" placeholder="Review or write only the spoken hook. Leave out demo narration." /></label>
    <p className="text-xs text-muted">Transcript draft: check words and the hook boundary against the source. Estimated speech: {estimateTalkingHeadSpeechSeconds(saved.script ?? "")}s. Changing words keeps your generated image.</p>
    <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" checked={saved.reviewed} onChange={event => remember({ ...current.current, reviewed: event.target.checked })} className="mt-1" />I reviewed these hook words; demo narration is excluded.</label>
    <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={busy || !saved.pending && (Boolean(restored.error) || loading || !source || !enabled || !business?.ready || !saved.reviewed || !saved.script?.trim())} onClick={() => void remix(Boolean(saved.pending))}>{busy ? "Remixing script…" : saved.pending ? "Check saved remix" : "Remix for my business"}</Button><span className="text-xs text-muted">{business?.name ?? "Business context from Settings"}</span></div>
    {!loading && business?.ready === false ? <a className="text-xs underline" href="/settings#business-context" target="_blank" rel="noopener noreferrer">Add business context in Settings</a> : null}
    {!loading && source && !enabled ? <p role="status" className="text-xs text-muted">Business Remix is unavailable. You can still edit your script.</p> : null}
    {olderResult ? <div className="space-y-2"><p className="whitespace-pre-wrap text-sm">{olderResult}</p><Button type="button" variant="outline" onClick={() => edit(olderResult, true)}>Use remixed script</Button></div> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    {restored.error ? <p role="alert" className="text-xs text-destructive">{restored.error}</p> : null}
    {!loading && (!source || !saved.pending && (error || business?.ready === false)) ? <Button type="button" variant="outline" onClick={() => { setLoading(true); setError(null); setAttempt(value => value + 1); }}>{source ? "Reload script details" : "Retry transcript"}</Button> : null}
    <p className="text-xs text-muted">Use this starting frame carries these words into Create, where you can edit them again. Spoken video requires Sound on and enough duration.</p>
  </section>;
}
