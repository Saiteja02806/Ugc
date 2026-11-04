"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { CHARACTER_STUDIO_IMAGE_MODEL, getCharacterPromptLimit, MAX_CHARACTER_REFERENCES } from "@/lib/characters/image-models";
import {
  DEFAULT_INFLUENCER_SELECTION,
  randomizeInfluencerSelection,
  type InfluencerSelectionState,
  type InfluencerTrait,
} from "@/lib/characters/influencer-registry";
import { compileInfluencerPrompt } from "@/lib/characters/master-prompt-compiler";
import {
  orderedStudioReferences,
  studioReferenceOrderLine,
  studioReferenceSize,
  validateStudioReferenceCapacity,
} from "@/lib/characters/studio-references";
import { prepareStudioReferenceAssets } from "@/lib/characters/studio-preparation-client";
import { useCharacterBuilder } from "./use-character-builder";
import { InfluencerCustomizerDock } from "./influencer-customizer-dock";
import { InfluencerCanvas } from "./influencer-canvas";
import { CharacterHistory } from "./character-history";
import styles from "./influencer-studio.module.css";

async function studioReferenceFile(blob: Blob, filename: string) {
  const fallbackType = blob.type.startsWith("image/") ? blob.type : "image/png";
  const fallback = () => new File([blob], filename, { type: fallbackType });
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const size = studioReferenceSize(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) return fallback();
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
      if (!jpeg) return fallback();
      const base = filename.replace(/\.[^.]+$/, "") || "reference";
      return new File([jpeg], `${base}.jpg`, { type: "image/jpeg" });
    } finally {
      bitmap.close();
    }
  } catch {
    return fallback();
  }
}

export function CharacterWorkspace({ localPreview = false }: { localPreview?: boolean }) {
  const { user, loading } = useAuth();
  return (
    <CharacterSessionScreen
      key={user?.uid ?? "signed-out"}
      userId={user?.uid ?? null}
      authLoading={loading}
      localPreview={localPreview}
    />
  );
}

type CharacterScreenProps = {
  userId: string | null;
  authLoading: boolean;
  localPreview: boolean;
};

function CharacterSessionScreen(props: CharacterScreenProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [referencePending, setReferencePending] = useState(false);
  const builder = useCharacterBuilder(props.userId, historyOpen, referencePending);

  return (
    <CharacterStudioScreen
      key={builder.sessionResetVersion}
      {...props}
      builder={builder}
      historyOpen={historyOpen}
      setHistoryOpen={setHistoryOpen}
      referencePending={referencePending}
      setReferencePending={setReferencePending}
    />
  );
}

