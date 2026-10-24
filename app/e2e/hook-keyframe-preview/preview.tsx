"use client";

import { useEffect, useMemo, useState } from "react";
import type { HookKeyframePreviewRuntime } from "@/components/explore/hook-starting-frame-workspace";
import { LazyHookStartingFrameWorkspace as HookStartingFrameWorkspace } from "@/components/explore/lazy-hook-starting-frame-workspace";
import { VideoGenerationStudioPanel } from "@/components/video/video-generation-workspace";
import { Button } from "@/components/ui/button";
import { ReferenceCard } from "@/components/explore/recreate-workspace";
import { createHookKeyframeDraft, hookKeyframeDraftStorageKey, serializeHookKeyframeDraft, updateHookKeyframeDraft } from "@/lib/explore/hook-keyframe-draft";
import { hookKeyframeCheckpointKey, readHookKeyframeCheckpoint, type HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import { hookKeyframeVariationsKey, readHookKeyframeVariations } from "@/lib/explore/hook-keyframe-variations";
import type { MediaAsset } from "@/lib/media/types";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import type { StartingFrameWorkflow } from "@/lib/explore/starting-frame-workflow";
import { getCuratedHookFrame } from "@/worker/src/lib/hook-curated-frames";

const scope = { ownerId: "local-ui-preview", draftId: "00000000-0000-4000-8000-000000000015",
  referenceId: "explore-paired-hook-43cc1dae0a6cfcb03e0a9333", sourceSha256: "928ee9942d157b5e22797ca819bf01e8087b9e3f6285f0f27ad26d64a6484df0" };
const curatedFrame = getCuratedHookFrame(scope.referenceId, scope.sourceSha256)!;
const photoId = "00000000-0000-4000-8000-000000000016";
const samplePhoto = "/ai-studio/creator-references/creator-01.png";
const samplePhotos = [{ url: samplePhoto, width: 275, height: 555 },
  { url: "/ai-studio/creator-references/creator-02.png", width: 275, height: 555 },
  { url: "/ai-studio/creator-references/creator-03.png", width: 941, height: 1672 }];
async function fixtureId(requestKey: string, kind: "job" | "asset") {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`local-hook-fixture:${kind}:${requestKey}`)));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const reference: RecreateReference = { id: scope.referenceId, format: "hook", title: "Hook 14", category: null, categoryLabel: null,
  durationSeconds: 8.634, slides: [], posterUrl: "/e2e/hook-keyframe-preview/scene", videoUrl: `https://example.invalid/${scope.sourceSha256}.mp4` };
const photo: MediaAsset = { id: photoId, collection: "image", sourceType: "generated_image", status: "ready", title: "Sample person",
  url: samplePhoto, thumbnailUrl: samplePhoto, width: 720, height: 1280, ratio: "9:16", mimeType: "image/png", fileName: "sample-person.png",
  fileSizeBytes: 100000, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z", metadata: {}, parentAssetId: null,
  projectId: "ui-preview", sourceRecordId: null, durationSeconds: null };
// Repeated portrait pixels exercise selection layout only, not useful supporting-view guidance.
const fixturePersonPhotos: MediaAsset[] = [photo,
  { ...photo, id: "00000000-0000-4000-8000-000000000019", title: "Layout-only supporting placeholder 1" },
  { ...photo, id: "00000000-0000-4000-8000-000000000020", title: "Layout-only supporting placeholder 2" }];
const fixtureInfluencers: MediaAsset[] = Array.from({ length: 6 }, (_, index) => ({ ...photo,
  id: `00000000-0000-4000-8000-${String(30 + index).padStart(12, "0")}`,
  title: `Sample saved influencer ${index + 1}`, url: samplePhotos[index % samplePhotos.length].url,
  thumbnailUrl: samplePhotos[index % samplePhotos.length].url,
  width: samplePhotos[index % samplePhotos.length].width, height: samplePhotos[index % samplePhotos.length].height }));

