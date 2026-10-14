"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing, type FinishingOptions, type WorkflowAction } from "@/components/explore/use-workflow-finishing";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { WorkflowScheduleDraft } from "@/components/explore/workflow-scheduling-panel";
import { workflowScheduleTargets } from "@/lib/explore/workflow-scheduling-draft";
import { prepareSimpleWorkflowSchedule } from "@/lib/explore/simple-workflow-schedule";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import { readScheduleReceipt, verifySavedSchedule, scheduleReceiptMessage, ScheduleRequestError, isScheduleTimeRejected, SCHEDULE_TIME_REJECTED_MESSAGE, type ScheduleReceipt } from "@/lib/explore/workflow-schedule-client";
import type { DemoFraming, ExploreClipComposition } from "@/worker/src/lib/explore-finishing-contract";
import { trimmedDemoFraming } from "@/lib/explore/format-demo";
import { useTalkingHeadPendingComposition } from "./talking-head-pending-composition";
import type { ExploreScheduleComposition } from "@/lib/explore/pending-schedule-client";
import type { WorkflowCaptions } from "./workflow-caption-editor";

type WorkflowFinishingView = { edit: WorkflowAction; schedule: WorkflowAction; output: MediaAsset | null; options: FinishingOptions; setOptions: (value: FinishingOptions) => void; captions: WorkflowCaptions; pendingComposition?: ExploreScheduleComposition };
// The presentational boundary receives values and event handlers, not refs.
// Rendering the view must not execute a controller's imperative actions.
function FinishingView({ value, children }: { value: WorkflowFinishingView; children: (value: WorkflowFinishingView) => ReactNode }) { return children(value); }
export function WorkflowFinishingBoundary({ enabled, ownerId, kind, source, demo, demoSource, demoAudio, playback, scheduleDraft, children, demoFraming, demoFramingError, fastStatus = false, scheduleTimezone, composition, backgroundScheduling = false, demoAudioAssetId = null }: {
  enabled: boolean; ownerId: string | null; kind: "hook" | "phone"; source: MediaAsset | null; demo: LocalWorkflowMedia | null; demoAudio: LocalWorkflowMedia | null; playback: "once" | "repeat"; scheduleDraft: WorkflowScheduleDraft;
  children: (value: WorkflowFinishingView) => ReactNode;
  demoFraming?: DemoFraming | null;
  demoSource?: MediaAsset | null;
  demoFramingError?: string | null;
  fastStatus?: boolean;
  scheduleTimezone?: string;
  composition?: ExploreClipComposition; backgroundScheduling?: boolean; demoAudioAssetId?: string | null;
}) {
  const [options, setOptions] = useState(DEFAULT_FINISHING_OPTIONS);
  const effectiveDemoFraming = demoFraming && composition?.demoEditing ? trimmedDemoFraming(demoFraming, composition.demoEditing) : demoFraming;
  // Independent durable identity for speech review. Style and word edits never
  // regenerate it; both requests share the owner's exact audio cache.
  const captionFinishing = useWorkflowFinishing({ enabled, ownerId, kind, source, demo, demoSource, demoAudio, playback,
    options: { subtitles: true, style: "clean", placement: "bottom", backgroundMusic: options.backgroundMusic }, demoFraming: effectiveDemoFraming, demoFramingError,
    composition, demoAudioAssetId, captionPreview: true, scope: "caption-preview", fastStatus: true });
  const finishing = useWorkflowFinishing({ enabled, ownerId, kind, source, demo, demoSource, demoAudio, playback, options, onRestoreOptions: setOptions, demoFraming: effectiveDemoFraming, demoFramingError, fastStatus, reuseUnchangedSource: true, captionDraft: captionFinishing.captionDraft, composition, demoAudioAssetId });
  const audioSelection = JSON.stringify([ownerId, source?.id, demo?.url, demoSource?.id, demoAudio?.url, playback, composition, demoAudioAssetId]);
  const priorAudioSelection = useRef(audioSelection);
  const hadAudioSource = useRef(!!source);
  useEffect(() => {
    if (priorAudioSelection.current !== audioSelection) {
      priorAudioSelection.current = audioSelection;
      if (hadAudioSource.current) setOptions(previous => previous.corrections?.length ? { ...previous, corrections: [] } : previous);
    }
    hadAudioSource.current = !!source;
  }, [audioSelection, source]);
  const changeOptions = (value: FinishingOptions) => setOptions(previous => previous.backgroundMusic !== value.backgroundMusic ? { ...value, corrections: [] } : value);
  const captions: WorkflowCaptions = { action: { ...captionFinishing.action, disabled: captionFinishing.action.disabled || finishing.status?.outcome === "pending" || finishing.action.busy },
    generating: captionFinishing.status?.outcome === "pending" || captionFinishing.status?.outcome === "uncertain" && !captionFinishing.status.terminal,
    transcript: captionFinishing.transcript, corrections: options.corrections ?? [],
    onCorrectionsChange: corrections => setOptions(previous => ({ ...previous, corrections })) };
  const pendingComposition = useTalkingHeadPendingComposition({ owner: ownerId, kind, source, demo, demoSource, demoAudio, playback,
    composition, demoAudioAssetId, framing: demoFraming, options, captionDraft: captionFinishing.captionDraft, captionsReady: Boolean(captions.transcript), selectionError: demoFramingError });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState("Apply edits before scheduling your finished video.");
  const [receipt, setReceipt] = useState<ScheduleReceipt | null>(null), [confirmedSource, setConfirmedSource] = useState<string | null>(null), [restored, setRestored] = useState(false);
  const active = useRef(true), working = useRef(false);
  const storageKey = `ugc-explore:schedule:v1:${encodeURIComponent(ownerId ?? "")}:${kind}`;
  const selectedTargets = workflowScheduleTargets(scheduleDraft);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const authorized = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getCurrentUserIdToken(ownerId ?? undefined);
    if (!active.current || !token) throw new Error("Sign in to schedule your finished video.");
    const response = await fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    const value = await response.json().catch(() => null);
    if (!active.current) throw new Error("This account's workflow is no longer active.");
    if (!response.ok || !value?.ok) throw new ScheduleRequestError(value?.message ?? "Could not confirm scheduling. Keep the saved request and try again.", response.status, value?.code);
    return value;
  }, [ownerId]);
  const accept = useCallback((saved: ScheduleReceipt, value: unknown) => {
    const schedule = verifySavedSchedule(value, saved);
    const next = { ...saved, scheduleId: schedule.id, timeRejected: undefined };
    setReceipt(next); setConfirmedSource(saved.input.source.id); setMessage(scheduleReceiptMessage(schedule));
    // A cache failure cannot undo a confirmed server schedule.
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setError("Your post is saved on the server, but this browser could not store its recovery record. Review Scheduling."); }
  }, [storageKey]);
  const check = useCallback(async (saved: ScheduleReceipt) => {
    if (saved.scheduleId) { accept(saved, await authorized(`/api/schedules/${encodeURIComponent(saved.scheduleId)}`)); return; }
    const value = await authorized("/api/schedules");
    if (!Array.isArray(value.schedules)) throw new Error("Could not verify the saved scheduling request.");
    const match = value.schedules.find((s: { idempotencyKey?: string }) => s.idempotencyKey === saved.input.idempotencyKey);
    if (match) accept(saved, { ok: true, schedule: match });
    else setMessage(saved.timeRejected ? SCHEDULE_TIME_REJECTED_MESSAGE : "An interrupted schedule is saved. Click Schedule post to resume that same request without creating a duplicate.");
  }, [accept, authorized]);
  useEffect(() => {
    if (!enabled || !ownerId) return;
    let stopped = false;
    // Restore and verify, but never POST automatically after reload.
    void Promise.resolve().then(async () => {
      if (stopped) return;
      try {
        const saved = readScheduleReceipt(localStorage.getItem(storageKey), ownerId, kind);
        setReceipt(saved); setRestored(true);
        if (saved) await check(saved);
      } catch (e) { if (!stopped && active.current) setError(e instanceof Error ? e.message : "Could not recover this schedule."); }
    });
    return () => { stopped = true; };
  }, [enabled, ownerId, kind, storageKey, check]);
  const outputId = finishing.output?.id;
  const timezone = scheduleDraft.timezone ?? scheduleTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const identity = JSON.stringify([outputId, scheduleDraft, timezone]);
  const currentIdentity = useRef(identity);
  useEffect(() => { currentIdentity.current = identity; }, [identity]);
  async function send(saved: ScheduleReceipt) {
    try {
      accept(saved, await authorized("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saved.input) }));
    } catch (e) {
      if (isScheduleTimeRejected(e) && !saved.scheduleId) {
        const rejected = { ...saved, timeRejected: true as const };
        localStorage.setItem(storageKey, JSON.stringify(rejected)); setReceipt(rejected); setMessage(SCHEDULE_TIME_REJECTED_MESSAGE);
      }
      throw e;
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
    try {
      const saved = readScheduleReceipt(localStorage.getItem(storageKey), ownerId, kind);
      if (saved) { setReceipt(saved); await check(saved); }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not verify scheduling."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  async function start() {
    if (!enabled || !ownerId || working.current || !restored) return;
    working.current = true; setBusy(true); setError(null);
    try {
      await locked(async prior => {
        setReceipt(prior);
        if (prior && !prior.scheduleId && !prior.timeRejected) { await send(prior); return; }
        if (prior?.scheduleId && (prior.input.source.id === finishing.output?.id || !finishing.output)) { await check(prior); return; }
        if (prior?.timeRejected) {
          const value = await authorized("/api/schedules");
          if (!Array.isArray(value.schedules)) throw new Error("Could not verify the rejected scheduling request.");
          const match = value.schedules.find((s: { idempotencyKey?: string }) => s.idempotencyKey === prior.input.idempotencyKey);
          if (match) { accept(prior, { ok: true, schedule: match }); return; }
        }
        if (!finishing.output) throw new Error("Prepare your finished video before scheduling.");
        const submission = await prepareSimpleWorkflowSchedule({ draft: scheduleDraft, timezone, source: { kind: "media_asset", id: finishing.output.id }, title: finishing.output.title, load: authorized });
        if (!active.current || currentIdentity.current !== identity) throw new Error("Your video or schedule changed. Check the current selections and click Schedule post again.");
        const saved: ScheduleReceipt = { version: 1, owner: ownerId, kind, input: { caption: submission.caption, source: submission.scheduledSource, targets: submission.targets, title: finishing.output.title, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone, idempotencyKey: prior?.timeRejected && prior.input.source.id === finishing.output.id ? prior.input.idempotencyKey : `explore:${crypto.randomUUID()}`, metadata: { mediaMode: "single_video", exploreWorkflow: kind } } };
        readScheduleReceipt(JSON.stringify(saved), ownerId, kind);
        localStorage.setItem(storageKey, JSON.stringify(saved)); setReceipt(saved);
        await send(saved);
      });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not save scheduling. Resume the saved request."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  const output = finishing.output;
  const alreadySaved = confirmedSource !== null && (!output || confirmedSource === output.id);
  const resumeSaved = receipt !== null && !receipt.scheduleId;
  const schedule: WorkflowAction = { busy, disabled: !enabled || !ownerId || !restored || busy || alreadySaved || (!resumeSaved && (!output || !selectedTargets.length)), error, message: output && !receipt ? "Choose your accounts and time, then click Schedule post." : message, onAction: () => { void start(); }, refresh: () => { void refresh(); } };
  return <><FinishingView value={{ edit: { ...finishing.action, disabled: finishing.action.disabled || captionFinishing.status?.outcome === "pending" || captionFinishing.action.busy || options.subtitles && !captions.transcript && !output }, schedule, output, options, setOptions: changeOptions, captions, pendingComposition: backgroundScheduling ? pendingComposition : undefined }}>{children}</FinishingView>{null}</>;
}
