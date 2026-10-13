"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { RecreateReference, RecreateFormat } from "@/lib/explore/recreate-types";
import { ReferenceTextSchema, RemixRequestSchema, remixSourceMatches, validateRemixDraft, validateRemixOutput, type ReferenceText, type RemixOutput, type RemixRequest } from "@/lib/explore/reference-text";
import { readRemixTextDraft } from "@/lib/explore/remix-text-draft";
import styles from "./remix-text-section.module.css";

type Props = {
  owner: string | null; targetKey: string; format: RecreateFormat;
  reference?: RecreateReference | null; previewSource?: ReferenceText | null;
  defaultSlideId?: string | null; disabled?: boolean; localPreview?: boolean;
  onUse: (output: RemixOutput, source: ReferenceText) => void | boolean;
  children?: ReactNode;
  overview?: boolean;
};

/** Clip, account and reference changes discard late replies and scope draft recovery. */
export function RemixTextSection(props: Props) {
  return <RemixTextControl key={`${props.owner}:${props.targetKey}:${props.format}:${props.reference?.id}:${props.defaultSlideId}`} {...props} />;
}

function RemixTextControl({ owner, targetKey, format, reference, previewSource, defaultSlideId, disabled, localPreview, onUse, children, overview = false }: Props) {
  const selected = reference?.format === format && !reference.id.startsWith("uploaded:") ? reference : null;
  const selection = { referenceId: selected?.id ?? null, slideId: format === "slideshow" ? selected ? selected.slides.find(s => s.id === defaultSlideId)?.id ?? null : defaultSlideId ?? null : null };
  const requestStorageKey = `ugc-explore:remix-request:v2:${owner}:${format}:${targetKey}:${selection.referenceId ?? ""}:${selection.slideId}`;
  const inputStorageKey = `${requestStorageKey}:input`;
  const [recovery] = useState(() => {
    try {
      if (!owner || localPreview) return null;
      const saved = readRemixTextDraft(localStorage.getItem(requestStorageKey)) ?? readRemixTextDraft(localStorage.getItem(`ugc-explore:remix-request:v1:${owner}:${format}:${targetKey}`));
      return saved?.referenceId === selection.referenceId && saved.slideId === selection.slideId && (!saved.format || saved.format === format) ? saved : null;
    } catch { return null; }
  });
  const [input, setInput] = useState<{ seed: string | null; instructions: string }>(() => {
    if (recovery) return { seed: recovery.referenceBlocks?.join("\n\n") ?? null, instructions: recovery.instructions };
    try {
      const raw = owner && !localPreview ? localStorage.getItem(inputStorageKey) : null;
      const saved = raw && raw.length < 14000 ? JSON.parse(raw) : null;
      if (typeof saved?.seed === "string" && saved.seed.length <= 6000 && typeof saved.instructions === "string" && saved.instructions.length <= 2000) return { seed: saved.seed, instructions: saved.instructions };
    } catch { /* An unavailable local draft does not prevent editing. */ }
    return { seed: null, instructions: "" };
  });
  const [optionsOpen, setOptionsOpen] = useState(() => Boolean(input.instructions.trim()));
  const [mode, setMode] = useState<"manual" | "reference">(overview || recovery ? "reference" : "manual");
  const [source, setSource] = useState<ReferenceText | null>(() => recovery?.source ?? (localPreview && previewSource && remixSourceMatches(previewSource, selection, format) ? previewSource : null));
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(Boolean((overview || recovery) && owner && !localPreview));
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
  const optionsId = useId();
  const selectedId = selected?.id;
  const startingText = input.seed ?? (source?.status === "ready" ? source.blocks.map(block => block.text).join("\n\n") : "");
  const scopeLabel = format === "slideshow" ? "Applies to this slide only." : "Only this clip. The demo stays unchanged.";
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
          const next = data.source === null ? null : ReferenceTextSchema.parse(data.source);
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
      const candidate = RemixRequestSchema.safeParse({ requestKey: crypto.randomUUID(), ...selection, format, instructions: input.instructions,
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
      setOutputSource(original); saveReview(next, original);
    } catch (e) {
      if (alive.current && generation.current === current) { setError(e instanceof Error ? e.message : "Could not confirm the remix. Check its result again."); setOutcome(value => value ?? "uncertain"); }
    } finally { if (alive.current && generation.current === current) setBusy(false); }
  }
  const locked = disabled || busy || outcome === "uncertain";
  const generationDisabled = disabled || busy || loading || !owner || !enabled || localPreview || Boolean(draft) || outcome !== "uncertain" && (!startingText.trim() || !business?.ready) || outcome === "failed";
  let draftError: string | null = null;
  if (draft && outputSource) try { validateRemixDraft(draft, outputSource); } catch { draftError = "Keep every text block nonempty and within its character limit."; }
  function showMode(next: "manual" | "reference") {
    if (next === mode) return;
    setMode(next);
    if (next === "reference") setLoading(Boolean(owner && !localPreview && !(format === "slideshow" && selectedId && !selection.slideId)));
  }
  const instructionField = <label className={styles.label}>Remix instructions
    <textarea aria-label="Remix instructions" placeholder="For example: use a friendly tone, keep it in English, avoid emojis…" value={input.instructions} disabled={locked} rows={2} maxLength={2000} onChange={event => changeInput({ ...input, instructions: event.target.value })} className={styles.field} />
  </label>;
  const availability = busy ? "Generating…" : draft ? "Draft ready" : outcome === "uncertain" ? "Check result" : localPreview ? "Preview" : !owner ? "Sign in" : loading ? "Loading…" : !enabled ? "Unavailable" : outcome === "failed" ? "Start a new remix" : !business?.ready ? "Add business context" : !startingText.trim() ? "Add text" : "Ready";
  const generateButton = <Button type="button" className={overview ? styles.overviewGenerate : styles.generate} disabled={generationDisabled} title={localPreview ? "AI generation is unavailable in this preview." : undefined} onClick={() => void generate()}>{busy ? "Generating remix…" : outcome === "uncertain" ? "Check remix result" : "Generate remix"}</Button>;
  const flow = <div className={`${styles.flow} ${overview ? styles.overviewFlow : ""}`} aria-busy={busy || loading}>
        {!draft ? <>
          <label className={styles.label}><span className={overview ? styles.srOnly : undefined}>Reference text</span>
            <textarea aria-label="Reference text" aria-describedby={inputHintId} className={`${styles.field} ${styles.sourceField}`} rows={3} maxLength={6000} placeholder="Paste a hook, describe your idea, or edit the reference text…" value={startingText} disabled={locked} onChange={event => changeInput({ ...input, seed: event.target.value })} />
          </label>
          <p id={inputHintId} className={overview && !loading ? styles.srOnly : styles.notice}>{loading ? "Loading reference text…" : "Use the reference or enter your own details."}</p>
          {!overview ? <div className={styles.context}>{business?.ready ? <Check size={14} aria-hidden="true" /> : null}<span>Business context</span><strong>{business?.name ?? "Saved in Settings"}</strong><a href="/settings#business-context">{business?.ready === false ? "Add context" : "Review"}</a></div> : null}
          {business?.ready === false ? <p className={styles.notice}>Add your business name and product description in Settings first.{overview ? <> <a className={styles.contextLink} href="/settings#business-context">Add business context</a></> : null}</p> : null}
          {overview ? <>
            <div id={optionsId} className={styles.overviewOptions} hidden={!optionsOpen}>
              {instructionField}
              <p className={styles.notice}>Optional guidance for tone, language or what to avoid.</p>
            </div>
            <div className={styles.overviewActions}>
              <Button type="button" variant="ghost" className={styles.optionsToggle} aria-label="Remix options" aria-controls={optionsId} aria-expanded={optionsOpen} onClick={() => setOptionsOpen(open => !open)}>Options{input.instructions.trim() ? <span className={styles.optionSet}>Set</span> : null}<ChevronDown size={14} aria-hidden="true" /></Button>
              {generateButton}
            </div>
          </> : <>
            <details className={styles.option} open={Boolean(recovery?.instructions)}><summary>Additional instructions <span>Optional</span></summary>{instructionField}</details>
            {generateButton}
          </>}
          {localPreview ? !overview ? <p className={styles.notice}>Local preview · AI generation is disabled.</p> : null : !owner ? <p className={styles.notice}>Sign in to generate a remix.</p> : !loading && !enabled && !error ? <p className={styles.notice}>Remix generation is currently unavailable. Please try again later.</p> : null}
        </> : <div className={styles.draft}>
          <p className={styles.draftTitle} role="status">Review your remix</p>
          {format === "slideshow" ? <><label className={styles.label}>Heading<textarea aria-label="Remixed heading" value={draft.heading} disabled={disabled} maxLength={180} rows={2} className={styles.field} onChange={event => { if (outputSource) saveReview({ ...draft, heading: event.target.value }, outputSource); }} /></label><label className={styles.label}>Body<textarea aria-label="Remixed body" value={draft.body} disabled={disabled} maxLength={600} rows={3} className={styles.field} onChange={event => { if (outputSource) saveReview({ ...draft, body: event.target.value }, outputSource); }} /></label></> : draft.blocks.map((block, i) => <label key={i} className={styles.label}>{draft.blocks.length === 1 ? "Remixed text" : `Text block ${i + 1}`}<textarea aria-label={draft.blocks.length === 1 ? "Remixed text" : `Remixed text block ${i + 1}`} value={block} disabled={disabled} maxLength={600} rows={3} className={styles.field} onChange={event => { if (outputSource) saveReview({ ...draft, blocks: draft.blocks.map((text, n) => n === i ? event.target.value : text) }, outputSource); }} /></label>)}
          {draftError ? <p role="alert" className={`${styles.notice} ${styles.error}`}>{draftError}</p> : null}
          <Button type="button" disabled={disabled || busy || Boolean(draftError)} onClick={() => { if (outputSource && onUse(validateRemixDraft(draft, outputSource), outputSource) !== false) { reset(); setMode(overview ? "reference" : "manual"); } }}>{format === "slideshow" ? "Apply to this slide" : overview ? "Apply to hook" : "Apply to this clip"}</Button>
        </div>}
        {!overview ? <p className={styles.scope}>{scopeLabel}</p> : null}
        {error ? <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p> : null}
        {storageError ? <p role="status" className={styles.notice}>This draft couldn&apos;t be saved in your browser. Keep this screen open until you apply it.</p> : null}
        {error && !enabled && owner && !localPreview ? <Button type="button" variant="outline" disabled={locked || loading} onClick={() => { setError(null); setLoading(true); setLoadAttempt(n => n + 1); }}>Retry loading remix details</Button> : null}
        {outcome === "failed" || draft ? <Button type="button" variant="ghost" disabled={busy || disabled} onClick={reset}>Start a new remix</Button> : null}
      </div>;
  return <section className={styles.section} aria-label="Remix Text" data-remix-text>
    {overview && children ? <div className={styles.manualEntry} data-remix-manual-entry>{children}</div> : null}
    {overview ? <div className={`${styles.control} ${styles.overviewControl}`} data-remix-control>
      <div className={styles.overviewHeader}>
        <span className={styles.availability} role="status">{availability}</span>
      </div>
      {flow}
    </div> : <details className={styles.control} data-remix-control open={mode === "reference"} onToggle={event => showMode(event.currentTarget.open ? "reference" : "manual")}>
      <summary className={styles.trigger} data-remix-trigger onClick={event => { if (disabled) event.preventDefault(); }} aria-disabled={disabled || undefined}>
        <span>Remix text</span><span className={styles.hint}>{busy ? "Generating…" : draft ? "Draft ready" : outcome === "uncertain" ? "Check result" : "Optional"}</span><ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </summary>
      {flow}
    </details>}
    {!overview ? <div className={styles.manual} hidden={mode !== "manual"}>{children ?? <p className={styles.notice}>Write your text and choose its position in the editor.</p>}</div> : null}
  </section>;
}