export function HookKeyframePreview({ preparationFormat = "hook" }: { preparationFormat?: StartingFrameWorkflow }) {
  const [open, setOpen] = useState(false);
  const [canResume, setCanResume] = useState(false);
  const [recentFrames, setRecentFrames] = useState<HookStartingFrameSelection[]>([]);
  const [selection, setSelection] = useState<HookStartingFrameSelection | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setCanResume(Boolean(localStorage.getItem(hookKeyframeDraftStorageKey(scope.ownerId, scope.draftId, scope.referenceId))));
    });
    return () => { active = false; };
  }, []);
  const runtime = useMemo<HookKeyframePreviewRuntime>(() => {
    const outputPreviewUrls: Record<string, string> = {};
    function savedCheckpoints() {
      const variations = readHookKeyframeVariations(localStorage.getItem(hookKeyframeVariationsKey(scope)), scope);
      if (variations) return variations.entries.filter(entry => entry.state !== "planned" && entry.state !== "rejected").map(entry => entry.checkpoint);
      const legacy = readHookKeyframeCheckpoint(localStorage.getItem(hookKeyframeCheckpointKey(scope)), scope);
      return legacy ? [legacy] : [];
    }
    async function result(checkpoint: ReturnType<typeof savedCheckpoints>[number]) {
      const [jobId, resultId] = await Promise.all([fixtureId(checkpoint.requestKey, "job"), fixtureId(checkpoint.requestKey, "asset")]);
      const index = Math.max(0, savedCheckpoints().findIndex(item => item.requestKey === checkpoint.requestKey));
      const sample = samplePhotos[index % samplePhotos.length];
      outputPreviewUrls[resultId] = sample.url;
      const frozenInput = JSON.parse(checkpoint.inputKey);
      return { jobId, resultId, width: sample.width, height: sample.height, receipt: { ...scope, version: frozenInput.version, imageModel: frozenInput.imageModel,
        promptVersion: frozenInput.version === 1 ? 1 : 4, purpose: "hook_starting_frame", inputKey: checkpoint.inputKey } };
    }
    return {
    outputPreviewUrl: samplePhoto,
    outputPreviewUrls,
    loadInfluencers: async () => ({ ok: true, images: fixtureInfluencers.map((asset, index) => ({
      jobId: `sample-influencer-${index}`, generationId: asset.id, mediaAssetId: asset.id, url: asset.url,
      prompt: "Long image-generation instructions are hidden in this photo chooser.", model: "nano_banana_2",
      createdAt: asset.createdAt, saved: true })), nextCursor: null }),
    loadSource: async ({ signal }) => {
      const response = await fetch(curatedFrame.publicPath, { signal });
      const blob = await response.blob();
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(x => x.toString(16).padStart(2, "0")).join("");
      return { referenceId: scope.referenceId, sourceSha256: scope.sourceSha256, blob, frame: { index: curatedFrame.index, timeSeconds: curatedFrame.timeSeconds, width: curatedFrame.width, height: curatedFrame.height, sha256 } };
    },
    resolvePhoto: async id => {
      const selectedPhoto = [...fixturePersonPhotos, ...fixtureInfluencers].find(item => item.id === id);
      if (!selectedPhoto) throw new Error("Unknown local preview photo.");
      return selectedPhoto;
    },
    read: async query => {
      const parameters = new URLSearchParams(query);
      if (parameters.get("cost") === "1") return { ok: true, creditCost: 1, model: parameters.get("model") };
      const checkpoints = savedCheckpoints();
      const requestKey = parameters.get("requestKey"), jobId = parameters.get("jobId");
      const checkpoint = requestKey ? checkpoints.find(item => item.requestKey === requestKey)
        : (await Promise.all(checkpoints.map(async item => ({ item, id: await fixtureId(item.requestKey, "job") })))).find(item => item.id === jobId)?.item;
      if (!checkpoint) throw new Error("Choose Generate starting image to simulate a result.");
      const existing = await result(checkpoint);
      return { ok: true, job: { id: existing.jobId, status: "completed", isTerminal: true, error: null,
        receipt: existing.receipt, output: { mediaAssetId: existing.resultId,
          url: `https://media.example.test/fixture-starting-frame-${existing.resultId}.png`, width: existing.width, height: existing.height } } };
    },
    submit: async body => {
      const checkpoint = savedCheckpoints().find(item => item.requestKey === body.idempotencyKey);
      if (!checkpoint) throw new Error("The local fixture request was not saved before submission.");
      const existing = await result(checkpoint);
      return { ok: true, status: 202, value: { ok: true, jobId: existing.jobId, generationId: existing.resultId, receipt: existing.receipt } };
    },
  }; }, []);
  function recreate() {
    const savedDraftKey = hookKeyframeDraftStorageKey(scope.ownerId, scope.draftId, scope.referenceId);
    if (!localStorage.getItem(savedDraftKey)) {
      const draft = updateHookKeyframeDraft(createHookKeyframeDraft(scope), { imageAssetIds: fixturePersonPhotos.map(item => item.id) });
      localStorage.setItem(savedDraftKey, serializeHookKeyframeDraft(draft));
    }
    setCanResume(true); setOpen(true);
  }
  return <main className="min-h-screen bg-background p-3 text-foreground sm:p-4">
    <p role="status" className="shrink-0 rounded-lg border border-primary/40 bg-card p-2 text-xs">Local UI demo · sample outputs and face photos test layout only. No AI generation, charges or production data.</p>
    <header className="flex shrink-0 items-center gap-3 py-2"><span className="text-muted">Explore /</span><h1 className="text-xl font-semibold">Hook video</h1></header>
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="min-w-0 rounded-2xl border border-border bg-card p-5"><h2 className="mb-5 font-semibold">Create</h2>
        {selection ? <VideoGenerationStudioPanel recreateView={{ preview: true, emptyContent: null, startingFrame: selection, onSelectStartingFrame: setSelection, previewStartingFrames: recentFrames, previewFaceReferenceImages: fixtureInfluencers, onClearStartingFrame: () => setSelection(null),
          workflow: { format: "hook", controlsActive: true, controlsTarget: null, resultsTarget: null, onGenerationStart: () => {} } }} /> : <p className="text-sm text-muted">Choose a Hook and select Recreate to prepare its starting frame.</p>}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-4 font-semibold">References</h2>
        <div className="w-64"><ReferenceCard reference={reference} compact showActionLabel overlayActions isSelected={canResume}
          onPreview={recreate} onRecreate={recreate} /></div>
        {canResume ? <Button className="mt-4" type="button" variant="outline" onClick={() => setOpen(true)}>Resume preparation</Button> : null}
        {selection ? <p className="mt-6 text-sm text-muted">Starting frame selected. Add optional face photos, then choose a model and duration. Paid generation is locked in this demonstration.</p> : null}
      </section>
    </div>
    {open ? <HookStartingFrameWorkspace preparationFormat={preparationFormat} presentation="recreation" reference={reference} ownerId={scope.ownerId} draftId={scope.draftId} previewRuntime={runtime}
          onClose={() => setOpen(false)} onUseStartingFrame={value => {
            const selected = { ...value, url: runtime.outputPreviewUrls?.[value.assetId] ?? samplePhoto };
            setSelection(selected); setOpen(false);
            const stored = readHookKeyframeVariations(localStorage.getItem(hookKeyframeVariationsKey(scope)), scope);
            void Promise.all((stored?.entries ?? []).flatMap(entry => entry.state === "accepted" ? [entry] : []).map(async entry => {
              const response = await runtime.read(`?jobId=${entry.checkpoint.jobId}`, new AbortController().signal) as { job: { id: string; output: { mediaAssetId: string; width: number; height: number } } };
              return { ...value, jobId: response.job.id, assetId: response.job.output.mediaAssetId, width: response.job.output.width, height: response.job.output.height,
                url: runtime.outputPreviewUrls?.[response.job.output.mediaAssetId] ?? samplePhoto };
            })).then(frames => setRecentFrames(frames.reverse())).catch(() => setRecentFrames([selected]));
          }} />
      : null}
  </main>;
}
