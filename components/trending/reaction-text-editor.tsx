"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchReactionTextEdit } from "@/lib/trending/reaction-edit-client";
import { ReactionTextEditRequestSchema, type ReactionTextEditRecord } from "@/lib/trending/reaction-edit-contract";
import type { TrendingReactionFeedItem } from "@/lib/trending/feed-items";

export function ReactionTextEditor({ item, onClose, onUpdated }: {
  item: TrendingReactionFeedItem;
  onClose: () => void;
  onUpdated: (edit: ReactionTextEditRecord) => void;
}) {
  const [edit, setEdit] = useState<ReactionTextEditRecord | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updatedRef = useRef(onUpdated);
  useEffect(() => { updatedRef.current = onUpdated; }, [onUpdated]);
  const preparing = edit?.state === "preparing";
  const { assignmentId, creativeId } = item;

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let initialized = false;
    async function refresh() {
      try {
        const result = await fetchReactionTextEdit({ assignmentId, creativeId }, undefined, controller.signal);
        if (controller.signal.aborted) return;
        setEdit(result);
        setError(null);
        if (!initialized) setText(result.text);
        initialized = true;
        updatedRef.current(result);
        if (result.state === "preparing") timer = setTimeout(refresh, 2500);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not refresh this Reaction Reel.");
          timer = setTimeout(refresh, 5000);
        }
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [assignmentId, creativeId, preparing]);

  async function save() {
    if (!edit || saving || preparing) return;
    const input = ReactionTextEditRequestSchema.safeParse({ assignmentId: item.assignmentId, expectedUpdatedAt: edit.expectedUpdatedAt, text });
    if (!input.success) { setError("Use 5–20 words across up to three lines."); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await fetchReactionTextEdit(item, input.data);
      setEdit(result);
      updatedRef.current(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this edit.");
      // A save may persist before queue delivery fails. Reload its durable
      // revision so Retry cannot remain stuck on an old timestamp.
      const result = await fetchReactionTextEdit(item).catch(() => null);
      if (result) { setEdit(result); updatedRef.current(result); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Reaction Reel text</DialogTitle>
          <DialogDescription>Update the on-screen text. Your reaction clip, background, and text style stay the same.</DialogDescription>
        </DialogHeader>
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
              <video key={edit.previewUrl} src={edit.previewUrl} className="size-full object-cover" autoPlay muted loop playsInline controls aria-label="Reaction Reel preview" />
              {preparing ? <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-sm text-white"><Loader2 className="size-5 animate-spin" />Preparing video</div> : null}
            </div>
            <div className="space-y-2">
              <label htmlFor="reaction-reel-text" className="text-sm font-medium">On-screen text</label>
              <textarea id="reaction-reel-text" value={text} onChange={(event) => setText(event.target.value)} disabled={saving || preparing} rows={6} maxLength={300} className="w-full resize-none rounded-lg border bg-background p-3 text-sm disabled:opacity-60" aria-describedby="reaction-reel-text-help" />
              <p id="reaction-reel-text-help" className="text-xs text-muted-foreground">5–20 words, up to three lines. Save to prepare the updated video.</p>
              {edit.state === "failed" ? <p role="alert" className="text-sm text-destructive">Video preparation failed. Save again to retry.</p> : null}
            </div>
          </div>
        ) : <p role="status" className="py-8 text-center text-sm">Loading text…</p>}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
          <Button onClick={() => void save()} disabled={!edit || saving || preparing || (edit.state === "ready" && text.trim() === edit.text.trim())}>
            {saving ? "Saving…" : preparing ? "Preparing video…" : "Save text"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
