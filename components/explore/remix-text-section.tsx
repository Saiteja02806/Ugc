"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { RecreateReference, RecreateFormat } from "@/lib/explore/recreate-types";
import { ReferenceTextSchema, RemixRequestSchema, remixSourceMatches, validateRemixDraft, validateRemixOutput, isWallHeadingBodySource, type ReferenceText, type RemixOutput, type RemixRequest } from "@/lib/explore/reference-text";
import { readRemixTextDraft } from "@/lib/explore/remix-text-draft";
import { hookRemixResult, hookRemixSource } from "@/lib/explore/hook-remix-source";
import styles from "./remix-text-section.module.css";

function mergeSavedText(seed: string | null, guidance: string) {
  if (!guidance.trim() || seed === guidance) return seed;
  return [seed, guidance].filter(Boolean).join("\n\n");
}

type Props = {
  owner: string | null; targetKey: string; format: RecreateFormat;
  reference?: RecreateReference | null; previewSource?: ReferenceText | null;
  defaultSlideId?: string | null; disabled?: boolean; localPreview?: boolean;
  onUse: (output: RemixOutput, source: ReferenceText) => void | boolean;
  children?: ReactNode;
  overview?: boolean;
  expanded?: boolean;
  editorNavigation?: boolean;
  referenceFirst?: boolean;
  scopeLabel?: string;
};

/** Clip, account and reference changes discard late replies and scope draft recovery. */
export function RemixTextSection(props: Props) {
  return <RemixTextControl key={`${props.owner}:${props.targetKey}:${props.format}:${props.reference?.id}:${props.defaultSlideId}`} {...props} />;
}

