"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing, type FinishingOptions, type WorkflowAction } from "@/components/explore/use-workflow-finishing";
import { archiveConfirmedSchedule } from "@/lib/explore/schedule-repeat-intent";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { WorkflowScheduleDraft } from "@/components/explore/workflow-scheduling-panel";
import { workflowScheduleTargets } from "@/lib/explore/workflow-scheduling-draft";
import { prepareSimpleWorkflowSchedule } from "@/lib/explore/simple-workflow-schedule";
import { requestWorkflowSchedule } from "@/lib/explore/workflow-schedule-transport";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { invalidateAccountSchedules, upsertAccountSchedule } from "@/lib/scheduling/account-data-query";
import type { MediaAsset } from "@/lib/media/types";
import { readScheduleReceipt, verifySavedSchedule, scheduleReceiptMessage, isScheduleTimeRejected, SCHEDULE_TIME_REJECTED_MESSAGE, type ScheduleReceipt } from "@/lib/explore/workflow-schedule-client";
import type { DemoFraming, ExploreClipComposition } from "@/worker/src/lib/explore-finishing-contract";
import { trimmedDemoFraming } from "@/lib/explore/format-demo";
import { useTalkingHeadPendingComposition } from "./talking-head-pending-composition";
import type { ExploreScheduleComposition } from "@/lib/explore/pending-schedule-client";
import type { WorkflowCaptions } from "./workflow-caption-editor";
import { useWorkflowBackgroundMusic, type WorkflowBackgroundMusic } from "./use-workflow-background-music";

