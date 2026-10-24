"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bookmark, Check, Star, Trash2, X } from "lucide-react";
import { useSavedCaptions } from "./use-saved-captions";
import { addSavedCaption, initialSavedCaption, MAX_SAVED_CAPTIONS, POST_CAPTION_MAX_LENGTH, removeSavedCaption } from "@/lib/scheduling/saved-captions";
import styles from "./post-caption-field.module.css";

export function PostCaptionField({ ownerId, enabled = true, value, onChange, initialized = false, description = "The caption shown below your social post.", disabled = false, name = "caption", applyDefault = true }: {
  ownerId: string | null; enabled?: boolean; value: string; onChange: (value: string) => void; initialized?: boolean; description?: string; disabled?: boolean; name?: string; applyDefault?: boolean;
}) {
  const id = useId();
  const saved = useSavedCaptions(ownerId, enabled);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const initializedHere = useRef<string | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!applyDefault || !enabled || disabled || !ownerId || !saved.library || !saved.available || initializedHere.current === ownerId) return;
    initializedHere.current = ownerId;
    const next = initialSavedCaption(saved.library, value, initialized);
    if (next !== null) onChange(next);
  }, [saved.library, saved.available, enabled, disabled, ownerId, value, initialized, onChange, applyDefault]);
  const matching = saved.library?.captions.find(caption => caption.text === value);
  const busy = disabled || saved.pending;
  async function save() {
    if (!value.trim() || value.length > POST_CAPTION_MAX_LENGTH || !saved.available || busy) return;
    const text = value;
    const first = !saved.library?.captions.length;
    const ok = await saved.change(library => addSavedCaption(library, text, crypto.randomUUID()));
    if (ok) setNotice(first ? "Caption saved as your default for new posts." : "Caption saved.");
  }
  return <section className={styles.field} aria-label="Post caption">
    <div className={styles.header}>
      <label htmlFor={id}>Post caption <span>(optional)</span></label>
      <div className={styles.actions}>
        <button type="button" onClick={() => void save()} disabled={busy || !saved.available || !value.trim() || value.length > POST_CAPTION_MAX_LENGTH || Boolean(matching) || (saved.library?.captions.length ?? 0) >= MAX_SAVED_CAPTIONS}>
          {matching ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{matching ? "Saved" : "Save caption"}
        </button>
        <button type="button" aria-expanded={expanded} aria-controls={`${id}-saved`} onClick={() => setExpanded(!expanded)} disabled={!ownerId || !enabled}>Saved captions{saved.library?.captions.length ? ` (${saved.library.captions.length})` : ""}</button>
      </div>
    </div>
    <p id={`${id}-help`} className={styles.help}>{description}</p>
    <div className={styles.input}>
      <textarea ref={input} id={id} name={name} autoComplete="off" rows={4} maxLength={POST_CAPTION_MAX_LENGTH} value={value} disabled={disabled}
        onChange={event => { initializedHere.current = ownerId; setNotice(null); onChange(event.target.value); }} placeholder="Leave blank to publish without a caption." aria-describedby={`${id}-help ${id}-count`} />
      {value ? <button type="button" className={styles.clear} aria-label="Clear post caption" title="Clear this post's caption" disabled={disabled} onClick={() => { initializedHere.current = ownerId; onChange(""); setNotice("Caption cleared for this post. Your saved captions are kept."); input.current?.focus(); }}><X aria-hidden="true" /></button> : null}
    </div>
    <div className={styles.meta}><span role="status">{notice ?? (saved.loading ? "Loading saved captions…" : "")}</span><span id={`${id}-count`}>{value.length}/{POST_CAPTION_MAX_LENGTH}</span></div>
    {saved.error ? <div role="alert" className={styles.error}>{saved.error} <button type="button" disabled={saved.pending} onClick={saved.retry}>Retry</button></div> : null}
    {expanded ? <div id={`${id}-saved`} className={styles.library}>
      <p className={styles.help}>Choose a caption to replace this post’s text. Your default fills new posts.</p>
      {!saved.loading && !saved.library?.captions.length ? <p className={styles.empty}>Write a caption above, then choose Save caption. Your first saved caption becomes the default.</p> : null}
      {saved.library?.captions.map(caption => <div key={caption.id} className={styles.saved}>
        <p>{caption.text}</p>
        <div className={styles.savedActions}>
          <button type="button" disabled={busy || !enabled} onClick={() => { initializedHere.current = ownerId; onChange(caption.text); setNotice("Saved caption applied to this post."); input.current?.focus(); }}>Use caption</button>
          <button type="button" disabled={busy || !saved.available} aria-pressed={saved.library?.defaultId === caption.id} onClick={() => void saved.change(library => ({ ...library, defaultId: library.defaultId === caption.id ? null : caption.id }))}><Star aria-hidden="true" />{saved.library?.defaultId === caption.id ? "Default" : "Make default"}</button>
          <button type="button" disabled={busy || !saved.available} aria-label={`Delete saved caption: ${caption.text.slice(0, 60)}`} title="Delete saved caption" onClick={() => void saved.change(library => removeSavedCaption(library, caption.id))}><Trash2 aria-hidden="true" /></button>
        </div>
      </div>)}
      {(saved.library?.captions.length ?? 0) >= MAX_SAVED_CAPTIONS ? <p className={styles.help}>You have 20 saved captions. Delete one to save another.</p> : null}
    </div> : null}
  </section>;
}

/** Load the default while account selection is open, before the caption step mounts. */
export function PostCaptionDefault({ ownerId, enabled, value, initialized, onChange }: { ownerId: string | null; enabled: boolean; value: string; initialized: boolean; onChange: (value: string) => void }) {
  const saved = useSavedCaptions(ownerId, enabled);
  useEffect(() => {
    if (!enabled || !saved.library || !saved.available) return;
    const next = initialSavedCaption(saved.library, value, initialized);
    if (next !== null) onChange(next);
  }, [saved.library, saved.available, enabled, value, initialized, onChange]);
  return null;
}
