"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { appendCharacterSessionJobs, CHARACTER_SESSION_IDLE_TIMEOUT_MS, characterSessionStorageKey, EMPTY_CHARACTER_SESSION,
  isCharacterSessionIdle, parseCharacterClientSession,
  type CharacterClientSession } from "@/lib/characters/client-session";
import type { PublicCharacter } from "@/lib/characters/identity-service";
import type { CharacterGenerateRequest, CharacterGenerationAccess, CharacterGenerationResponse, CharacterHistoryImage, CharacterHistoryPage, CharacterJobReceipt,
  CharacterJobStatusResponse } from "@/lib/characters/types";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";

export async function characterRequest<T>(userId: string | null, path: string, options: RequestInit = {}): Promise<T> {
  const read = async (signal?: AbortSignal): Promise<T> => {
  if (!userId) throw Object.assign(new Error("Sign in to create and save your influencer."), { status: 401 });
  const token = await getCurrentUserIdToken(userId);
  if (!token) throw Object.assign(new Error("Sign in to create and save your influencer."), { status: 401 });
  const response = await fetch(path, {
    ...options, signal, cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || data?.message || "Could not complete this request. Try again.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data as T;
  };
  return !options.method || options.method.toUpperCase() === "GET" ? withReadDeadline(read, options.signal ?? undefined) : read(options.signal ?? undefined);
}

export function useCharacterBuilder(userId: string | null, historyOpen = false, activityPending = false) {
  const client = useQueryClient();
  const generationFlight = useRef<Promise<CharacterGenerationResponse> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const sessionKey = ["character-session", userId] as const;
  const charactersKey = ["characters", userId] as const;
  const accessKey = ["character-access", userId] as const;
  const historyKey = ["character-history", userId] as const;
  const [historyImage, setHistoryImage] = useState<CharacterHistoryImage | null>(null);
  const sessionQuery = useQuery({
    queryKey: sessionKey, enabled: Boolean(userId), staleTime: Infinity,
    queryFn: () => {
      try { return parseCharacterClientSession(localStorage.getItem(characterSessionStorageKey(userId!))); }
      catch { return EMPTY_CHARACTER_SESSION; }
    },
  });
  const session = sessionQuery.data ?? EMPTY_CHARACTER_SESSION;
  const updateSession = useCallback((patch: Partial<CharacterClientSession>) => {
    const key = ["character-session", userId] as const;
    const current = client.getQueryData<CharacterClientSession>(key) ?? EMPTY_CHARACTER_SESSION;
    const next = { ...current, ...patch };
    client.setQueryData(key, next);
    if (userId) {
      try { localStorage.setItem(characterSessionStorageKey(userId), JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
    }
  }, [client, userId]);
  const touchSession = useCallback(() => {
    if (userId) updateSession({ lastActivityAt: Date.now() });
  }, [userId, updateSession]);
  const cachedJobStatus = useCallback((job: CharacterJobReceipt) => {
    return client.getQueryData<CharacterJobStatusResponse["job"]>(["character-job", userId, job.jobId])
      ?? client.getQueryData<CharacterJobStatusResponse["job"][]>([
        "character-jobs", userId, session.jobs.map((receipt) => receipt.jobId),
      ])?.find((status) => status.id === job.jobId);
  }, [client, userId, session.jobs]);

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
    initialData: () => {
      const restored = session.jobs.flatMap((job) => {
        const status = cachedJobStatus(job);
        return status ? [{ ...status, checkError: null }] : [];
      });
      return restored.length ? restored : undefined;
    },
    queryFn: async ({ signal }) => {
      // Completed results are immutable. Carry them between batch query keys so
      // appending a generation does not poll every older image again.
      const previousStatuses = session.jobs.map(cachedJobStatus);
      const checks = await Promise.allSettled(session.jobs.map(async (job, index) => {
        const previous = previousStatuses[index];
        if (previous?.isTerminal) return previous;
        return (await characterRequest<CharacterJobStatusResponse>(userId, `/api/characters/status?jobId=${job.jobId}`, { signal })).job;
      }));
      if (checks.every((check) => check.status === "rejected")) {
        throw (checks[0] as PromiseRejectedResult).reason;
      }
      const results = checks.map((check, index) => {
        if (check.status === "fulfilled") return { ...check.value, checkError: null };
        const previous = previousStatuses[index];
        return {
          ...(previous ?? { id: session.jobs[index].jobId, status: "queued" as const, isTerminal: false, error: null, output: null }),
          checkError: "Could not check this candidate. Trying again…",
        };
      });
      const latest = client.getQueryData<CharacterClientSession>(sessionKey);
      if (signal.aborted || JSON.stringify(latest?.jobs) !== JSON.stringify(session.jobs)) return results;
      results.forEach((job) => {
        if (!job.checkError) client.setQueryData(["character-job", userId, job.id], job);
      });
      const newlyTerminal = results.some((job, index) => job.isTerminal && !previousStatuses[index]?.isTerminal);
      const newlyCompleted = results.some((job, index) => job.output && !previousStatuses[index]?.output);
      if (newlyTerminal) {
        void client.invalidateQueries({ queryKey: accessKey });
        void client.invalidateQueries({ queryKey: ["billing-subscription", userId] });
      }
      if (newlyCompleted || newlyTerminal && results.every((job) => job.isTerminal)) {
        void client.invalidateQueries({ queryKey: historyKey });
      }
      if (newlyCompleted) void client.invalidateQueries({ queryKey: charactersKey });
      // A running generation counts as activity until its output is ready;
      // recovery of already finished old jobs keeps their original idle time.
      if (results.some((job, index) => job.isTerminal && previousStatuses[index] && !previousStatuses[index]!.isTerminal)) {
        touchSession();
      }
      return results;
    },
    refetchInterval: (query) => query.state.error ? false
      : session.jobs.every((receipt) => query.state.data?.some((job) => job.id === receipt.jobId && job.isTerminal)) ? false : 2_500,
    refetchOnWindowFocus: true,
  });

  const generate = useMutation({
    mutationFn: (request: CharacterGenerateRequest) => {
      if (generationFlight.current) return generationFlight.current;
      const current = client.getQueryData<CharacterClientSession>(sessionKey) ?? EMPTY_CHARACTER_SESSION;
      const admittedRequest = current.pendingRequest ?? request;
      updateSession({ pendingRequest: admittedRequest, lastActivityAt: Date.now() });
      const flight = characterRequest<CharacterGenerationResponse>(userId, "/api/characters/generate", {
        method: "POST", body: JSON.stringify(admittedRequest),
      }).finally(() => { generationFlight.current = null; });
      generationFlight.current = flight;
      return flight;
    },
    onSuccess: (result) => {
      const current = client.getQueryData<CharacterClientSession>(sessionKey) ?? EMPTY_CHARACTER_SESSION;
      result.jobs.forEach((job) => {
        if (!client.getQueryData(["character-job", userId, job.jobId])) client.setQueryData(["character-job", userId, job.jobId], {
          id: job.jobId, status: "queued", isTerminal: false, error: null, output: null, checkError: null,
        });
      });
      updateSession({ jobs: appendCharacterSessionJobs(current.jobs, result.jobs), pendingRequest: null, lastActivityAt: Date.now() });
      if (mounted.current) setHistoryImage(null);
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
      updateSession({ selectedCharacterId: result.character.id, lastActivityAt: Date.now() });
      client.setQueryData<{ ok: true; characters: PublicCharacter[] }>(charactersKey, (previous) => ({
        ok: true, characters: [result.character, ...(previous?.characters ?? []).filter((character) => character.id !== result.character.id)],
      }));
      void client.invalidateQueries({ queryKey: charactersKey });
      void client.invalidateQueries({ queryKey: historyKey });
    },
  });
  const inProgress = session.jobs.some((receipt) => !jobs.data?.find((job) => job.id === receipt.jobId)?.isTerminal);
  const selected = characters.data?.characters.find((character) => character.id === session.selectedCharacterId) ?? null;
  const visibleJobs = historyImage ? [{ jobId: historyImage.jobId, generationId: historyImage.generationId }] : session.jobs;
  const visibleStatuses = historyImage ? [{
    id: historyImage.jobId, model: historyImage.model, status: "completed" as const, isTerminal: true, error: null, checkError: null,
    output: { url: historyImage.url, mediaAssetId: historyImage.mediaAssetId, generationId: historyImage.generationId, width: null, height: null, ratio: "9:16" },
  }] : jobs.data;
  const resetSelection = select.reset;
  const resetGeneration = generate.reset;
  const resetSession = useCallback(() => {
    const current = client.getQueryData<CharacterClientSession>(["character-session", userId]) ?? EMPTY_CHARACTER_SESSION;
    if (activityPending || select.isPending || generationFlight.current || current.pendingRequest || current.jobs.some((job) => !cachedJobStatus(job)?.isTerminal)) return;
    setHistoryImage(null);
    updateSession({ jobs: [], selectedCharacterId: null, lastActivityAt: null, sessionEpoch: current.sessionEpoch + 1 });
    resetSelection(); resetGeneration();
  }, [client, userId, cachedJobStatus, updateSession, resetSelection, resetGeneration, activityPending, select.isPending]);
  useEffect(() => {
    if (!userId || sessionQuery.isPending || typeof window === "undefined") return;
    // Old v1 receipts had no activity timestamp. Give their recovered session
    // one idle window while preserving any uncertain admission.
    if (session.lastActivityAt === null && (session.jobs.length || session.pendingRequest || session.selectedCharacterId)) {
      touchSession();
      return;
    }
    const expireIfIdle = () => {
      const current = client.getQueryData<CharacterClientSession>(["character-session", userId]) ?? EMPTY_CHARACTER_SESSION;
      const settled = current.jobs.every((job) => cachedJobStatus(job)?.isTerminal);
      if (!activityPending && !select.isPending && !generationFlight.current && isCharacterSessionIdle(current, Date.now(), settled)) resetSession();
    };
    expireIfIdle();
    const timer = session.lastActivityAt !== null && !inProgress && !session.pendingRequest && !activityPending && !select.isPending
      ? window.setTimeout(expireIfIdle, Math.max(0, session.lastActivityAt + CHARACTER_SESSION_IDLE_TIMEOUT_MS - Date.now()))
      : null;
    window.addEventListener("focus", expireIfIdle);
    document.addEventListener("visibilitychange", expireIfIdle);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("focus", expireIfIdle);
      document.removeEventListener("visibilitychange", expireIfIdle);
    };
  }, [client, userId, sessionQuery.isPending, session.lastActivityAt, session.sessionEpoch, session.pendingRequest,
    session.jobs.length, session.selectedCharacterId, inProgress, touchSession, cachedJobStatus, resetSession, activityPending, select.isPending]);
  return { session, sessionResetVersion: session.sessionEpoch, touchSession, access, characters, jobs, generate, select, selected, inProgress, visibleJobs, visibleStatuses,
    history, historyImages: mergeCharacterHistoryPages(history.data?.pages ?? []), historyImage,
    openHistoryImage: (image: CharacterHistoryImage) => {
      if (!inProgress && !generationFlight.current && !session.pendingRequest) { touchSession(); setHistoryImage(image); }
    },
    returnToSession: () => { touchSession(); setHistoryImage(null); },
    startNewSession: resetSession,
    restoring: Boolean(userId) && sessionQuery.isPending,
    chooseCharacter: (id: string | null) => updateSession({ selectedCharacterId: id, lastActivityAt: Date.now() }),
    discardPendingRequest: () => { updateSession({ pendingRequest: null }); generate.reset(); },
  };
}