function CharacterStudioScreen({
  userId,
  authLoading,
  localPreview,
  builder,
  historyOpen,
  setHistoryOpen,
  setReferencePending,
}: CharacterScreenProps & {
  builder: ReturnType<typeof useCharacterBuilder>;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  referencePending: boolean;
  setReferencePending: (pending: boolean) => void;
}) {
  const [selection, setSelection] = useState<InfluencerSelectionState>(DEFAULT_INFLUENCER_SELECTION);
  const [customCharacters, setCustomCharacters] = useState<InfluencerTrait[]>([]);
  const faceFiles = useRef(new Map<string, File>());
  const faceAssetIds = useRef(new Map<string, string>());
  const [batchSize, setBatchSize] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingReferences, setUploadingReferences] = useState(false);
  const [savedPreviewIds, setSavedPreviewIds] = useState<Set<string>>(() => new Set());

  const handleSelectionChange = useCallback((patch: Partial<InfluencerSelectionState>) => {
    builder.touchSession();
    setSelection((prev) => ({ ...prev, ...patch }));
  }, [builder]);

  const handleUploadCharacter = useCallback((trait: InfluencerTrait, file: File) => {
    builder.touchSession();
    faceFiles.current.set(trait.id, file);
    setCustomCharacters((prev) => [...prev, trait]);
  }, [builder]);

  const handleRemoveCustomCharacter = useCallback((traitId: string) => {
    builder.touchSession();
    faceFiles.current.delete(traitId);
    faceAssetIds.current.delete(traitId);
    setCustomCharacters((prev) => prev.filter((t) => t.id !== traitId));
    setSelection((prev) => {
      if (prev.characterTypeId === traitId) {
        return { ...prev, characterTypeId: DEFAULT_INFLUENCER_SELECTION.characterTypeId };
      }
      return prev;
    });
  }, [builder]);

  const handleResetAll = useCallback(() => {
    builder.touchSession();
    setSelection(DEFAULT_INFLUENCER_SELECTION);
  }, [builder]);

  const handleRandomize = useCallback(() => {
    builder.touchSession();
    setSelection((current) => randomizeInfluencerSelection(current.framing));
  }, [builder]);

  const handleGenerate = useCallback(async () => {
    setErrorMessage(null);
    builder.generate.reset();
    builder.touchSession();

    const compiled = compileInfluencerPrompt(selection, customCharacters);
    const uploadedFaceId = customCharacters.some((character) => character.id === selection.characterTypeId)
      ? selection.characterTypeId
      : null;

    if (!userId) {
      setErrorMessage("Please sign in to generate and save your AI influencer.");
      return;
    }

    setUploadingReferences(true);
    setReferencePending(true);
    let submitted = false;
    try {
      let uploadedFaceAssetId: string | undefined;
      if (uploadedFaceId) {
        uploadedFaceAssetId = faceAssetIds.current.get(uploadedFaceId);
        if (!uploadedFaceAssetId) {
          const file = faceFiles.current.get(uploadedFaceId);
          if (!file) throw new Error("Upload the face photo again before generating.");
          const preparedFace = await studioReferenceFile(file, file.name);
          const uploaded = await uploadAIStudioReferenceMedia(preparedFace, "image", undefined, userId, { purpose: "image-library" });
          uploadedFaceAssetId = uploaded.asset.id;
          faceAssetIds.current.set(uploadedFaceId, uploadedFaceAssetId);
        }
      }
      const capacity = validateStudioReferenceCapacity(
        selection,
        customCharacters,
        Boolean(uploadedFaceAssetId),
        MAX_CHARACTER_REFERENCES
      );
      if (!capacity.valid) {
        setErrorMessage(
          `You have selected ${capacity.total} reference looks (${capacity.limit} maximum). Please remove ${
            capacity.excess === 1 ? "1 accessory or trait" : `${capacity.excess} accessories or traits`
          } before generating.`
        );
        return;
      }
      const references = capacity.references;
      const studioAssetIdList = references.length
        ? await prepareStudioReferenceAssets(userId, references.map(reference => reference.id)) : [];
      const assetIds = [...(uploadedFaceAssetId ? [uploadedFaceAssetId] : []), ...studioAssetIdList];
      const labels = [
        ...(uploadedFaceAssetId ? ["uploaded face"] : []),
        ...references.map((reference) => reference.role),
      ];
      const negativeConstraints = compiled.negativePrompt
        ? `\nNegative constraints: Avoid ${compiled.negativePrompt}.`
        : "";
      const prompt = `${compiled.prompt}${studioReferenceOrderLine(labels, selection.framing)}${negativeConstraints}`;
      if (prompt.length > getCharacterPromptLimit(CHARACTER_STUDIO_IMAGE_MODEL)) {
        setErrorMessage("This combination is too long for Gemini 3 Pro. Remove an accessory and try again.");
        return;
      }
      submitted = true;
      await builder.generate.mutateAsync({
        mode: "custom",
        model: CHARACTER_STUDIO_IMAGE_MODEL,
        imageCount: batchSize as 1 | 2 | 3,
        prompt,
        negativePrompt: compiled.negativePrompt,
        selection,
        idempotencyKey: crypto.randomUUID(),
        ...(assetIds.length > 1 ? { referenceImageAssetIds: assetIds } : {}),
        ...(assetIds.length === 1 ? { referenceImageAssetId: assetIds[0] } : {}),
      });
    } catch (error) {
      if (!submitted) {
        setErrorMessage(error instanceof Error ? error.message : "The selected looks could not be attached.");
      }
    } finally {
      setUploadingReferences(false);
      setReferencePending(false);
    }
  }, [userId, builder, selection, customCharacters, batchSize, setReferencePending]);

  const handleSaveCharacter = useCallback(
    (jobId: string) => {
      if (!userId) {
        if (localPreview) {
          setSavedPreviewIds((prev) => new Set([...prev, jobId]));
          return;
        }
        setErrorMessage("Please sign in to save your character.");
        return;
      }
      builder.select.mutate(jobId);
    },
    [userId, localPreview, builder]
  );

  const isBusy = builder.generate.isPending || builder.inProgress || builder.restoring || uploadingReferences;

  const historyImages = builder.history.data?.pages.flatMap((page) => page.images) ?? [];

  const savedCharacterIds = new Set<string>([
    ...(builder.characters.data?.characters.map((c) => c.id) ?? []),
    ...savedPreviewIds,
  ]);

  const access = builder.access.data?.access;
  const generateBlocked = Boolean(userId && access && batchSize > access.affordableImageCount);
  const visitJobIds = new Set(builder.visibleJobs.map((job) => job.jobId));
  const sessionJobs = (builder.visibleStatuses ?? []).filter((job) => builder.historyImage || visitJobIds.has(job.id));
  const activeCanvasJobs = sessionJobs;

  return (
    <div className={styles.studioRoot}>
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-800 text-red-200 px-4 py-2.5 text-xs flex justify-between items-center z-50">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="text-red-400 hover:text-white font-bold ml-4"
            onClick={() => setErrorMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {builder.generate.error && (
        <div className="bg-amber-950/80 border-b border-amber-800 text-amber-200 px-4 py-2.5 text-xs flex justify-between items-center z-50">
          <span>{builder.generate.error.message}</span>
          <button
            type="button"
            className="text-amber-400 hover:text-white font-bold ml-4"
            onClick={() => builder.generate.reset()}
          >
            ×
          </button>
        </div>
      )}

      <header className={styles.studioHeader}>
        <Link href={localPreview ? "/explore?preview=1" : "/explore"} className={styles.studioBack}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Link>
        <h1 className={styles.studioTitle}>AI character influencer</h1>
        <button type="button" className={styles.studioHistory} onClick={() => setHistoryOpen(true)}>
          <History aria-hidden="true" />
          History
        </button>
      </header>

      <div className={styles.studioLayout}>
        {/* Left Customizer Dock */}
        <InfluencerCustomizerDock
          selection={selection}
          onSelectionChange={handleSelectionChange}
          onResetAll={handleResetAll}
          onRandomize={handleRandomize}
          batchSize={batchSize}
          onBatchSizeChange={setBatchSize}
          isGenerating={isBusy}
          onGenerate={() => void handleGenerate()}
          maxBatchSize={access?.affordableImageCount ?? 3}
          availabilityMessage={generateBlocked ? access?.message : null}
          generateDisabled={generateBlocked}
          disabled={isBusy}
          customCharacters={customCharacters}
          onUploadCharacter={handleUploadCharacter}
          onRemoveCustomCharacter={handleRemoveCustomCharacter}
        />

        {/* Center Workspace Canvas */}
        <InfluencerCanvas
          userId={userId}
          selection={selection}
          activeJobs={activeCanvasJobs}
          isGenerating={isBusy}
          onSaveCharacter={handleSaveCharacter}
          savingJobId={builder.select.isPending ? String(builder.select.variables) : null}
          onReturnToSession={builder.historyImage ? builder.returnToSession : undefined}
          savedCharacterIds={savedCharacterIds}
          customCharacters={customCharacters}
        />
      </div>

      {/* History Slide-Out Drawer */}
      <CharacterHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        images={historyImages}
        selectedJobId={builder.historyImage?.jobId ?? null}
        onSelect={(image) => {
          builder.openHistoryImage(image);
          setHistoryOpen(false);
        }}
        loading={Boolean(userId) && builder.history.isFetching && historyImages.length === 0}
        error={builder.history.error}
        onRetry={() => void builder.history.refetch()}
        hasMore={Boolean(builder.history.hasNextPage)}
        loadingMore={builder.history.isFetchingNextPage}
        onLoadMore={() => void builder.history.fetchNextPage()}
        signedIn={Boolean(userId)}
        busy={isBusy}
      />
    </div>
  );
}
