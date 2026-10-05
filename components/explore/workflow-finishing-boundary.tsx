"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ScheduleFormSubmission } from "@/components/scheduling/schedule-editor";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing, type FinishingOptions, type WorkflowAction } from "@/components/explore/use-workflow-finishing";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { WorkflowScheduleDraft } from "@/components/explore/workflow-scheduling-panel";
import { workflowScheduleTargets, workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import { parseWorkflowConnectedAccounts } from "@/lib/explore/workflow-connected-accounts";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import type { SocialConnection } from "@/lib/social/types";
import type { ScheduleMediaOption } from "@/lib/scheduling/types";
import { readScheduleReceipt, verifySavedSchedule, scheduleReceiptMessage, type ScheduleReceipt } from "@/lib/explore/workflow-schedule-client";

const ScheduleEditor = dynamic(() => import("@/components/scheduling/schedule-editor").then(m => m.ScheduleEditor), { ssr: false });
type WorkflowFinishingView = { edit: WorkflowAction; schedule: WorkflowAction; output: MediaAsset | null; options: FinishingOptions; setOptions: (value: FinishingOptions) => void };
// The presentational boundary receives values and event handlers, not refs.
// Rendering the view must not execute a controller's imperative actions.
function FinishingView({ value, children }: { value: WorkflowFinishingView; children: (value: WorkflowFinishingView) => ReactNode }) { return children(value); }
export function WorkflowFinishingBoundary({ enabled, ownerId, kind, source, demo, demoAudio, playback, scheduleDraft, children }: {
  enabled: boolean; ownerId: string | null; kind: "hook" | "phone"; source: MediaAsset | null; demo: LocalWorkflowMedia | null; demoAudio: LocalWorkflowMedia | null; playback: "once" | "repeat"; scheduleDraft: WorkflowScheduleDraft;
  children: (value: WorkflowFinishingView) => ReactNode;
}) {
  const [options, setOptions] = useState(DEFAULT_FINISHING_OPTIONS);
  const finishing = useWorkflowFinishing({ enabled, ownerId, kind, source, demo, demoAudio, playback, options, onRestoreOptions: setOptions });
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState("Apply edits before scheduling your finished video.");
  const [connections, setConnections] = useState<SocialConnection[]>([]), [lead, setLead] = useState(5);
  const [receipt, setReceipt] = useState<ScheduleReceipt | null>(null), [confirmedSource, setConfirmedSource] = useState<string | null>(null), [restored, setRestored] = useState(false);
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
    if (!response.ok || !value?.ok) throw new Error(value?.message ?? "Could not confirm scheduling. Keep the saved request and try again.");
    return value;
  }, [ownerId]);
  const accept = useCallback((saved: ScheduleReceipt, value: unknown) => {
    const schedule = verifySavedSchedule(value, saved);
    const next = { ...saved, scheduleId: schedule.id };
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
    else setMessage("An interrupted schedule is saved. Click Schedule post to resume that same request without creating a duplicate.");
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
  async function send(saved: ScheduleReceipt) {
    accept(saved, await authorized("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saved.input) }));
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
        if (saved && !saved.scheduleId) { resume = true; await send(saved); }
        else if (saved && (saved.input.source.id === finishing.output?.id || !finishing.output)) { resume = true; await check(saved); }
      });
      if (resume) return;
      if (!finishing.output) throw new Error("Apply edits and wait for the finished video before scheduling.");
      const [config] = await Promise.all([authorized("/api/schedules?configOnly=1"), loadConnections()]);
      if (typeof config.minimumScheduleLeadMinutes !== "number" || config.minimumScheduleLeadMinutes < 0) throw new Error("Could not confirm scheduling limits.");
      setLead(config.minimumScheduleLeadMinutes); setOpen(true);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not start scheduling."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  async function save(submission: ScheduleFormSubmission) {
    if (!ownerId || !finishing.output || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (submission.scheduledSource.kind !== "media_asset" || submission.scheduledSource.id !== finishing.output.id || !selectedTargets.length || submission.targets.length !== selectedTargets.length || !selectedTargets.every(target => submission.targets.some(candidate => candidate.connectionId === target.connectionId && candidate.platform === target.platform))) throw new Error("Confirm the selected finished video and an account for every selected platform.");
      await locked(async prior => {
        if (prior && (!prior.scheduleId || prior.input.source.id === finishing.output!.id)) { setReceipt(prior); await send(prior); return; }
        // Never discard an uncertain request. An older confirmed output stays
        // in Scheduling while a different finished video gets its own key.
        if (prior) await check(prior);
        const saved: ScheduleReceipt = { version: 1, owner: ownerId, kind, input: { caption: submission.caption, source: submission.scheduledSource, targets: submission.targets, title: finishing.output!.title, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone, idempotencyKey: `explore:${crypto.randomUUID()}`, metadata: { mediaMode: "single_video", exploreWorkflow: kind } } };
        readScheduleReceipt(JSON.stringify(saved), ownerId, kind);
        localStorage.setItem(storageKey, JSON.stringify(saved)); setReceipt(saved);
        await send(saved);
      });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not save scheduling. Resume the saved request."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  const output = finishing.output;
  const media: ScheduleMediaOption[] = output ? [{ id: output.id, mediaUrl: output.url, thumbnailUrl: output.thumbnailUrl ?? undefined, sourceType: "edit_video", status: "ready", title: output.title }] : [];
  const alreadySaved = confirmedSource !== null && (!output || confirmedSource === output.id);
  const resumeSaved = receipt !== null && !receipt.scheduleId;
  const schedule: WorkflowAction = { busy, disabled: !enabled || !ownerId || !restored || busy || alreadySaved || (!resumeSaved && (!output || !selectedTargets.length)), error, message: output && !receipt ? "Select an account for each platform, then review and confirm your schedule." : message, onAction: () => { void start(); }, refresh: () => { void refresh(); } };
  return <><FinishingView value={{ edit: finishing.action, schedule, output, options, setOptions }}>{children}</FinishingView>
    {open && output ? <ScheduleEditor demoMediaOptions={media} hookMediaOptions={[]} editingIsCombinedVideo={false} editingPlannedPlatforms={[]} editingSchedule={null} editingScheduledDate={null} editingScheduledTime={null}
      initialClipSelection="secondary_only" initialDemoMediaId={output.id} initialHookMediaId="" initialCaption={scheduleDraft.caption} initialPlannedTargets={selectedTargets}
      initialScheduledDate={scheduleDraft.date} initialScheduledTime={scheduleDraft.time} minimumScheduleLeadMinutes={lead} requireScheduleTarget saving={busy} errorMessage={error}
      socialConnections={connections.filter(c => selectedTargets.some(target => target.connectionId === c.id))} tiktokBetaEnabled={selectedPlatforms.includes("tiktok")} youtubeBetaEnabled={selectedPlatforms.includes("youtube")}
      onClose={() => { if (!busy) setOpen(false); }} onRefreshMedia={async () => true} onRefreshConnections={loadConnections} onSave={value => { void save(value); }} /> : null}
  </>;
}
