"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { characterSessionStorageKey, EMPTY_CHARACTER_SESSION, parseCharacterClientSession,
  type CharacterClientSession } from "@/lib/characters/client-session";
import type { PublicCharacter } from "@/lib/characters/identity-service";
import type { CharacterGenerateRequest, CharacterGenerationAccess, CharacterGenerationResponse, CharacterHistoryImage, CharacterHistoryPage, CharacterJobReceipt,
  CharacterJobStatusResponse } from "@/lib/characters/types";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";

export async function characterRequest<T>(userId: string | null, path: string, options: RequestInit = {}): Promise<T> {
  if (!userId) throw Object.assign(new Error("Sign in to create and save your influencer."), { status: 401 });
  const token = await getCurrentUserIdToken(userId);
  if (!token) throw Object.assign(new Error("Sign in to create and save your influencer."), { status: 401 });
  const response = await fetch(path, {
    ...options, cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || data?.message || "Could not complete this request. Try again.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data as T;
}

export function useCharacterBuilder(userId: string | null, historyOpen = false) {
  const client = useQueryClient();
  const generationFlight = useRef<Promise<CharacterGenerationResponse> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const sessionKey = ["character-session", userId] as const;
  const charactersKey = ["characters", userId] as const;
  const accessKey = ["character-access", userId] as const;
  const historyKey = ["character-history", userId] as const;
  // Foreground images belong to this mounted visit, not the durable recovery
  // receipt. Only an unfinished cached batch is resumed automatically.
  const [foregroundJobs, setForegroundJobs] = useState<CharacterJobReceipt[]>(() => {
    const restored = client.getQueryData<CharacterClientSession>(sessionKey)?.jobs ?? [];
    const statuses = client.getQueryData<CharacterJobStatusResponse["job"][]>(["character-jobs", userId, restored.map((job) => job.jobId)]);
    return statuses?.some((job) => !job.isTerminal) ? restored : [];
  });
  const [historyImage, setHistoryImage] = useState<CharacterHistoryImage | null>(null);
  const sessionQuery = useQuery({
    queryKey: sessionKey, enabled: Boolean(userId), staleTime: Infinity,
    queryFn: () => {
      try { return parseCharacterClientSession(localStorage.getItem(characterSessionStorageKey(userId!))); }
      catch { return EMPTY_CHARACTER_SESSION; }
    },
  });
  const session = sessionQuery.data ?? EMPTY_CHARACTER_SESSION;
  function updateSession(patch: Partial<CharacterClientSession>) {
    const current = client.getQueryData<CharacterClientSession>(sessionKey) ?? EMPTY_CHARACTER_SESSION;
    const next = { ...current, ...patch };
    client.setQueryData(sessionKey, next);
    if (userId) {
      try { localStorage.setItem(characterSessionStorageKey(userId), JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
    }
  }

  const characters = useQuery({
    queryKey: charactersKey, enabled: Boolean(userId), retry: 1,
    queryFn: ({ signal }) => characterRequest<{ ok: true; characters: PublicCharacter[] }>(userId, "/api/characters", { signal }),
  });
  const access = useQuery({
    queryKey: accessKey, enabled: Boolean(userId), retry: 1,
    queryFn: ({ signal }) => characterRequest<{ ok: true; access: CharacterGenerationAccess }>(userId, "/api/characters/access", { signal }),
  });
  const history = useInfiniteQuery({
    queryKey: historyKey, enabled: Boolean(userId && historyOpen), retry: 1,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => characterRequest<CharacterHistoryPage>(userId,
      `/api/characters/history${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const jobs = useQuery({
    queryKey: ["character-jobs", userId, session.jobs.map((job) => job.jobId)],
    enabled: Boolean(userId && session.jobs.length), retry: 2,
    queryFn: async ({ signal }) => {
      const checks = await Promise.allSettled(session.jobs.map(async (job) =>
        (await characterRequest<CharacterJobStatusResponse>(userId, `/api/characters/status?jobId=${job.jobId}`, { signal })).job));
      if (checks.every((check) => check.status === "rejected")) {
        throw (checks[0] as PromiseRejectedResult).reason;
      }
      const results = checks.map((check, index) => {
        if (check.status === "fulfilled") return { ...check.value, checkError: null };
        const previous = client.getQueryData<Array<CharacterJobStatusResponse["job"] & { checkError: string | null }>>([
          "character-jobs", userId, session.jobs.map((job) => job.jobId),
        ])?.find((job) => job.id === session.jobs[index].jobId);
        return {
          ...(previous ?? { id: session.jobs[index].jobId, status: "queued" as const, isTerminal: false, error: null, output: null }),
          checkError: "Could not check this candidate. Trying again…",
        };
      });
      if (results.every((job) => job.isTerminal)) {
        void client.invalidateQueries({ queryKey: accessKey });
        void client.invalidateQueries({ queryKey: ["billing-subscription", userId] });
        void client.invalidateQueries({ queryKey: historyKey });
      } else if (mounted.current && !signal.aborted && results.some((job) => !job.isTerminal && !job.checkError)) {
        const latest = client.getQueryData<CharacterClientSession>(sessionKey);
        if (JSON.stringify(latest?.jobs) === JSON.stringify(session.jobs)) setForegroundJobs(session.jobs);
      }
      return results;
    },
    refetchInterval: (query) => query.state.error ? false : query.state.data?.every((job) => job.isTerminal) ? false : 2_500,
    refetchOnWindowFocus: true,
  });

  const generate = useMutation({
    mutationFn: (request: CharacterGenerateRequest) => {
      if (generationFlight.current) return generationFlight.current;
      updateSession({ pendingRequest: request });
      const flight = characterRequest<CharacterGenerationResponse>(userId, "/api/characters/generate", {
        method: "POST", body: JSON.stringify(request),
      }).finally(() => { generationFlight.current = null; });
      generationFlight.current = flight;
      return flight;
    },
    onSuccess: (result) => {
      updateSession({ jobs: result.jobs, pendingRequest: null });
      if (mounted.current) { setForegroundJobs(result.jobs); setHistoryImage(null); }
      void client.invalidateQueries({ queryKey: accessKey });
      void client.invalidateQueries({ queryKey: ["billing-subscription", userId] });
    },
    onError: (error) => {
      // Input/access failures did not admit a batch. Uncertain network/server
      // failures keep the key so the next retry recovers the same durable jobs.
      const status = "status" in error ? Number(error.status) : null;
      if (status && status >= 400 && status < 500 && status !== 409) updateSession({ pendingRequest: null });
    },
  });
  const select = useMutation({
    mutationFn: (jobId: string) => characterRequest<{ ok: true; character: PublicCharacter }>(userId, "/api/characters/select", {
      method: "POST", body: JSON.stringify({ jobId }),
    }),
    onSuccess: async (result) => {
      await client.cancelQueries({ queryKey: charactersKey });
      updateSession({ selectedCharacterId: result.character.id });
      client.setQueryData<{ ok: true; characters: PublicCharacter[] }>(charactersKey, (previous) => ({
        ok: true, characters: [result.character, ...(previous?.characters ?? []).filter((character) => character.id !== result.character.id)],
      }));
      void client.invalidateQueries({ queryKey: charactersKey });
      void client.invalidateQueries({ queryKey: historyKey });
    },
  });
  const inProgress = session.jobs.length > 0 && (!jobs.data || jobs.data.some((job) => !job.isTerminal));
  const selected = characters.data?.characters.find((character) => character.id === session.selectedCharacterId) ?? null;
  const visibleJobs = historyImage ? [{ jobId: historyImage.jobId, generationId: historyImage.generationId }] : foregroundJobs;
  const visibleStatuses = historyImage ? [{
    id: historyImage.jobId, status: "completed" as const, isTerminal: true, error: null, checkError: null,
    output: { url: historyImage.url, mediaAssetId: historyImage.mediaAssetId, generationId: historyImage.generationId, width: null, height: null, ratio: "9:16" },
  }] : jobs.data;
  return { session, access, characters, jobs, generate, select, selected, inProgress, visibleJobs, visibleStatuses,
    history, historyImages: mergeCharacterHistoryPages(history.data?.pages ?? []), historyImage,
    openHistoryImage: (image: CharacterHistoryImage) => {
      if (!inProgress && !generationFlight.current && !session.pendingRequest) setHistoryImage(image);
    },
    returnToSession: () => setHistoryImage(null),
    startNewSession: () => {
      if (inProgress || generationFlight.current || session.pendingRequest) return;
      setForegroundJobs([]); setHistoryImage(null);
      updateSession({ jobs: [], selectedCharacterId: null });
      select.reset(); generate.reset();
    },
    restoring: Boolean(userId) && sessionQuery.isPending,
    chooseCharacter: (id: string | null) => updateSession({ selectedCharacterId: id }),
    discardPendingRequest: () => { updateSession({ pendingRequest: null }); generate.reset(); },
  };
}
