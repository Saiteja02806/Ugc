"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTalkingHeadReferences, loadTalkingHeadReferenceFile } from "@/lib/explore/talking-head-reference-client";
import { talkingHeadReferenceSettings } from "@/lib/explore/talking-head-reference";
import { getVideoReferencePolicy } from "@/lib/ai-studio/video-reference-policy";
import type { WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";
import type { WorkflowSession } from "@/lib/explore/workflow-session";
import { useLocalWorkflowMedia } from "./use-local-workflow-media";

export function useTalkingHeadReference({ ownerId, enabled, session, updateSession, settings, onSettingsChange }: {
  ownerId: string | null; enabled: boolean; session: WorkflowSession;
  updateSession: (update: (previous: WorkflowSession) => WorkflowSession) => void;
  settings: WorkflowGenerationSettings; onSettingsChange: (patch: Partial<WorkflowGenerationSettings>) => void;
}) {
  const media = useLocalWorkflowMedia("video");
  const query = useQuery({ queryKey: ["talking-head-references", ownerId], enabled: Boolean(ownerId && enabled), queryFn: ({ signal }) => fetchTalkingHeadReferences(signal) });
  const [selectedId, setSelectedId] = useState(session.talkingReferenceId ?? null);
  const [instructions, setInstructions] = useState(session.referenceInstructions ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const restored = useRef<string | null>(null), revision = useRef(0), controller = useRef<AbortController | null>(null);
  useEffect(() => () => { revision.current++; controller.current?.abort(); }, []);
  const changeInstructions = (value: string) => {
    setInstructions(value); updateSession(previous => ({ ...previous, referenceInstructions: value }));
  };
  const choose = async (id: string, restore = false) => {
    const reference = query.data?.find(item => item.id === id);
    if (!reference) { setError("This reference is unavailable. Retry loading or remove it before generating."); return false; }
    const request = ++revision.current;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setPending(true); setError(null);
    try {
      const next = talkingHeadReferenceSettings(settings.model, reference.durationSeconds);
      const policy = getVideoReferencePolicy(next.model);
      const accepted = await media.chooseRemote(() => loadTalkingHeadReferenceFile(reference, abort.signal), { maxDuration: policy.maxVideoDuration, maxBytes: policy.maxVideoBytes, signal: abort.signal });
      if (request !== revision.current) return false;
      if (!accepted) { setError("Could not attach this reference. Retry or remove it before generating."); return false; }
      setSelectedId(id);
      if (!restore) setInstructions(reference.generationPrompt);
      updateSession(previous => ({ ...previous, talkingReferenceId: id, referenceInstructions: restore ? previous.referenceInstructions ?? "" : reference.generationPrompt }));
      if (!restore) onSettingsChange(next);
      return true;
    } catch (cause) {
      if (request === revision.current) setError(cause instanceof Error ? cause.message : "The reference could not load.");
      return false;
    } finally { if (request === revision.current) setPending(false); }
  };
  const restoreChoice = useRef(choose);
  useEffect(() => { restoreChoice.current = choose; });
  useEffect(() => {
    if (!selectedId || media.asset || !query.data || restored.current === selectedId) return;
    restored.current = selectedId; void restoreChoice.current(selectedId, true);
  }, [selectedId, media.asset, query.data]);
  const clearSelection = useCallback(() => {
    revision.current++; controller.current?.abort(); setSelectedId(null); setInstructions(""); setError(null); setPending(false);
    updateSession(previous => ({ ...previous, talkingReferenceId: null, referenceInstructions: "" }));
  }, [updateSession]);
  const videoReference = { ...media,
    loading: media.loading || pending || Boolean(selectedId && !media.asset && !error && !query.isError),
    error: error ?? media.error ?? (selectedId && query.isError ? "Could not restore your reference. Retry or remove it before generating." : null),
    choose: async (...args: Parameters<typeof media.choose>) => { revision.current++; controller.current?.abort(); setPending(false); const accepted = await media.choose(...args); if (accepted) clearSelection(); return accepted; },
    remove: () => { clearSelection(); media.remove(); },
  };
  return { query, selectedId, instructions, changeInstructions, choose, videoReference,
    retry: () => { if (query.isError) void query.refetch(); else if (selectedId) void choose(selectedId, true); },
  };
}
