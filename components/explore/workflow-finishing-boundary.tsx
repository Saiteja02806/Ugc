"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ScheduleFormSubmission, ScheduleEditorDraftSnapshot } from "@/components/scheduling/schedule-editor";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing, type FinishingOptions, type WorkflowAction } from "@/components/explore/use-workflow-finishing";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { WorkflowScheduleDraft } from "@/components/explore/workflow-scheduling-panel";
import { workflowScheduleTargets, workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import { parseWorkflowConnectedAccounts } from "@/lib/explore/workflow-connected-accounts";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import type { SocialConnection } from "@/lib/social/types";
import type { ScheduleMediaOption } from "@/lib/scheduling/types";
import { readScheduleReceipt, verifySavedSchedule, scheduleReceiptMessage, ScheduleRequestError, isScheduleTimeRejected, SCHEDULE_TIME_REJECTED_MESSAGE, type ScheduleReceipt } from "@/lib/explore/workflow-schedule-client";
import type { DemoFraming, ExploreClipComposition } from "@/worker/src/lib/explore-finishing-contract";
import { trimmedDemoFraming } from "@/lib/explore/format-demo";
import { useTalkingHeadPendingComposition } from "./talking-head-pending-composition";
import type { ExploreScheduleComposition } from "@/lib/explore/pending-schedule-client";
import type { WorkflowCaptions } from "./workflow-caption-editor";

const ScheduleEditor = dynamic(() => import("@/components/scheduling/schedule-editor").then(m => m.ScheduleEditor), { ssr: false });
type WorkflowFinishingView = { edit: WorkflowAction; schedule: WorkflowAction; output: MediaAsset | null; options: FinishingOptions; setOptions: (value: FinishingOptions) => void; captions: WorkflowCaptions; scheduleReview?: ReactNode; pendingComposition?: ExploreScheduleComposition };
// The presentational boundary receives values and event handlers, not refs.
// Rendering the view must not execute a controller's imperative actions.
function FinishingView({ value, children }: { value: WorkflowFinishingView; children: (value: WorkflowFinishingView) => ReactNode }) { return children(value); }
export function WorkflowFinishingBoundary({ enabled, ownerId, kind, source, demo, demoSource, demoAudio, playback, scheduleDraft, children, demoFraming, demoFramingError, fastStatus = false, inlineSchedule = false, scheduleActive = false, onBackToEdit, onScheduleDraftChange, composition, backgroundScheduling = false, demoAudioAssetId = null }: {
  enabled: boolean; ownerId: string | null; kind: "hook" | "phone"; source: MediaAsset | null; demo: LocalWorkflowMedia | null; demoAudio: LocalWorkflowMedia | null; playback: "once" | "repeat"; scheduleDraft: WorkflowScheduleDraft;
  children: (value: WorkflowFinishingView) => ReactNode;
  demoFraming?: DemoFraming | null;
  demoSource?: MediaAsset | null;
  demoFramingError?: string | null;
  fastStatus?: boolean;
  inlineSchedule?: boolean;
  scheduleActive?: boolean;
  onBackToEdit?: () => void;
  onScheduleDraftChange?: (draft: WorkflowScheduleDraft) => void;
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
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState("Apply edits before scheduling your finished video.");
  const [connections, setConnections] = useState<SocialConnection[]>([]), [lead, setLead] = useState(5);
  const [receipt, setReceipt] = useState<ScheduleReceipt | null>(null), [confirmedSource, setConfirmedSource] = useState<string | null>(null), [restored, setRestored] = useState(false);
  const [reviewedOutputId, setReviewedOutputId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const active = useRef(true), working = useRef(false);
  const storageKey = `ugc-explore:schedule:v1:${encodeURIComponent(ownerId ?? "")}:${kind}`;
  const selectedTargets = workflowScheduleTargets(scheduleDraft);
  const selectedPlatforms = workflowSelectedPlatforms(scheduleDraft);
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
    setReceipt(next); setConfirmedSource(saved.input.source.id); setOpen(false); setMessage(scheduleReceiptMessage(schedule));
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
  async function loadConnections() {
    const value = await authorized("/api/social/connections");
    parseWorkflowConnectedAccounts(value); setConnections(value.connections); return true;
  }
  // Entering Schedule loads the single form. It never submits a saved request.
  const outputId = finishing.output?.id;
  const currentOutputId = useRef(outputId);
  useEffect(() => { currentOutputId.current = outputId; }, [outputId]);
  useEffect(() => {
    if (!inlineSchedule || !scheduleActive || !enabled || !ownerId || !outputId || !restored) return;
    let stopped = false;
    void Promise.resolve().then(async () => {
      if (stopped) return;
      setFormLoading(true); setError(null);
      const [config, accounts] = await Promise.all([authorized("/api/schedules?configOnly=1"), authorized("/api/social/connections")]);
      parseWorkflowConnectedAccounts(accounts);
      if (!Number.isFinite(config.minimumScheduleLeadMinutes) || config.minimumScheduleLeadMinutes < 0) throw new Error("Could not confirm scheduling limits.");
      if (!stopped) { setConnections(accounts.connections); setLead(config.minimumScheduleLeadMinutes); setReviewedOutputId(outputId); setOpen(true); }
    }).catch(e => { if (!stopped) setError(e instanceof Error ? e.message : "Could not load scheduling settings."); })
      .finally(() => { if (!stopped) setFormLoading(false); });
    return () => { stopped = true; };
  }, [inlineSchedule, scheduleActive, enabled, ownerId, outputId, restored, authorized]);
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
      let resume = false;
      await locked(async saved => {
        setReceipt(saved);
        if (saved && !saved.scheduleId && !saved.timeRejected) {
          try { await send(saved); resume = true; }
          catch (e) { if (!isScheduleTimeRejected(e)) throw e; }
        }
        else if (saved?.scheduleId && (saved.input.source.id === finishing.output?.id || !finishing.output)) { resume = true; await check(saved); }
      });
      if (resume) return;
      if (!finishing.output) throw new Error("Apply edits and wait for the finished video before scheduling.");
      const [config] = await Promise.all([authorized("/api/schedules?configOnly=1"), loadConnections()]);
      if (typeof config.minimumScheduleLeadMinutes !== "number" || config.minimumScheduleLeadMinutes < 0) throw new Error("Could not confirm scheduling limits.");
      setLead(config.minimumScheduleLeadMinutes); setReviewedOutputId(finishing.output.id); setOpen(true);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not start scheduling."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  async function save(submission: ScheduleFormSubmission) {
    if (!ownerId || !finishing.output || working.current) return;
    if (inlineSchedule && reviewedOutputId !== finishing.output.id) { setError("Your finished video changed. Review this output before scheduling."); return; }
    working.current = true; setBusy(true); setError(null);
    try {
      const validTargets = inlineSchedule
        ? submission.targets.length > 0 && submission.targets.length <= 3 && new Set(submission.targets.map(target => target.platform!)).size === submission.targets.length && submission.targets.every(target => connections.some(connection => connection.id === target.connectionId && connection.platform === target.platform))
        : selectedTargets.length > 0 && submission.targets.length === selectedTargets.length && selectedTargets.every(target => submission.targets.some(candidate => candidate.connectionId === target.connectionId && candidate.platform === target.platform));
      if (submission.scheduledSource.kind !== "media_asset" || submission.scheduledSource.id !== finishing.output.id || !validTargets) throw new Error("Choose the current finished video and a connected account for every selected platform.");
      onScheduleDraftChange?.({ ...scheduleDraft, caption: submission.caption, date: submission.scheduledDate, time: submission.scheduledTime, timezone: submission.timezone, platforms: submission.targets.map(target => target.platform!), connectionIds: Object.fromEntries(submission.targets.map(target => [target.platform, target.connectionId])), platform: submission.targets[0].platform!, connectionId: submission.targets[0].connectionId });
      await locked(async prior => {
        if (prior && (!prior.timeRejected || prior.scheduleId) && (!prior.scheduleId || prior.input.source.id === finishing.output!.id)) { setReceipt(prior); await send(prior); return; }
        if (prior?.timeRejected) {
          // Another tab may have accepted the old request since its rejection.
          // Verify before replacing it, including when a new render has a new ID.
          const value = await authorized("/api/schedules");
          if (!Array.isArray(value.schedules)) throw new Error("Could not verify the rejected scheduling request.");
          const match = value.schedules.find((s: { idempotencyKey?: string }) => s.idempotencyKey === prior.input.idempotencyKey);
          if (match) { accept(prior, { ok: true, schedule: match }); return; }
        }
        // Never discard an uncertain request. An older confirmed output stays
        // in Scheduling while a different finished video gets its own key.
        if (prior && !prior.timeRejected) await check(prior);
        if (!active.current || currentOutputId.current !== submission.scheduledSource.id) throw new Error("Your finished video changed. Schedule the current output instead.");
        const saved: ScheduleReceipt = { version: 1, owner: ownerId, kind, input: { caption: submission.caption, source: submission.scheduledSource, targets: submission.targets, title: finishing.output!.title, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone, idempotencyKey: prior?.timeRejected && prior.input.source.id === finishing.output!.id ? prior.input.idempotencyKey : `explore:${crypto.randomUUID()}`, metadata: { mediaMode: "single_video", exploreWorkflow: kind } } };
        readScheduleReceipt(JSON.stringify(saved), ownerId, kind);
        localStorage.setItem(storageKey, JSON.stringify(saved)); setReceipt(saved);
        await send(saved);
      });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not save scheduling. Resume the saved request."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  const syncDraft = (snapshot: ScheduleEditorDraftSnapshot) => onScheduleDraftChange?.({ ...scheduleDraft, caption: snapshot.caption, date: snapshot.date, time: snapshot.time, timezone: snapshot.timezone,
    ...(snapshot.targets ? { platforms: snapshot.targets.map(target => target.platform!), connectionIds: Object.fromEntries(snapshot.targets.map(target => [target.platform, target.connectionId])), platform: snapshot.targets[0]?.platform ?? "", connectionId: snapshot.targets[0]?.connectionId ?? "" } : {}) });
  const output = finishing.output;
  const media: ScheduleMediaOption[] = output ? [{ id: output.id, mediaUrl: output.url, thumbnailUrl: output.thumbnailUrl ?? undefined, sourceType: "edit_video", status: "ready", title: output.title }] : [];
  const alreadySaved = confirmedSource !== null && (!output || confirmedSource === output.id);
  const resumeSaved = receipt !== null && !receipt.scheduleId;
  const schedule: WorkflowAction = { busy, disabled: !enabled || !ownerId || !restored || busy || alreadySaved || (!resumeSaved && (!output || !inlineSchedule && !selectedTargets.length)), error, message: output && !receipt ? "Choose your accounts and time, then click Schedule post." : message, onAction: () => { void start(); }, refresh: () => { void refresh(); } };
  const uncertain = receipt !== null && !receipt.scheduleId && !receipt.timeRejected;
  const review = open && output && !alreadySaved && (!inlineSchedule || reviewedOutputId === output.id && (!uncertain || busy)) ? <ScheduleEditor key={output.id} presentation={inlineSchedule ? "workflow" : "modal"} finalVideo={media[0]} demoMediaOptions={media} hookMediaOptions={[]} editingIsCombinedVideo={false} editingPlannedPlatforms={[]} editingSchedule={null} editingScheduledDate={null} editingScheduledTime={null}
      initialClipSelection="secondary_only" initialDemoMediaId={output.id} initialHookMediaId="" initialCaption={scheduleDraft.caption} initialPlannedTargets={selectedTargets}
      initialScheduledDate={scheduleDraft.date} initialScheduledTime={scheduleDraft.time} initialTimezone={scheduleDraft.timezone} minimumScheduleLeadMinutes={lead} requireScheduleTarget saving={busy} errorMessage={error}
      onCloseDraft={syncDraft} onDraftChange={inlineSchedule ? syncDraft : undefined}
      socialConnections={inlineSchedule ? connections : connections.filter(c => selectedTargets.some(target => target.connectionId === c.id))} tiktokBetaEnabled={inlineSchedule || selectedPlatforms.includes("tiktok")} youtubeBetaEnabled={inlineSchedule || selectedPlatforms.includes("youtube")}
      onClose={() => { if (!busy) { setOpen(false); if (inlineSchedule) onBackToEdit?.(); } }} onRefreshMedia={async () => true} onRefreshConnections={loadConnections} onSave={value => { void save(value); }} /> : inlineSchedule && scheduleActive && !alreadySaved && formLoading ? <p role="status">Loading scheduling settings…</p> : null;
  return <><FinishingView value={{ edit: { ...finishing.action, disabled: finishing.action.disabled || captionFinishing.status?.outcome === "pending" || captionFinishing.action.busy || options.subtitles && !captions.transcript && !output }, schedule, output, options, setOptions: changeOptions, captions, scheduleReview: inlineSchedule ? review : undefined, pendingComposition: backgroundScheduling ? pendingComposition : undefined }}>{children}</FinishingView>
    {!inlineSchedule ? review : null}
  </>;
}
