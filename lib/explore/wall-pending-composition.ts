import { isExploreUuid, parseExploreFinishDraft, type ExploreFinishDraft } from "../../worker/src/lib/explore-finishing-contract.ts";
import type { ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import type { ExploreScheduleComposition } from "./pending-schedule-client.ts";

type WallClipSnapshot = {
  sourceId: string;
  editing: ExploreFormatEdit;
  busy: boolean;
  error: string | null;
  retryLoad?: () => void;
  backgroundAssetId?: string | null;
  backgroundPlayback?: "once" | "repeat";
};

/** The same single-clip draft used by export, frozen before schedule confirmation. */
export function createWallScheduleComposition({ ownerId, sourceAssetId, title, clip, pendingSource, selectionError, currentSignature }: {
  ownerId: string | null;
  sourceAssetId: string | null;
  title: string;
  clip: WallClipSnapshot | null;
  pendingSource: boolean;
  selectionError?: string | null;
  currentSignature?: () => string | null;
}): ExploreScheduleComposition {
  let draft: ExploreFinishDraft | null = null;
  let error = !ownerId ? "Sign in before scheduling." :
    pendingSource || clip?.busy ? "Wait for your selected video and audio to finish loading or saving." :
    selectionError || (!sourceAssetId || !isExploreUuid(sourceAssetId) ? "Choose a saved video before scheduling." :
      !clip || clip.sourceId !== sourceAssetId ? "Loading the selected video's edit settings…" : clip.error);
  if (!error && clip) try {
    if (clip.editing.format !== "wall_text") throw new Error("Review the Wall of text edit settings before scheduling.");
    draft = parseExploreFinishDraft({ version: 1, kind: "hook", sourceAssetId,
      demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once", subtitles: null,
      backgroundAssetId: clip.backgroundAssetId ?? null,
      backgroundPlayback: clip.backgroundAssetId ? clip.backgroundPlayback ?? "once" : "once",
      editing: clip.editing });
  } catch (e) { error = e instanceof Error ? e.message : "Review the selected video before scheduling."; }
  const signature = JSON.stringify([ownerId, sourceAssetId, draft, error]);
  return { signature, sourceId: sourceAssetId ?? "", title, draft, error, retryLoad: error ? clip?.retryLoad : undefined,
    resolve: async () => {
      if (currentSignature && currentSignature() !== signature) throw new Error("Your video or audio changed. Review the updated video before scheduling.");
      if (error || !draft) throw new Error(error ?? "Choose a saved video before scheduling.");
      return draft;
    } };
}
