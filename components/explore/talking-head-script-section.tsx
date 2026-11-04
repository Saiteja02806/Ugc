"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { estimateTalkingHeadSpeechSeconds } from "@/lib/explore/talking-head-script-remix";
import { readTalkingHeadScriptDraft } from "@/lib/explore/talking-head-script-draft";
import { buildTalkingHeadPromptExport, type TalkingHeadPromptExport } from "@/lib/explore/talking-head-prompt";

type Source = { referenceId: string; sourceSha256: string; transcriptSha256: string; selectionSha256: string; fullText: string; hookText: string; hookEndMs: number; reviewNotes?: string };
type Pending = { requestKey: string; referenceId: string; sourceSha256: string; transcriptSha256: string; selectionSha256?: string; businessProfileVersion: number; script: string; reviewed: true };
type PromptContext = { requestKey: string; sceneDirections: string; selectionSha256: string; hookEndMs: number };
type Saved = { version: 1; script: string | null; reviewed: boolean; reviewedSelectionSha256?: string; pending: Pending | null; pendingPrompt?: PromptContext; videoPrompt?: TalkingHeadPromptExport; earlierPrompt?: TalkingHeadPromptExport };
export function TalkingHeadScriptSection({ ownerId, referenceId, sourceSha256, draftId, initialScript, preferInitialScript = false, sceneDirections, onChange }: {
  ownerId: string; referenceId: string; sourceSha256: string; draftId: string; initialScript?: string; preferInitialScript?: boolean; sceneDirections: string; onChange: (text: string, reviewed: boolean) => void;
}) {
  const storageKey = `ugc-talking-head-script:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(draftId)}:${referenceId}:${sourceSha256}`;
  const [restored] = useState<{ value: Saved; error: string | null }>(() => {
    // Create words belong only to the active source. A different reference
    // starts from its own saved draft or fetched hook, never another video's text.
    const fallback: Saved = { version: 1, script: preferInitialScript ? initialScript ?? "" : null, reviewed: false, pending: null };
    try {
      const value = readTalkingHeadScriptDraft(localStorage.getItem(storageKey), referenceId, sourceSha256) ?? fallback;
      return { value: preferInitialScript && value.script !== (initialScript ?? "") ? { ...value, script: initialScript ?? "", reviewed: false } : value, error: null };
    } catch { return { value: fallback, error: "The saved prompt request could not be verified. Restore its saved request before generating another prompt." }; }
  });
  const [saved, setSaved] = useState<Saved>(restored.value);
  const [source, setSource] = useState<Source | null>(null);
  const [business, setBusiness] = useState<{ name: string | null; version: number | null; ready: boolean } | null>(null);
  const [enabled, setEnabled] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0), [olderResult, setOlderResult] = useState<string | null>(null);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const revision = useRef(0), active = useRef(true), current = useRef(saved), inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (saved.script !== null) onChange(saved.script, saved.reviewed && saved.reviewedSelectionSha256 === source?.selectionSha256 && Boolean(source)); }, [saved.script, saved.reviewed, saved.reviewedSelectionSha256, source, onChange]);
  const remember = useCallback((next: Saved, requireStorage = false) => {
    try { if (restored.error) { if (requireStorage) throw Error("Saved request needs recovery."); } else localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { if (requireStorage) throw Error("Could not save request recovery. No prompt request was submitted."); setError("Browser saving is unavailable. Keep this panel open to retain your edits."); }
    current.current = next; setSaved(next);
  }, [storageKey, restored.error]);
  function edit(script: string, reviewed = false, completedRequestKey?: string) {
    revision.current++; remember({ ...current.current, ...(completedRequestKey && completedRequestKey === current.current.pending?.requestKey ? { pending: null, pendingPrompt: undefined } : {}), script, reviewed, ...(reviewed && source ? { reviewedSelectionSha256: source.selectionSha256 } : {}) }); setOlderResult(null); setPromptMessage(null); onChange(script, reviewed);
  }
  const promptOutdated = Boolean(saved.videoPrompt && (!source || saved.videoPrompt.selectionSha256 !== source.selectionSha256 || saved.videoPrompt.script !== saved.script || saved.videoPrompt.sceneDirections !== sceneDirections || saved.videoPrompt.businessProfileVersion !== undefined && business?.version !== undefined && saved.videoPrompt.businessProfileVersion !== business.version));
  function applyPrompt(videoPrompt: TalkingHeadPromptExport, completedRequestKey?: string) {
    revision.current++;
    remember({ ...current.current, ...(completedRequestKey && completedRequestKey === current.current.pending?.requestKey ? { pending: null, pendingPrompt: undefined } : {}), script: videoPrompt.script, reviewed: false, videoPrompt, earlierPrompt: undefined });
    setOlderResult(null); setError(null); setPromptMessage("Personalized prompt ready. Review the spoken words before generating a video.");
    onChange(videoPrompt.script, false);
  }
  async function copyPrompt() {
    if (promptOutdated || !saved.videoPrompt?.text.trim()) return;
    try { await navigator.clipboard.writeText(saved.videoPrompt.text); setPromptMessage("Prompt copied."); }
    catch { setPromptMessage("Copy is unavailable. Select the prompt text and copy it manually."); }
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
        if (data.source?.referenceId !== referenceId || data.source?.sourceSha256 !== sourceSha256 || typeof data.source?.hookText !== "string" || typeof data.source?.fullText !== "string" || !/^[a-f0-9]{64}$/u.test(data.source?.selectionSha256 ?? "") || !/^[a-f0-9]{64}$/u.test(data.source?.transcriptSha256 ?? "")) throw Error("This transcript does not match the selected source.");
        if (controller.signal.aborted) return;
        setSource(data.source); setBusiness(data.business); setEnabled(data.enabled === true);
        const text = current.current.script ?? data.source.hookText;
        if (current.current.script === null) {
          const next = { ...current.current, script: text }; current.current = next; setSaved(next);
          try { if (!restored.error) localStorage.setItem(storageKey, JSON.stringify(next)); } catch { setError("Browser saving is unavailable. Keep this panel open to retain your edits."); }
        }
        if (current.current.reviewed && current.current.reviewedSelectionSha256 !== data.source.selectionSha256) remember({ ...current.current, reviewed: false });
        onChange(text, current.current.reviewed);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load your script."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [ownerId, referenceId, sourceSha256, storageKey, attempt, onChange, restored.error, remember]);
  async function generatePrompt(recover = false) {
    if (inFlight.current || busy || !recover && (restored.error || !source || !enabled || !business?.ready || business.version === null || !saved.reviewed || !saved.script?.trim())) return;
    const revisionAtStart = revision.current;
    let pending = current.current.pending;
    let context = current.current.pendingPrompt;
    if (recover && !pending) return;
    if (!recover && pending) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const token = await getCurrentUserIdToken(ownerId);
      if (!active.current) return;
      if (!token) throw Error("Sign in before generating your personalized prompt.");
      if (!pending) {
        if (revision.current !== revisionAtStart || !current.current.reviewed || current.current.reviewedSelectionSha256 !== source!.selectionSha256) throw Error("Your words changed. Review them before generating a prompt.");
        // Validate the complete frozen export input before reserving a paid remix.
        buildTalkingHeadPromptExport({ script: current.current.script!, sourceReviewed: true, sceneDirections, selectionSha256: source!.selectionSha256, hookEndMs: source!.hookEndMs });
        pending = { requestKey: crypto.randomUUID(), referenceId, sourceSha256, transcriptSha256: source!.transcriptSha256, selectionSha256: source!.selectionSha256, businessProfileVersion: business!.version!, script: current.current.script!, reviewed: true };
        context = { requestKey: pending.requestKey, sceneDirections, selectionSha256: source!.selectionSha256, hookEndMs: source!.hookEndMs };
        remember({ ...current.current, pending, pendingPrompt: context }, true);
      }
      const response = await fetch(recover ? `/api/explore/talking-head-script?requestKey=${pending.requestKey}` : "/api/explore/talking-head-script", {
        method: recover ? "GET" : "POST", cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(!recover ? { "Content-Type": "application/json", "Idempotency-Key": pending.requestKey } : {}) },
        ...(!recover ? { body: JSON.stringify(pending) } : {}), signal: AbortSignal.timeout(75000),
      });
      const result = await response.json();
      if (!active.current) return;
      if (!response.ok || !result.ok) {
        if (result.outcome === "failed" || !recover && !result.outcome && response.status >= 400 && response.status < 500) remember({ ...current.current, pending: null, pendingPrompt: undefined });
        throw Error(result.message || "The request could not be confirmed. Check the saved prompt.");
      }
      if (result.referenceId !== referenceId || result.sourceSha256 !== sourceSha256 || typeof result.script !== "string" || !result.script.trim() || result.script.length > 6000) throw Error("The saved script could not be verified.");
      // A legacy script-only request can finish using current matching source
      // evidence. New requests always recover their own pre-submit snapshot.
      context ??= source && pending.selectionSha256 === source.selectionSha256 && pending.transcriptSha256 === source.transcriptSha256
        ? { requestKey: pending.requestKey, sceneDirections, selectionSha256: source.selectionSha256, hookEndMs: source.hookEndMs } : undefined;
      const videoPrompt = context ? { ...buildTalkingHeadPromptExport({ script: result.script, sourceReviewed: pending.reviewed, ...context }), requestKey: pending.requestKey, businessProfileVersion: pending.businessProfileVersion } : undefined;
      if (revision.current === revisionAtStart && current.current.script === pending.script) {
        if (videoPrompt) applyPrompt(videoPrompt, pending.requestKey);
        else { edit(result.script, false, pending.requestKey); setError("Saved script recovered. Load the current source details and review its words before generating a personalized prompt."); }
      } else if (videoPrompt) {
        remember({ ...current.current, pending: null, pendingPrompt: undefined, earlierPrompt: videoPrompt });
        setError("The prompt finished for earlier words. Your newer edits are kept.");
      } else { remember({ ...current.current, pending: null, pendingPrompt: undefined }); setOlderResult(result.script); setError("The script finished for earlier words. Your newer edits are kept."); }
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : "Could not generate your personalized prompt. Your script is kept."); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  return <section aria-label="Talking Head script" className="space-y-3 rounded-xl border border-border p-4">
    <div><h2 className="text-sm font-semibold">Talking Head script</h2><p className="mt-1 text-xs leading-5 text-muted">Review the spoken hook while your starting image generates. Your demo stays separate.</p></div>
    {loading ? <p role="status" className="text-xs text-muted">Loading source transcript…</p> : null}
    {source ? <div className="space-y-3"><details><summary className="cursor-pointer text-sm">Original hook · 0–{(source.hookEndMs / 1000).toFixed(2)}s</summary><p className="mt-2 whitespace-pre-wrap text-sm">{source.hookText}</p>{source.reviewNotes ? <p className="mt-2 text-xs leading-5 text-muted">{source.reviewNotes}</p> : null}</details><details><summary className="cursor-pointer text-xs text-muted">Full source transcript draft · may include demo narration</summary><p className="mt-2 whitespace-pre-wrap text-sm">{source.fullText}</p></details></div> : null}
    <label className="block space-y-2 text-sm"><span>Your script</span><textarea aria-label="Talking Head script" rows={5} maxLength={6000} value={saved.script ?? ""} onChange={event => edit(event.target.value)} className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-6" placeholder="Review or write only the spoken hook. Leave out demo narration." /></label>
    <p className="text-xs text-muted">Transcript draft: check words and the hook boundary against the source. Estimated speech: {estimateTalkingHeadSpeechSeconds(saved.script ?? "")}s. Changing words keeps your generated image.</p>
    <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" checked={saved.reviewed} onChange={event => remember({ ...current.current, reviewed: event.target.checked, ...(source ? { reviewedSelectionSha256: source.selectionSha256 } : {}) })} className="mt-1" />I reviewed these hook words; demo narration is excluded.</label>
    <div className="space-y-2"><Button type="button" className="min-h-11 w-full sm:w-auto" disabled={busy || !saved.pending && (Boolean(restored.error) || loading || !source || !enabled || !business?.ready || !saved.reviewed || !saved.script?.trim() || !sceneDirections.trim())} onClick={() => void generatePrompt(Boolean(saved.pending))}>{busy ? saved.pending ? "Preparing personalized prompt…" : "Generating personalized prompt…" : saved.pending ? "Check saved prompt" : "Generate prompt"}</Button><p className="text-xs text-muted">Personalizes this hook for {business?.name ?? "your business"}, then prepares a copyable video prompt. No video is generated.</p></div>
    {saved.videoPrompt ? <div className="space-y-2 border-t border-border pt-3">
      <label className="block space-y-2 text-sm"><span>Video prompt</span><textarea aria-label="Talking Head video prompt" rows={8} maxLength={24000} value={saved.videoPrompt.text} onChange={event => { revision.current++; remember({ ...current.current, videoPrompt: { ...current.current.videoPrompt!, text: event.target.value } }); setPromptMessage(null); }} className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-6" /></label>
      {promptOutdated ? <p role="status" className="text-xs text-muted">The script, source directions or business details changed. Review the hook and generate a new prompt; your previous prompt is kept here.</p> : <p className="text-xs text-muted">Suggested duration: {saved.videoPrompt.durationSeconds}s. Use this prompt with your generated starting frame.</p>}
      {saved.videoPrompt.durationSeconds > 15 ? <p className="text-xs text-muted">This prompt keeps the full hook. It exceeds this app&apos;s 15-second single-clip limit.</p> : null}
      <Button type="button" variant="outline" disabled={promptOutdated || !saved.videoPrompt.text.trim()} onClick={() => void copyPrompt()}>Copy prompt</Button>
    </div> : null}
    {promptMessage ? <p role="status" className="text-xs text-muted">{promptMessage}</p> : null}
    {!loading && business?.ready === false ? <a className="text-xs underline" href="/settings#business-context" target="_blank" rel="noopener noreferrer">Add business context in Settings</a> : null}
    {!loading && source && !enabled ? <p role="status" className="text-xs text-muted">Personalized prompt generation is unavailable. You can still edit your script.</p> : null}
    {saved.earlierPrompt ? <div className="space-y-2"><p className="whitespace-pre-wrap text-sm">{saved.earlierPrompt.script}</p><Button type="button" variant="outline" onClick={() => applyPrompt(saved.earlierPrompt!)}>Use generated prompt</Button></div> : null}
    {olderResult ? <div className="space-y-2"><p className="whitespace-pre-wrap text-sm">{olderResult}</p><Button type="button" variant="outline" onClick={() => edit(olderResult)}>Use remixed script</Button></div> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    {restored.error ? <p role="alert" className="text-xs text-destructive">{restored.error}</p> : null}
    {!loading && (!source || !saved.pending && (error || business?.ready === false)) ? <Button type="button" variant="outline" onClick={() => { setLoading(true); setError(null); setAttempt(value => value + 1); }}>{source ? "Reload script details" : "Retry transcript"}</Button> : null}
    <p className="text-xs text-muted">Use this starting frame carries these words into Create, where you can edit them again. Spoken video requires Sound on and enough duration.</p>
  </section>;
}