function RemixTextControl({ owner, targetKey, format, reference, previewSource, defaultSlideId, disabled, localPreview, onUse, children, overview = false, expanded = false, editorNavigation = false, referenceFirst = false, scopeLabel: customScopeLabel }: Props) {
  const selected = reference?.format === format && !reference.id.startsWith("uploaded:") ? reference : null;
  const prioritizeReference = referenceFirst && expanded && editorNavigation && !overview && Boolean(selected);
  const selection = { referenceId: selected?.id ?? null, slideId: format === "slideshow" ? selected ? selected.slides.find(s => s.id === defaultSlideId)?.id ?? null : defaultSlideId ?? null : null };
  const requestStorageKey = `ugc-explore:remix-request:v2:${owner}:${format}:${targetKey}:${selection.referenceId ?? ""}:${selection.slideId}`;
  const inputStorageKey = `${requestStorageKey}:input`;
  const [recovery] = useState(() => {
    try {
      if (!owner || localPreview) return null;
      const saved = readRemixTextDraft(localStorage.getItem(requestStorageKey)) ?? readRemixTextDraft(localStorage.getItem(`ugc-explore:remix-request:v1:${owner}:${format}:${targetKey}`));
      if (saved?.referenceId !== selection.referenceId || saved.slideId !== selection.slideId || saved.format && saved.format !== format) return null;
      if (saved.source && saved.reviewedDraft) {
        const result = hookRemixResult(saved.reviewedDraft, saved.source);
        return { ...saved, source: result.source, reviewedDraft: result.output };
      }
      return saved;
    } catch { return null; }
  });
  const [input, setInput] = useState<{ seed: string | null; instructions: string }>(() => {
    if (recovery) return { seed: mergeSavedText(recovery.referenceBlocks?.join("\n\n") ?? recovery.source?.blocks.map(block => block.text).join("\n\n") ?? null, recovery.instructions), instructions: "" };
    try {
      const raw = owner && !localPreview ? localStorage.getItem(inputStorageKey) : null;
      const saved = raw && raw.length < 14000 ? JSON.parse(raw) : null;
      if (typeof saved?.seed === "string" && saved.seed.length <= 6000 && typeof saved.instructions === "string" && saved.instructions.length <= 2000) return { seed: mergeSavedText(saved.seed, saved.instructions), instructions: "" };
    } catch { /* An unavailable local draft does not prevent editing. */ }
    return { seed: null, instructions: "" };
  });
  const [mode, setMode] = useState<"manual" | "reference">(overview || recovery || expanded ? "reference" : "manual");
  const [source, setSource] = useState<ReferenceText | null>(() => recovery?.source ?? (localPreview && previewSource && remixSourceMatches(previewSource, selection, format) ? hookRemixSource(previewSource) : null));
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(Boolean((overview || recovery || expanded) && owner && !localPreview));
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<RemixOutput | null>(recovery?.reviewedDraft ?? null);
  const [outputSource, setOutputSource] = useState<ReferenceText | null>(recovery?.source ?? null);
  const [business, setBusiness] = useState<{ name: string | null; ready: boolean } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [outcome, setOutcome] = useState<"failed" | "uncertain" | null>(recovery?.outcome === "completed" ? null : recovery?.outcome ?? null);
  const request = useRef<RemixRequest | null>(recovery ? { requestKey: recovery.requestKey, referenceId: recovery.referenceId, slideId: recovery.slideId, instructions: recovery.instructions,
    ...(recovery.format ? { format: recovery.format } : {}), ...(recovery.referenceBlocks ? { referenceBlocks: recovery.referenceBlocks } : {}) } : null);
  const generation = useRef(0), alive = useRef(true);
  const inputHintId = useId();
  const scopeId = useId();
  const selectedId = selected?.id;
  const startingText = input.seed ?? (source?.status === "ready" ? source.blocks.map(block => block.text).join("\n\n") : "");
  const sourceNeedsAttention = loading || prioritizeReference && source?.status !== "ready";
  const referenceLabel = format === "slideshow" ? "Slide reference" : "Video reference";
  const businessLabel = business?.name ?? (business?.ready ? "Saved in Settings" : loading ? "Loading…" : localPreview ? "Preview" : !owner ? "Sign in" : business?.ready === false ? "Not set" : "Unavailable");
  const scopeLabel = customScopeLabel ?? (format === "slideshow" ? "Applies to this slide only." : "Only this clip. The demo stays unchanged.");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (mode !== "reference" || !owner || localPreview || format === "slideshow" && selectedId && !selection.slideId) return;
    void (async () => {
      try {
        const token = await getCurrentUserIdToken(owner);
        if (!token) throw new Error("Sign in to load your business context.");
        const params = new URLSearchParams({ format });
        if (selectedId) params.set("referenceId", selectedId);
        if (selection.slideId) params.set("slideId", selection.slideId);
        const response = await fetch(`/api/explore/reference-text?${params}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || "Could not load remix details.");
        if (!controller.signal.aborted) {
          const next = data.source === null ? null : hookRemixSource(ReferenceTextSchema.parse(data.source));
          if (next && !remixSourceMatches(next, { referenceId: selectedId ?? null, slideId: selection.slideId }, format)) throw new Error("This text does not match your selected reference.");
          setSource(next); setEnabled(data.enabled === true);
          setBusiness(data.businessContext && typeof data.businessContext.ready === "boolean" ? { name: typeof data.businessContext.name === "string" ? data.businessContext.name : null, ready: data.businessContext.ready } : null);
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load remix details."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [owner, localPreview, mode, selectedId, format, selection.slideId, loadAttempt]);

  function reset() {
    generation.current++; request.current = null; setBusy(false); setDraft(null); setOutputSource(null); setError(null); setOutcome(null); setStorageError(false);
    try {
      localStorage.removeItem(requestStorageKey);
      const legacyKey = `ugc-explore:remix-request:v1:${owner}:${format}:${targetKey}`;
      const saved = readRemixTextDraft(localStorage.getItem(legacyKey));
      if (saved?.referenceId === selection.referenceId && saved.slideId === selection.slideId) localStorage.removeItem(legacyKey);
    } catch { /* The next request still requires successful durable storage. */ }
  }
  function changeInput(next: typeof input) {
    reset(); setInput(next);
    if (owner && !localPreview) try { localStorage.setItem(inputStorageKey, JSON.stringify({ seed: next.seed ?? startingText, instructions: next.instructions })); } catch { setStorageError(true); }
  }
  function saveReview(next: RemixOutput, original: ReferenceText) {
    setDraft(next);
    if (request.current) try { localStorage.setItem(requestStorageKey, JSON.stringify({ version: 1, ...request.current, outcome: "completed", source: original, reviewedDraft: next })); }
    catch { setStorageError(true); }
  }
  async function generate() {
    if (!owner || busy || disabled || !enabled || localPreview || draft || !request.current && (!startingText.trim() || !business?.ready)) return;
    const current = ++generation.current;
    if (!request.current) {
      const unchanged = source?.status === "ready" && startingText.trim() === source.blocks.map(block => block.text).join("\n\n").trim();
      const candidate = RemixRequestSchema.safeParse({ requestKey: crypto.randomUUID(), ...selection, format, instructions: unchanged ? "" : startingText.trim(),
        referenceBlocks: unchanged && source ? source.blocks.map(block => block.text) : [startingText.trim()] });
      if (!candidate.success) { setError("Keep reference text within 6,000 characters and remove unsupported control characters."); return; }
      request.current = candidate.data;
    }
    const payload = request.current;
    setBusy(true); setError(null); setOutcome(null);
    try {
      // Recover this exact immutable request after a reload or lost provider reply.
      localStorage.setItem(requestStorageKey, JSON.stringify({ version: 1, ...payload, outcome: "uncertain" }));
      const token = await getCurrentUserIdToken(owner);
      if (!token) throw new Error("Sign in before generating a remix.");
      const response = await fetch("/api/explore/remix-text", { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": payload.requestKey },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(85000) });
      const data = await response.json();
      if (!alive.current || generation.current !== current) return;
      if (!response.ok || !data.ok) {
        const nextOutcome = data.outcome === "failed" ? "failed" : "uncertain";
        setOutcome(nextOutcome);
        localStorage.setItem(requestStorageKey, JSON.stringify({ version: 1, ...payload, outcome: nextOutcome }));
        throw new Error(data.message || "Could not confirm the remix. Check its result again.");
      }
      const original = ReferenceTextSchema.parse(data.source);
      if (!remixSourceMatches(original, payload, format)) throw new Error("This result does not match this clip's starting text.");
      const next = validateRemixOutput(data.output, original);
      const result = hookRemixResult(next, original);
      setOutputSource(result.source); saveReview(result.output, result.source);
    } catch (e) {
      if (alive.current && generation.current === current) { setError(e instanceof Error ? e.message : "Could not confirm the remix. Check its result again."); setOutcome(value => value ?? "uncertain"); }
    } finally { if (alive.current && generation.current === current) setBusy(false); }
  }
  const locked = disabled || busy || outcome === "uncertain";
  const generationDisabled = disabled || busy || loading || !owner || !enabled || localPreview || Boolean(draft) || outcome !== "uncertain" && (!startingText.trim() || !business?.ready) || outcome === "failed";
  let draftError: string | null = null;
  const structuredWallDraft = Boolean(draft && outputSource && isWallHeadingBodySource(outputSource) && draft.blocks.length === 0);
  if (draft && outputSource) try { validateRemixDraft(draft, outputSource); } catch { draftError = structuredWallDraft ? "Add both a heading and body within their character limits." : "Keep every text block nonempty and within its character limit."; }
  function showMode(next: "manual" | "reference") {
    if (next === mode) return;
    setMode(next);
    if (next === "reference") setLoading(Boolean(owner && !localPreview && !(format === "slideshow" && selectedId && !selection.slideId)));
  }
  const availability = busy ? "Generating…" : draft ? "Draft ready" : outcome === "uncertain" ? "Check result" : localPreview ? "Preview" : !owner ? "Sign in" : loading ? "Loading…" : !enabled ? "Unavailable" : outcome === "failed" ? "Start a new remix" : !business?.ready ? "Add business context" : !startingText.trim() ? "Add text" : "Ready";
  const generateButton = <Button type="button" className={overview ? styles.overviewGenerate : styles.generate} disabled={generationDisabled} title={localPreview ? "AI generation is unavailable in this preview." : undefined} onClick={() => void generate()}>{busy ? "Generating remix…" : outcome === "uncertain" ? "Check remix result" : "Generate remix"}</Button>;
  const flow = <div className={`${styles.flow} ${overview ? styles.overviewFlow : ""}`} aria-busy={busy || loading}>
        {!draft ? <>
          <label className={styles.label}><span className={overview ? styles.srOnly : undefined}>{editorNavigation ? "Text to remix" : "Reference text"}</span>
            <textarea aria-label={editorNavigation ? "Text to remix" : "Reference text"} aria-describedby={sourceNeedsAttention ? inputHintId : undefined} className={`${styles.field} ${styles.sourceField}`} rows={3} maxLength={6000} placeholder="Add your text and any tone, language or wording preferences…" value={startingText} disabled={locked} onChange={event => changeInput({ ...input, seed: event.target.value })} />
          </label>
          {sourceNeedsAttention ? <p id={inputHintId} className={styles.notice}>{loading ? selected ? "Loading reference text…" : "Loading business context…" : "This reference has no prepared text yet. Paste its text above to remix it."}</p> : null}
          {!overview ? <div className={styles.remixFooter}>
            <div className={styles.context}>{business?.ready ? <Check size={14} aria-hidden="true" /> : null}<span>Business context</span><strong>{businessLabel}</strong><a href="/settings#business-context">{business?.ready === false ? "Add context" : "Review"}</a></div>
            {generateButton}
          </div> : null}
          {business?.ready === false ? <p className={styles.notice}>Add your business name and product description in Settings first.{overview ? <> <a className={styles.contextLink} href="/settings#business-context">Add business context</a></> : null}</p> : null}
          {overview ? generateButton : null}
          {localPreview ? null : !owner ? <p className={styles.notice}>Sign in to generate a remix.</p> : !loading && !enabled && !error ? <p className={styles.notice}>Remix generation is currently unavailable. Please try again later.</p> : null}
        </> : <div className={styles.draft}>
          <p className={styles.draftTitle} role="status">Review your remix</p>
          {format === "slideshow" || structuredWallDraft ? <><label className={styles.label}>Heading<textarea aria-label="Remixed heading" value={draft.heading} disabled={disabled} maxLength={180} rows={2} className={styles.field} onChange={event => { if (outputSource) saveReview({ ...draft, heading: event.target.value }, outputSource); }} /></label><label className={styles.label}>Body<textarea aria-label="Remixed body" value={draft.body} disabled={disabled} maxLength={format === "wall_text" ? 6000 : 600} rows={3} className={styles.field} onChange={event => { if (outputSource) saveReview({ ...draft, body: event.target.value }, outputSource); }} /></label></> : draft.blocks.map((block, i) => <label key={i} className={styles.label}>{draft.blocks.length === 1 ? "Remixed text" : `Text block ${i + 1}`}<textarea aria-label={draft.blocks.length === 1 ? "Remixed text" : `Remixed text block ${i + 1}`} value={block} disabled={disabled} maxLength={format === "wall_text" ? 6000 : 600} rows={3} className={styles.field} onChange={event => { if (outputSource) saveReview({ ...draft, blocks: draft.blocks.map((text, n) => n === i ? event.target.value : text) }, outputSource); }} /></label>)}
          {draftError ? <p role="alert" className={`${styles.notice} ${styles.error}`}>{draftError}</p> : null}
          <Button type="button" disabled={disabled || busy || Boolean(draftError)} onClick={() => { if (outputSource && onUse(validateRemixDraft(draft, outputSource), outputSource) !== false) { reset(); setMode(overview || expanded ? "reference" : "manual"); } }}>{format === "slideshow" ? "Apply to this slide" : overview ? "Apply to hook" : "Apply to this clip"}</Button>
        </div>}
        {error ? <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p> : null}
        {storageError ? <p role="status" className={styles.notice}>This draft couldn&apos;t be saved in your browser. Keep this screen open until you apply it.</p> : null}
        {error && !enabled && owner && !localPreview ? <Button type="button" variant="outline" disabled={locked || loading} onClick={() => { setError(null); setLoading(true); setLoadAttempt(n => n + 1); }}>Retry loading remix details</Button> : null}
        {outcome === "failed" || draft ? <Button type="button" variant="ghost" disabled={busy || disabled} onClick={reset}>Start a new remix</Button> : null}
      </div>;
  const manualFields = <div className={styles.manual}>{children}</div>;
  return <section className={`${styles.section} ${editorNavigation ? styles.editorSection : ""} ${prioritizeReference ? styles.referenceFirst : ""}`} aria-label="Remix Text" aria-describedby={scopeId} data-remix-text data-remix-expanded={expanded} data-remix-priority={prioritizeReference || undefined}>
    <span id={scopeId} className={styles.srOnly}>{scopeLabel}</span>
    {expanded && !overview && !prioritizeReference ? manualFields : null}
    {overview && children ? <div className={styles.manualEntry} data-remix-manual-entry>{children}</div> : null}
    {overview ? <div className={`${styles.control} ${styles.overviewControl}`} data-remix-control>
      <div className={styles.overviewHeader}>
        <span className={styles.availability} role="status">{availability}</span>
      </div>
      {flow}
    </div> : expanded ? <div className={styles.control} data-remix-control>{editorNavigation ? <div className={styles.editorRemixHeading}><h3 className={styles.trigger}>Remix text<span className={styles.hint}>{prioritizeReference ? referenceLabel : "Add your own text"}</span></h3></div> : <h3 className={styles.trigger}>Remix text<span className={styles.hint}>Optional</span></h3>}{flow}</div> : <details className={styles.control} data-remix-control open={mode === "reference"} onToggle={event => showMode(event.currentTarget.open ? "reference" : "manual")}>
      <summary className={styles.trigger} data-remix-trigger onClick={event => { if (disabled) event.preventDefault(); }} aria-disabled={disabled || undefined}>
        <span>Remix text</span><span className={styles.hint}>{busy ? "Generating…" : draft ? "Draft ready" : outcome === "uncertain" ? "Check result" : selected ? referenceLabel : "Add your own text"}</span><ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </summary>
      {flow}
    </details>}
    {prioritizeReference && children ? manualFields : null}
    {!overview && !expanded ? <div className={styles.manual} hidden={!editorNavigation && mode !== "manual"}>{children ?? <p className={styles.notice}>Write your text and choose its position in the editor.</p>}</div> : null}
  </section>;
}