type WorkflowFinishingView = { edit: WorkflowAction; schedule: WorkflowAction; output: MediaAsset | null; options: FinishingOptions; setOptions: (value: FinishingOptions) => void; captions: WorkflowCaptions; music: WorkflowBackgroundMusic; pendingComposition?: ExploreScheduleComposition };
const UNCONFIRMED_SCHEDULE_MESSAGE = "Scheduling was interrupted. Try again to finish scheduling your post.";
// The presentational boundary receives values and event handlers, not refs.
// Rendering the view must not execute a controller's imperative actions.
function FinishingView({ value, children }: { value: WorkflowFinishingView; children: (value: WorkflowFinishingView) => ReactNode }) { return children(value); }
export function WorkflowFinishingBoundary({ enabled, ownerId, kind, source, demo, demoSource, demoAudio, demoAudioSource = null, playback, scheduleDraft, children, demoFraming, demoFramingError, fastStatus = false, scheduleTimezone, composition, backgroundScheduling = false, demoAudioAssetId = null, initialOptions, onOptionsChange, draftId, onScheduled }: {
  enabled: boolean; ownerId: string | null; kind: "hook" | "phone"; source: MediaAsset | null; demo: LocalWorkflowMedia | null; demoAudio: LocalWorkflowMedia | null; playback: "once" | "repeat"; scheduleDraft: WorkflowScheduleDraft;
  children: (value: WorkflowFinishingView) => ReactNode;
  demoFraming?: DemoFraming | null;
  demoSource?: MediaAsset | null;
  demoAudioSource?: MediaAsset | null;
  initialOptions?: FinishingOptions;
  onOptionsChange?: (options: FinishingOptions) => void;
  draftId?: string;
  onScheduled?: () => void;
  demoFramingError?: string | null;
  fastStatus?: boolean;
  scheduleTimezone?: string;
  composition?: ExploreClipComposition; backgroundScheduling?: boolean; demoAudioAssetId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [options, setOptions] = useState(initialOptions ?? DEFAULT_FINISHING_OPTIONS);
  const music = useWorkflowBackgroundMusic({ ownerId, enabled, options, setOptions });
  const backgroundSource = options.backgroundMusic ? music.source : null;
  const selectionError = demoFramingError ?? music.selectionError;
  useEffect(() => { onOptionsChange?.(options); }, [options, onOptionsChange]);
  const effectiveDemoFraming = demoFraming && composition?.demoEditing ? trimmedDemoFraming(demoFraming, composition.demoEditing) : demoFraming;
  const workflowScope = draftId ? `workflow:${draftId}` : undefined;
  // Independent durable identity for speech review. Style and word edits never
  // regenerate it; both requests share the owner's exact audio cache.
  const captionFinishing = useWorkflowFinishing({ enabled, ownerId, kind, source, demo, demoSource, demoAudio, demoAudioSource, playback,
    options: { subtitles: true, style: "clean", placement: "bottom", backgroundMusic: options.backgroundMusic, ...(options.backgroundAssetId !== undefined ? { backgroundAssetId: options.backgroundAssetId, backgroundPlayback: music.playback } : {}) }, backgroundSource, backgroundPlayback: music.playback, demoFraming: effectiveDemoFraming, demoFramingError: selectionError,
    composition, demoAudioAssetId, captionPreview: true, scope: workflowScope ? `${workflowScope}:caption-preview` : "caption-preview", fastStatus: true });
  const finishing = useWorkflowFinishing({ enabled, ownerId, kind, source, demo, demoSource, demoAudio, demoAudioSource, playback, options, onRestoreOptions: initialOptions ? undefined : setOptions, backgroundSource, backgroundPlayback: music.playback, demoFraming: effectiveDemoFraming, demoFramingError: selectionError, fastStatus, reuseUnchangedSource: true, captionDraft: captionFinishing.captionDraft, composition, demoAudioAssetId, scope: workflowScope });
  const audioSelection = JSON.stringify([ownerId, source?.id, demo?.url, demoSource?.id, demoAudio?.url, demoAudioSource?.id, playback, composition, demoAudioAssetId, options.backgroundMusic, backgroundSource?.id, music.playback]);
  const priorAudioSelection = useRef(audioSelection);
  const audioSelectionReady = useRef(false);
  useEffect(() => {
    // Saved clip drafts arrive after the owned sources. Establish the restored
    // speech selection before invalidating persisted word corrections.
    if (!audioSelectionReady.current) {
      priorAudioSelection.current = audioSelection;
      if (source && !demoFramingError) audioSelectionReady.current = true;
      return;
    }
    if (priorAudioSelection.current !== audioSelection) {
      priorAudioSelection.current = audioSelection;
      setOptions(previous => previous.corrections?.length ? { ...previous, corrections: [] } : previous);
    }
  }, [audioSelection, source, demoFramingError]);
  const changeOptions = (value: FinishingOptions) => setOptions(previous => previous.backgroundMusic !== value.backgroundMusic ? { ...value, corrections: [] } : value);
  const captions: WorkflowCaptions = { action: { ...captionFinishing.action, disabled: captionFinishing.action.disabled || finishing.status?.outcome === "pending" || finishing.action.busy },
    generating: captionFinishing.status?.outcome === "pending" || captionFinishing.status?.outcome === "uncertain" && !captionFinishing.status.terminal,
    transcript: captionFinishing.transcript, corrections: options.corrections ?? [],
    onCorrectionsChange: corrections => setOptions(previous => ({ ...previous, corrections })) };
  const pendingComposition = useTalkingHeadPendingComposition({ owner: ownerId, kind, source, demo, demoSource, demoAudio, playback,
    composition, demoAudioAssetId: demoAudioSource?.id ?? demoAudioAssetId, framing: demoFraming, options, backgroundSource, backgroundPlayback: music.playback, captionDraft: captionFinishing.captionDraft, captionsReady: Boolean(captions.transcript), selectionError });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState("Apply edits before scheduling your finished video.");
  const [receipt, setReceipt] = useState<ScheduleReceipt | null>(null), [restored, setRestored] = useState(false);
  const active = useRef(true), working = useRef(false), requestGeneration = useRef(0);
  const storageKey = `ugc-explore:schedule:v1:${encodeURIComponent(ownerId ?? "")}:${kind}${draftId ? `:${draftId}` : ""}`;
  const scheduledCallback = useRef(onScheduled);
  useEffect(() => { scheduledCallback.current = onScheduled; }, [onScheduled]);
  const selectedTargets = workflowScheduleTargets(scheduleDraft);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const authorized = useCallback(async (url: string, init?: RequestInit) => {
    return requestWorkflowSchedule({ token: () => getCurrentUserIdToken(ownerId ?? undefined), fetch,
      assertActive: () => { if (!active.current) throw new Error("This account's workflow is no longer active."); } }, url, init);
  }, [ownerId]);
  const accept = useCallback((saved: ScheduleReceipt, value: unknown) => {
    const schedule = verifySavedSchedule(value, saved);
    const activeReceipt = ownerId
      ? readScheduleReceipt(localStorage.getItem(storageKey), ownerId, kind)
      : null;
    if (activeReceipt?.input.idempotencyKey !== saved.input.idempotencyKey) return;
    upsertAccountSchedule(queryClient, saved.owner, schedule);
    void invalidateAccountSchedules(queryClient, saved.owner);
    const next = { ...saved, scheduleId: schedule.id, timeRejected: undefined };
    setReceipt(next); setMessage(scheduleReceiptMessage(schedule));
    // A cache failure cannot undo a confirmed server schedule.
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setError("Your post is saved on the server, but this browser could not store its recovery record. Review Scheduling."); }
    scheduledCallback.current?.();
  }, [storageKey, queryClient, ownerId, kind]);
  const check = useCallback(async (saved: ScheduleReceipt, isCurrent: () => boolean) => {
    if (saved.scheduleId) {
      const value = await authorized(`/api/schedules/${encodeURIComponent(saved.scheduleId)}`);
      if (isCurrent()) accept(saved, value);
      return;
    }
    const value = await authorized("/api/schedules");
    if (!isCurrent()) return;
    if (!Array.isArray(value.schedules)) throw new Error("Could not verify the saved scheduling request.");
    const match = value.schedules.find((s: { idempotencyKey?: string }) => s.idempotencyKey === saved.input.idempotencyKey);
    if (match) accept(saved, { ok: true, schedule: match });
    else setMessage(saved.timeRejected ? SCHEDULE_TIME_REJECTED_MESSAGE : UNCONFIRMED_SCHEDULE_MESSAGE);
  }, [accept, authorized]);
  useEffect(() => {
    if (!enabled || !ownerId) return;
    let stopped = false;
    const generation = ++requestGeneration.current;
    const isCurrent = () => !stopped && active.current && requestGeneration.current === generation;
    // Restore and verify, but never POST automatically after reload.
    void Promise.resolve().then(async () => {
      if (stopped) return;
      try {
        const saved = readScheduleReceipt(localStorage.getItem(storageKey), ownerId, kind);
        setReceipt(saved); setRestored(true);
        if (saved) await check(saved, isCurrent);
      } catch (e) { if (isCurrent()) setError(e instanceof Error ? e.message : "Could not recover this schedule."); }
    });
    return () => { stopped = true; };
  }, [enabled, ownerId, kind, storageKey, check]);
  const outputId = finishing.output?.id;
  const timezone = scheduleDraft.timezone ?? scheduleTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const identity = JSON.stringify([outputId, scheduleDraft, timezone]);
  const currentIdentity = useRef(identity);
  useEffect(() => { currentIdentity.current = identity; }, [identity]);
  async function send(saved: ScheduleReceipt, isCurrent: () => boolean) {
    try {
      const value = await authorized("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saved.input) });
      if (isCurrent()) accept(saved, value);
    } catch (e) {
      if (isCurrent() && isScheduleTimeRejected(e) && !saved.scheduleId) {
        const rejected = { ...saved, timeRejected: true as const };
        localStorage.setItem(storageKey, JSON.stringify(rejected)); setReceipt(rejected); setMessage(SCHEDULE_TIME_REJECTED_MESSAGE);
        throw e;
      } else if (isCurrent() && !saved.scheduleId) {
        // A server or transport failure cannot prove that creation was rejected.
        // Preserve the exact receipt while replacing help for an older time error.
        setMessage(UNCONFIRMED_SCHEDULE_MESSAGE);
      }
      try {
        const value = await authorized("/api/schedules");
        if (!isCurrent()) return;
        const match = Array.isArray(value.schedules) && value.schedules.find((item: { idempotencyKey?: string }) => item.idempotencyKey === saved.input.idempotencyKey);
        if (match) { accept(saved, { ok: true, schedule: match }); return; }
      } catch { /* Preserve the original scheduling intent for Try again. */ }
      throw new Error("Could not schedule your post. Try again.");
    }
  }
  async function locked(run: (saved: ScheduleReceipt | null) => Promise<void>) {
    if (!navigator.locks || !ownerId) throw new Error("Use a browser with Web Locks support to schedule safely across tabs.");
    await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error("Another tab is scheduling this workflow. Check Scheduling first.");
      await run(readScheduleReceipt(localStorage.getItem(storageKey), ownerId, kind));
    });
  }
  async function refresh() {
    if (!enabled || !ownerId || working.current || !restored) return;
    working.current = true; setBusy(true); setError(null);
    const generation = ++requestGeneration.current;
    const isCurrent = () => active.current && requestGeneration.current === generation;
    try {
      const saved = readScheduleReceipt(localStorage.getItem(storageKey), ownerId, kind);
      if (saved) { setReceipt(saved); await check(saved, isCurrent); }
    } catch (e) { if (isCurrent()) setError(e instanceof Error ? e.message : "Could not verify scheduling."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  async function start() {
    if (!enabled || !ownerId || working.current || !restored) return;
    working.current = true; setBusy(true); setError(null);
    // An explicit attempt supersedes earlier hydration reads, even when it
    // corrects a rejected time while preserving the same idempotency key.
    const generation = ++requestGeneration.current;
    const isCurrent = () => active.current && requestGeneration.current === generation;
    try {
      await locked(async prior => {
        if (!isCurrent()) return;
        setReceipt(prior);
        if (prior && !prior.scheduleId && !prior.timeRejected) { await send(prior, isCurrent); return; }
        if (prior?.scheduleId && (prior.input.source.id === finishing.output?.id || !finishing.output)) {
          if (receipt?.scheduleId !== prior.scheduleId) { await check(prior, isCurrent); return; }
          archiveConfirmedSchedule(localStorage, storageKey, prior.input.idempotencyKey!, prior);
          setReceipt(null); setMessage("Choose your accounts and time, then click Schedule post.");
          return;
        }
        if (!prior && receipt?.scheduleId) { setReceipt(null); return; }
        if (prior?.timeRejected) {
          const value = await authorized("/api/schedules");
          if (!isCurrent()) return;
          if (!Array.isArray(value.schedules)) throw new Error("Could not verify the rejected scheduling request.");
          const match = value.schedules.find((s: { idempotencyKey?: string }) => s.idempotencyKey === prior.input.idempotencyKey);
          if (match) { accept(prior, { ok: true, schedule: match }); return; }
        }
        if (!finishing.output) throw new Error("Prepare your finished video before scheduling.");
        const submission = await prepareSimpleWorkflowSchedule({ draft: scheduleDraft, timezone, source: { kind: "media_asset", id: finishing.output.id }, title: finishing.output.title, load: authorized });
        if (!isCurrent() || currentIdentity.current !== identity) throw new Error("Your video or schedule changed. Check the current selections and click Schedule post again.");
        const saved: ScheduleReceipt = { version: 1, owner: ownerId, kind, input: { caption: submission.caption, source: submission.scheduledSource, targets: submission.targets, title: finishing.output.title, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone, idempotencyKey: prior?.timeRejected && prior.input.source.id === finishing.output.id ? prior.input.idempotencyKey : `explore:${crypto.randomUUID()}`, metadata: { mediaMode: "single_video", exploreWorkflow: kind } } };
        readScheduleReceipt(JSON.stringify(saved), ownerId, kind);
        if (prior?.scheduleId) archiveConfirmedSchedule(localStorage, storageKey, prior.input.idempotencyKey!, prior);
        localStorage.setItem(storageKey, JSON.stringify(saved)); setReceipt(saved);
        setMessage("Confirming your scheduling request…");
        await send(saved, isCurrent);
      });
    } catch (e) { if (isCurrent()) setError(e instanceof Error ? e.message : "Could not schedule your post. Try again."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  const output = finishing.output;
  const resumeSaved = receipt !== null && !receipt.scheduleId;
  const schedule: WorkflowAction = { busy, completed: Boolean(receipt?.scheduleId), label: resumeSaved && !receipt.timeRejected ? "Try again" : "Schedule post", disabled: !enabled || !ownerId || !restored || busy || (!resumeSaved && (!output || !selectedTargets.length)), error, message: output && !receipt ? "Choose your accounts and time, then click Schedule post." : message, onAction: () => { void start(); }, refresh: () => { void refresh(); } };
  return <><FinishingView value={{ edit: { ...finishing.action, disabled: finishing.action.disabled || captionFinishing.status?.outcome === "pending" || captionFinishing.action.busy || options.subtitles && !captions.transcript && !output }, schedule, output, options, setOptions: changeOptions, captions, music, pendingComposition: backgroundScheduling ? pendingComposition : undefined }}>{children}</FinishingView>{null}</>;
}
