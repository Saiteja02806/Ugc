"use client";

import { useLayoutEffect, useRef } from "react";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { loadWorkflowDefaultMusic } from "@/lib/explore/workflow-default-music-client";
import { getReferenceAudioPreview } from "@/lib/explore/reference-audio-preview";
import { trimmedDemoFraming } from "@/lib/explore/format-demo";
import { parseExploreFinishDraft, type DemoFraming, type ExploreClipComposition } from "@/worker/src/lib/explore-finishing-contract";
import type { ExploreScheduleComposition } from "@/lib/explore/pending-schedule-client";
import type { LocalWorkflowMedia } from "./use-local-workflow-media";
import type { MediaAsset } from "@/lib/media/types";
import type { FinishingOptions } from "./use-workflow-finishing";
import type { ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";

/** A provisional draft enables review; resolve snapshots every owned upload
 * before confirmation. A changed selection never reuses an older upload. */
export function useTalkingHeadPendingComposition({ owner, kind, source, demo, demoSource, demoAudio, playback,
  composition, demoAudioAssetId = null, framing, options, backgroundSource = null, backgroundPlayback = "repeat", captionDraft, captionsReady, selectionError }: {
  owner: string | null; kind: "hook" | "phone"; source: MediaAsset | null;
  demo: LocalWorkflowMedia | null; demoSource?: MediaAsset | null; demoAudio: LocalWorkflowMedia | null;
  playback: "once" | "repeat"; demoAudioAssetId?: string | null; composition?: ExploreClipComposition; framing?: DemoFraming | null;
  options: FinishingOptions; captionDraft: ExploreFinishDraft | null; captionsReady: boolean; selectionError?: string | null;
  backgroundSource?: MediaAsset | null; backgroundPlayback?: "once" | "repeat";
}): ExploreScheduleComposition {
  const uploads = useRef(new Map<File, string>()), defaultMusic = useRef<{ id: string; playback: "once" | "repeat" } | null>(null);
  const active = useRef(true);
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const signature = JSON.stringify([owner, kind, source?.id, demo?.url, demoSource?.id, demoAudio?.url, playback, composition, demoAudioAssetId, framing, options, backgroundSource?.id, backgroundPlayback, captionDraft, captionsReady, selectionError]);
  const current = useRef(signature);
  useLayoutEffect(() => { current.current = signature; }, [signature]);
  let draft: ExploreFinishDraft | null = null;
  let error = selectionError ?? (demoAudioAssetId && demoAudio ? "Choose one demo audio track before scheduling." : null) ?? (!source ? "Choose a ready talking-head video before scheduling." : null);
  if (!error && options.subtitles && !captionsReady) error = "Generate and review captions for these clips before scheduling.";
  try {
    const knownDemoAudioId = demoAudioAssetId ?? (demoAudio ? captionDraft?.demoAudioAssetId : null) ?? null;
    if (source) draft = parseExploreFinishDraft({ version: 1, kind, sourceAssetId: source.id,
      demoAssetId: demoSource?.id ?? (demo ? captionDraft?.demoAssetId : null) ?? null, demoAudioAssetId: knownDemoAudioId, demoAudioPlayback: knownDemoAudioId ? playback : "once",
      backgroundAssetId: options.backgroundMusic ? backgroundSource?.id ?? captionDraft?.backgroundAssetId ?? null : null,
      backgroundPlayback: options.backgroundMusic ? backgroundSource ? backgroundPlayback : captionDraft?.backgroundPlayback ?? "once" : "once",
      subtitles: options.subtitles ? { language: "en", version: 2, style: options.style, placement: options.placement ?? "bottom",
        ...(options.corrections?.length ? { corrections: options.corrections } : {}) } : null,
      ...(composition ? { composition: { ...composition, demoEditing: demoSource || demo && captionDraft?.demoAssetId ? composition.demoEditing : null } } : {}),
      ...(framing && (demoSource || demo && captionDraft?.demoAssetId) ? { demoFraming: composition?.demoEditing ? trimmedDemoFraming(framing, composition.demoEditing) : framing } : {}) });
  } catch (e) { error ??= e instanceof Error ? e.message : "Review the clip settings."; }
  return { signature, sourceId: source?.id ?? "", title: source?.title ?? "Talking-head video", draft, error,
    resolve: async () => {
      const assertCurrent = () => { if (!active.current || current.current !== signature) throw new Error("Your clips changed. Review the updated video before scheduling."); };
      assertCurrent();
      if (error || !draft || !owner) throw new Error(error ?? "Sign in and choose a ready video.");
      const upload = async (media: LocalWorkflowMedia | null, collection: "video" | "audio") => {
        if (!media) return null;
        if (!media.file) throw new Error(`Choose the ${collection} file again before scheduling.`);
        const cached = uploads.current.get(media.file); if (cached) return cached;
        const result = await uploadAIStudioReferenceMedia(media.file, collection, 120, owner, { maxAudioDurationSeconds: 600, requireVideoReferenceRatio: false, purpose: "explore-demo" });
        assertCurrent(); uploads.current.set(media.file, result.asset.id); return result.asset.id;
      };
      const demoAssetId = demoSource?.id ?? (demo ? captionDraft?.demoAssetId : null) ?? await upload(demo, "video");
      const ownedDemoAudioId = demoAudioAssetId ?? (demoAudio ? captionDraft?.demoAudioAssetId : null) ?? await upload(demoAudio, "audio");
      let backgroundAssetId = draft.backgroundAssetId, backgroundPlayback = draft.backgroundPlayback;
      if (options.backgroundMusic && !backgroundAssetId && !getReferenceAudioPreview(source)) {
        if (!defaultMusic.current) {
          const music = await loadWorkflowDefaultMusic({ token: () => getCurrentUserIdToken(owner), fetch, assertActive: assertCurrent });
          const result = await uploadAIStudioReferenceMedia(music.file, "audio", 120, owner, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
          assertCurrent(); defaultMusic.current = { id: result.asset.id, playback: music.playback };
        }
        backgroundAssetId = defaultMusic.current.id; backgroundPlayback = defaultMusic.current.playback;
      }
      assertCurrent();
      return parseExploreFinishDraft({ ...draft, demoAssetId, demoAudioAssetId: ownedDemoAudioId, demoAudioPlayback: ownedDemoAudioId ? playback : "once", backgroundAssetId, backgroundPlayback,
        ...(composition ? { composition } : {}),
        ...(framing && demoAssetId ? { demoFraming: composition?.demoEditing ? trimmedDemoFraming(framing, composition.demoEditing) : framing } : {}) });
    } };
}
