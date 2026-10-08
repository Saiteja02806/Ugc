"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { ScheduleFormSubmission } from "@/components/scheduling/schedule-editor";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { EMPTY_SCHEDULE_DRAFT, WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { useAccountTimeZone } from "@/components/providers/account-timezone-provider";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { workflowScheduleTargets, workflowSelectedAccounts, workflowSelectedPlatforms, selectWorkflowAccount } from "@/lib/explore/workflow-scheduling-draft";
import { readScheduleReceipt, verifySavedSchedule, scheduleReceiptMessage, type ScheduleReceipt } from "@/lib/explore/workflow-schedule-client";
import { parseWorkflowConnectedAccounts } from "@/lib/explore/workflow-connected-accounts";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { ScheduleMediaOption } from "@/lib/scheduling/types";
import type { SocialConnection } from "@/lib/social/types";

const ScheduleEditor = dynamic(() => import("@/components/scheduling/schedule-editor").then(module => module.ScheduleEditor), { ssr: false });
export function FormatSchedulePanel({ output, localPreview, imageOnly, active, actionsTarget }: {
  output: { id: string; kind: "media_asset" | "library_item"; url: string; title: string } | null; localPreview: boolean; imageOnly: boolean; active: boolean;
  actionsTarget?: HTMLElement | null;
}) {
  const { user } = useAuth();
  const timezone = useAccountTimeZone();
  const [draft, setDraft] = useState(EMPTY_SCHEDULE_DRAFT);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ScheduleReceipt | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [lead, setLead] = useState(5);
  const alive = useRef(true), working = useRef(false);
  const key = `ugc-explore:schedule:v1:${user?.uid}:format:${output?.kind}:${output?.id}`;
  const platforms = workflowSelectedPlatforms(draft);
  const targets = workflowScheduleTargets(draft);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function saved() { return user && output ? readScheduleReceipt(localStorage.getItem(key), user.uid, "hook", output.kind) : null; }
  async function authorized(url: string, init?: RequestInit) {
    const token = await getCurrentUserIdToken(user?.uid); if (!token || !alive.current) throw new Error("Sign in to schedule your post.");
    const response = await fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    const data = await response.json(); if (!alive.current) throw new Error("This workflow is no longer active.");
    if (!response.ok || !data?.ok) throw new Error(data?.message ?? "Could not confirm scheduling. Resume the same request.");
    return data;
  }
  function accept(entry: ScheduleReceipt, data: unknown) {
    const schedule = verifySavedSchedule(data, entry);
    const next = { ...entry, scheduleId: schedule.id };
    setReceipt(next); setMessage(scheduleReceiptMessage(schedule)); setOpen(false);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { setError("The post is saved. Review it in Scheduling."); }
  }
  useEffect(() => {
    if (!user || !output || localPreview) return;
    const timer = setTimeout(() => {
      try { const prior = saved(); setReceipt(prior); if (prior) setMessage(prior.scheduleId ? "This output already has a saved schedule. Review it in Scheduling." : "An interrupted schedule is ready to resume."); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not restore scheduling."); }
    }, 0);
    return () => clearTimeout(timer);
    // Restore once per output; never publish or POST during hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, localPreview]);
  async function loadConnections() { const value = await authorized("/api/social/connections"); parseWorkflowConnectedAccounts(value); setConnections(value.connections); return true; }
  async function send(entry: ScheduleReceipt) { accept(entry, await authorized("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry.input) })); }
  async function review() {
    if (!user || !output || localPreview || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const prior = saved();
      if (prior) {
        if (prior.scheduleId) accept(prior, await authorized(`/api/schedules/${prior.scheduleId}`));
        else await send(prior);
        return;
      }
      const [config] = await Promise.all([authorized("/api/schedules?configOnly=1"), loadConnections()]);
      if (typeof config.minimumScheduleLeadMinutes !== "number") throw new Error("Could not load scheduling limits.");
      setLead(config.minimumScheduleLeadMinutes); setOpen(true);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not start scheduling."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function confirm(submission: ScheduleFormSubmission) {
    if (!user || !output || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to schedule safely across tabs.");
      if (submission.scheduledSource.kind !== output.kind || submission.scheduledSource.id !== output.id || !targets.length || targets.length !== submission.targets.length || !targets.every(target => submission.targets.some(candidate => candidate.platform === target.platform && candidate.connectionId === target.connectionId))) throw new Error("Confirm this saved output and an account for each selected platform.");
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is scheduling this output.");
        const prior = saved();
        if (prior) { if (prior.scheduleId) accept(prior, await authorized(`/api/schedules/${prior.scheduleId}`)); else await send(prior); return; }
        const entry: ScheduleReceipt = { version: 1, owner: user.uid, kind: "hook", input: { source: submission.scheduledSource, title: output.title, caption: submission.caption, targets: submission.targets, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone, idempotencyKey: `explore:${crypto.randomUUID()}`, metadata: { mediaMode: imageOnly ? "carousel" : "single_video", exploreWorkflow: "format" } } };
        readScheduleReceipt(JSON.stringify(entry), user.uid, "hook", output.kind);
        localStorage.setItem(key, JSON.stringify(entry)); setReceipt(entry); await send(entry);
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not confirm scheduling."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  const media: ScheduleMediaOption[] = output && output.kind === "media_asset" ? [{ id: output.id, sourceType: "combined_video", status: "ready", title: output.title, mediaUrl: output.url }] : [];
  const actions = <div hidden={!active} className="space-y-2">
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {message ? <p role="status" className="text-xs leading-5 text-muted">{message}</p> : null}
    <Button type="button" size="lg" className="h-11 w-full rounded-lg" disabled={localPreview || !output || busy || !receipt && !targets.length} onClick={() => void review()}>{busy ? "Checking…" : receipt && !receipt.scheduleId ? "Resume schedule" : receipt?.scheduleId ? "Check saved schedule" : "Review schedule"}</Button>
    <p className="text-xs leading-5 text-muted">{!output ? "Save your final edits before scheduling." : localPreview ? "Preview · scheduling disabled" : "Review your accounts, time and platform settings before confirming."}</p>
    {receipt?.scheduleId ? <Link href="/scheduling" className="block text-center text-sm text-primary underline">View in Scheduling</Link> : null}
  </div>;
  return <><div hidden={!active} className="space-y-5 p-4"><WorkflowSchedulingPanel draft={draft} onChange={setDraft} imageOnly={imageOnly} timezone={timezone} accountsControl={<WorkflowConnectedAccounts enabled={!localPreview} active={active} ownerId={user?.uid ?? null} platforms={platforms} selectedIds={workflowSelectedAccounts(draft)} onSelect={(platform, id) => setDraft(current => selectWorkflowAccount(current, platform, id))} />} />
    {!actionsTarget ? actions : null}
    {active && open && output ? <ScheduleEditor demoMediaOptions={media} hookMediaOptions={[]} editingIsCombinedVideo={false} editingPlannedPlatforms={[]} editingSchedule={null} editingScheduledDate={null} editingScheduledTime={null} initialLibraryItemId={output.kind === "library_item" ? output.id : undefined}
      initialClipSelection="secondary_only" initialDemoMediaId={output.kind === "media_asset" ? output.id : ""} initialHookMediaId="" initialCaption={draft.caption} initialPlannedTargets={targets} initialScheduledDate={draft.date} initialScheduledTime={draft.time} minimumScheduleLeadMinutes={lead} requireScheduleTarget saving={busy} errorMessage={error}
      socialConnections={connections.filter(connection => targets.some(target => target.connectionId === connection.id))} tiktokBetaEnabled={platforms.includes("tiktok")} youtubeBetaEnabled={!imageOnly && platforms.includes("youtube")} onClose={() => { if (!busy) setOpen(false); }} onRefreshMedia={async () => true} onRefreshConnections={loadConnections} onSave={value => void confirm(value)} /> : null}
  </div>{actionsTarget ? createPortal(actions, actionsTarget) : null}</>;
}
