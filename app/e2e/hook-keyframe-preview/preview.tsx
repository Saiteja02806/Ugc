"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { HookStartingFrameWorkspace, type HookKeyframePreviewRuntime } from "@/components/explore/hook-starting-frame-workspace";
import { VideoGenerationStudioPanel } from "@/components/video/video-generation-workspace";
import { Button } from "@/components/ui/button";
import { createHookKeyframeDraft, hookKeyframeDraftStorageKey, serializeHookKeyframeDraft, updateHookKeyframeDraft } from "@/lib/explore/hook-keyframe-draft";
import { hookKeyframeCheckpointKey, readHookKeyframeCheckpoint, type HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import type { MediaAsset } from "@/lib/media/types";
import type { RecreateReference } from "@/lib/explore/recreate-types";

const scope = { ownerId: "local-ui-preview", draftId: "00000000-0000-4000-8000-000000000015",
  referenceId: "explore-paired-hook-43cc1dae0a6cfcb03e0a9333", sourceSha256: "928ee9942d157b5e22797ca819bf01e8087b9e3f6285f0f27ad26d64a6484df0" };
const photoId = "00000000-0000-4000-8000-000000000016", resultId = "00000000-0000-4000-8000-000000000017", jobId = "00000000-0000-4000-8000-000000000018";
const samplePhoto = "https://www.getugcpilot.com/ai-studio/creator-references/creator-01.png";
const reference: RecreateReference = { id: scope.referenceId, format: "hook", title: "Hook 15", category: null, categoryLabel: null,
  durationSeconds: 8.634, slides: [], posterUrl: "/e2e/hook-keyframe-preview/scene", videoUrl: `https://example.invalid/${scope.sourceSha256}.mp4` };
const photo: MediaAsset = { id: photoId, collection: "image", sourceType: "generated_image", status: "ready", title: "Sample person",
  url: samplePhoto, thumbnailUrl: samplePhoto, width: 720, height: 1280, ratio: "9:16", mimeType: "image/png", fileName: "sample-person.png",
  fileSizeBytes: 100000, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z", metadata: {}, parentAssetId: null,
  projectId: "ui-preview", sourceRecordId: null, durationSeconds: null };

export function HookKeyframePreview() {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<HookStartingFrameSelection | null>(null);
  const runtime = useMemo<HookKeyframePreviewRuntime>(() => ({
    loadSource: async signal => {
      const response = await fetch("/e2e/hook-keyframe-preview/scene", { signal });
      const blob = await response.blob();
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(x => x.toString(16).padStart(2, "0")).join("");
      return { referenceId: scope.referenceId, sourceSha256: scope.sourceSha256, blob, frame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256 } };
    },
    resolvePhoto: async () => photo,
    read: async query => {
      if (query === "?cost=1") return { ok: true, creditCost: 1, model: "nano_banana_2" };
      const checkpoint = readHookKeyframeCheckpoint(localStorage.getItem(hookKeyframeCheckpointKey(scope)), scope);
      if (!checkpoint) throw new Error("Choose Generate starting image to simulate a result.");
      return { ok: true, job: { id: jobId, status: "completed", isTerminal: true, error: null,
        receipt: { ...scope, version: 1, purpose: "hook_starting_frame", inputKey: checkpoint.inputKey },
        output: { mediaAssetId: resultId, url: samplePhoto, width: 720, height: 1280 } } };
    },
    submit: async () => {
      const checkpoint = readHookKeyframeCheckpoint(localStorage.getItem(hookKeyframeCheckpointKey(scope)), scope)!;
      return { ok: true, status: 202, value: { ok: true, jobId, generationId: resultId,
        receipt: { ...scope, version: 1, purpose: "hook_starting_frame", inputKey: checkpoint.inputKey } } };
    },
  }), []);
  function recreate() {
    const draft = updateHookKeyframeDraft(createHookKeyframeDraft(scope), { imageAssetIds: [photoId] });
    localStorage.setItem(hookKeyframeDraftStorageKey(scope.ownerId, scope.draftId, scope.referenceId), serializeHookKeyframeDraft(draft));
    localStorage.removeItem(hookKeyframeCheckpointKey(scope));
    setSelection(null); setOpen(true);
  }
  return <main className="min-h-screen bg-background p-5 text-foreground sm:p-8">
    <p role="status" className="mb-6 rounded-lg border border-primary/40 bg-card p-3 text-sm">Local UI demonstration · sample image stands in for a generated result. No AI generation, credit charge or production data is used.</p>
    <header className="mb-7 flex items-center gap-3"><span className="text-muted">Explore /</span><h1 className="text-xl font-semibold">Hook video</h1></header>
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="min-w-0 rounded-2xl border border-border bg-card p-5"><h2 className="mb-5 font-semibold">Create</h2>
        {selection ? <VideoGenerationStudioPanel recreateView={{ preview: true, emptyContent: null, startingFrame: selection, onClearStartingFrame: () => setSelection(null),
          workflow: { format: "hook", controlsActive: true, controlsTarget: null, resultsTarget: null, onGenerationStart: () => {} } }} /> : <p className="text-sm text-muted">Choose a Hook and select Recreate to prepare its starting frame.</p>}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-4 font-semibold">References</h2>
        <div className="w-64"><img src={reference.posterUrl} alt="Hook 15 original opening frame" className="h-80 w-full rounded-xl object-contain bg-background" />
          <div className="mt-4 flex items-center justify-between"><p>Hook 15 · 8.6s</p><Button type="button" onClick={recreate}>Recreate</Button></div></div>
        {selection ? <p className="mt-6 text-sm text-muted">Starting frame selected. The existing video form receives only this image, the motion directions, eight seconds and your sound choice. Paid generation is locked in this demonstration.</p> : null}
      </section>
    </div>
    {open ? <HookStartingFrameWorkspace reference={reference} ownerId={scope.ownerId} draftId={scope.draftId} previewRuntime={runtime}
      onClose={() => setOpen(false)} onUseStartingFrame={value => { setSelection(value); setOpen(false); }} /> : null}
  </main>;
}
