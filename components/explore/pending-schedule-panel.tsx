"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { workflowScheduleTargets, workflowSelectedAccounts, workflowSelectedPlatforms, selectWorkflowAccount, type WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";
import { parseWorkflowConnectedAccounts } from "@/lib/explore/workflow-connected-accounts";
import { parseExplorePendingSchedule, type ExplorePendingScheduleResult } from "@/lib/explore/pending-schedule-contract";
import { readSavedExploreSchedule, verifyExploreScheduleReply, type ExploreScheduleComposition, type SavedExploreSchedule } from "@/lib/explore/pending-schedule-client";
import { ScheduleRequestError, isScheduleTimeRejected, SCHEDULE_TIME_REJECTED_MESSAGE } from "@/lib/explore/workflow-schedule-client";
import type { SocialConnection } from "@/lib/social/types";
import type { ScheduleMediaOption } from "@/lib/scheduling/types";
import type { ScheduleFormSubmission, ScheduleEditorDraftSnapshot } from "@/components/scheduling/schedule-editor";
import styles from "@/components/explore/workflow-schedule-review.module.css";

const ScheduleEditor = dynamic(() => import("@/components/scheduling/schedule-editor").then(module => module.ScheduleEditor), { ssr: false });
async function authorized(owner: string, url: string, init?: RequestInit) {
  const token = await getCurrentUserIdToken(owner);
  if (!token) throw new Error("Sign in to schedule your post.");
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000), headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  const value = await response.json().catch(() => null);
  if (!response.ok || !value?.ok) throw new ScheduleRequestError(value?.message ?? value?.error ?? "Could not confirm the saved schedule. Check the same request before trying again.", response.status, value?.code);
  return value;
}
export function useBackgroundScheduleAvailability(owner: string | null, enabled: boolean) {
  return useQuery({ queryKey: ["explore-background-scheduling", owner], enabled: enabled && !!owner, staleTime: 60000, retry: false,
    queryFn: async () => { try { return (await authorized(owner!, "/api/explore/schedules?configOnly=1")).enabled === true; } catch { return false; } } });
}

/** Confirmation saves a durable render/schedule snapshot. Polling never POSTs. */
export function PendingExploreSchedulePanel({ owner, scope, composition, draft, onChange, timezone, active, onBackToEdit }: {
  owner: string; scope: string; composition: ExploreScheduleComposition; draft: WorkflowScheduleDraft; onChange: (value: WorkflowScheduleDraft) => void;
  timezone: string; active: boolean; onBackToEdit?: () => void;
}) {
  const storageKey = `ugc-explore:background-schedule:v1:${encodeURIComponent(owner)}:${encodeURIComponent(scope)}`;
  const [saved, setSaved] = useState<SavedExploreSchedule | null>(null), [result, setResult] = useState<ExplorePendingScheduleResult | null>(null);
  const [openSignature, setOpenSignature] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false), [formAttempt, setFormAttempt] = useState(0);
  const [connections, setConnections] = useState<SocialConnection[]>([]), [lead, setLead] = useState(5);
  const [restored, setRestored] = useState(false);
  const current = useRef(composition), working = useRef(false), alive = useRef(true);
  const targets = workflowScheduleTargets(draft), platforms = workflowSelectedPlatforms(draft);
  const targetSignature = JSON.stringify(targets);
  const currentIdentity = useRef({ storageKey, targetSignature });
  useLayoutEffect(() => { current.current = composition; currentIdentity.current = { storageKey, targetSignature }; }, [composition, storageKey, targetSignature]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const accept = useCallback((entry: SavedExploreSchedule, raw: unknown) => {
    const value = verifyExploreScheduleReply(raw, entry);
    if (!alive.current || currentIdentity.current.storageKey !== storageKey) return;
    const next = { ...entry, confirmed: value.preparation.state !== "unconfirmed", timeRejected: value.preparation.state === "unconfirmed" ? entry.timeRejected : undefined };
    setSaved(next); setResult(value);
    if (next.confirmed) { setOpenSignature(null); localStorage.setItem(storageKey, JSON.stringify(next)); }
  }, [storageKey]);
  useEffect(() => {
    let stopped = false;
    void Promise.resolve().then(async () => {
      if (stopped) return;
      setSaved(null); setResult(null); setOpenSignature(null); setError(null); setRestored(false);
      try {
        const entry = readSavedExploreSchedule(localStorage.getItem(storageKey), owner);
        if (!entry || stopped) return;
        setSaved(entry);
        const value = await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(entry.input.requestKey)}`);
        if (!stopped) accept(entry, value);
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Could not restore the saved request."); }
      finally { if (!stopped) setRestored(true); }
    });
    return () => { stopped = true; };
  }, [owner, storageKey, accept]);
  useEffect(() => {
    if (!active || !saved || result?.preparation.state !== "preparing") return;
    let stopped = false, checking = false;
    const timer = setInterval(async () => {
      if (checking) return;
      checking = true;
      try { const value = await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(saved.input.requestKey)}`); if (!stopped) accept(saved, value); }
      catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Could not refresh preparation."); }
      finally { checking = false; }
    }, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [active, saved, result?.preparation.state, owner, accept]);
  const boundResult = saved?.signature === composition.signature ? result : null;
  const failedBeforePublishing = boundResult?.preparation.state === "failed" && boundResult.schedule?.targets.length === 0;
  const confirmed = saved?.signature === composition.signature && saved.confirmed && !failedBeforePublishing;
  const unresolved = !!saved && !saved.confirmed && !saved.timeRejected;
  // The Schedule tab is the form, with one explicit Schedule post action.
  // Loading accounts and limits is read-only; it cannot enqueue preparation.
  const canShowForm = active && restored && !unresolved && !confirmed && !composition.error && !!composition.draft;
  useEffect(() => {
    if (!canShowForm) return;
    let stopped = false;
    void Promise.resolve().then(async () => {
      if (stopped) return;
      setFormLoading(true);
      const [config, accountData] = await Promise.all([authorized(owner, "/api/schedules?configOnly=1"), authorized(owner, "/api/social/connections")]);
      parseWorkflowConnectedAccounts(accountData);
      if (!Number.isFinite(config.minimumScheduleLeadMinutes) || config.minimumScheduleLeadMinutes < 0) throw new Error("Could not load scheduling limits.");
      if (!stopped) { setLead(config.minimumScheduleLeadMinutes); setConnections(accountData.connections); setOpenSignature(composition.signature); }
    }).catch(e => { if (!stopped) setError(e instanceof Error ? e.message : "Could not load scheduling settings."); })
      .finally(() => { if (!stopped) setFormLoading(false); });
    return () => { stopped = true; };
  }, [canShowForm, owner, storageKey, composition.signature, formAttempt]);
  async function check() {
    if (!saved || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try { accept(saved, await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(saved.input.requestKey)}`)); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not verify the request."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function send(entry: SavedExploreSchedule) {
    try {
      accept(entry, await authorized(owner, "/api/explore/schedules", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": entry.input.requestKey }, body: JSON.stringify(entry.input) }));
    } catch (error) {
      if (isScheduleTimeRejected(error) && !entry.confirmed && alive.current && currentIdentity.current.storageKey === storageKey) {
        const rejected = { ...entry, timeRejected: true as const };
        localStorage.setItem(storageKey, JSON.stringify(rejected)); setSaved(rejected); setResult(null);
      }
      // Once a receipt exists, expose read-only recovery instead of leaving the
      // confirmation form open with a button that cannot safely submit again.
      if (!isScheduleTimeRejected(error) && alive.current && currentIdentity.current.storageKey === storageKey) setOpenSignature(null);
      throw error;
    }
  }
  async function confirm(submission: ScheduleFormSubmission) {
    if (working.current || openSignature !== composition.signature || composition.error) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (submission.scheduledSource.kind !== "media_asset" || submission.scheduledSource.id !== composition.sourceId || submission.clipSelection !== "secondary_only" || submission.openingMedia !== null || submission.useOpeningClip) throw new Error("The selected video changed. Review the updated video before scheduling.");
      if (currentIdentity.current.storageKey !== storageKey) throw new Error("Your accounts changed. Review the updated schedule before confirming.");
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to confirm scheduling safely across tabs.");
      if (!submission.targets.length || submission.targets.length > 3 || new Set(submission.targets.map(target => target.platform!)).size !== submission.targets.length || !submission.targets.every(target => connections.some(connection => connection.id === target.connectionId && connection.platform === target.platform))) throw new Error("Choose a connected account for each selected platform.");
      await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is confirming this schedule. Check its saved request first.");
        const prior = readSavedExploreSchedule(localStorage.getItem(storageKey), owner);
        if (prior && !prior.confirmed && !prior.timeRejected) { setSaved(prior); throw new Error("An earlier request is unconfirmed. Check that saved request before confirming again."); }
        if (prior?.timeRejected) {
          const checked = verifyExploreScheduleReply(await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(prior.input.requestKey)}`), prior);
          if (checked.preparation.state !== "unconfirmed") { accept(prior, checked); return; }
        }
        if (prior?.confirmed && prior.signature === composition.signature) {
          const checked = verifyExploreScheduleReply(await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(prior.input.requestKey)}`), prior);
          if (checked.preparation.state !== "failed" || checked.schedule?.targets.length !== 0) { accept(prior, checked); return; }
          // A verified preparation failure with no publishing targets can be
          // replaced only by this new explicit confirmation, never by polling.
        }
        const finishDraft = await composition.resolve();
        if (!alive.current || current.current.signature !== openSignature || currentIdentity.current.storageKey !== storageKey || currentIdentity.current.targetSignature !== targetSignature) throw new Error("Your clips or accounts changed. Review the updated schedule before confirming.");
        if (finishDraft.sourceAssetId !== composition.sourceId) throw new Error("The prepared video changed. Review the updated video before scheduling.");
        const entry: SavedExploreSchedule = { version: 1, owner, signature: composition.signature, confirmed: false, input: parseExplorePendingSchedule({ version: 1, requestKey: crypto.randomUUID(), draft: finishDraft,
          schedule: { caption: submission.caption, title: composition.title.slice(0,160), targets: submission.targets, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone } }) };
        localStorage.setItem(storageKey, JSON.stringify(entry)); setSaved(entry);
        onChange({ ...draft, caption: submission.caption, date: submission.scheduledDate, time: submission.scheduledTime, timezone: submission.timezone, platforms: submission.targets.map(target => target.platform!), connectionIds: Object.fromEntries(submission.targets.map(target => [target.platform, target.connectionId])), platform: submission.targets[0].platform!, connectionId: submission.targets[0].connectionId });
        await send(entry);
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not confirm scheduling. Check the saved request."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function retrySavedRequest() {
    if (!saved || saved.confirmed || result?.preparation.state !== "unconfirmed" || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to confirm scheduling safely across tabs.");
      await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is confirming this schedule. Check its saved request first.");
        const prior = readSavedExploreSchedule(localStorage.getItem(storageKey), owner);
        if (!prior || prior.input.requestKey !== saved.input.requestKey) throw new Error("The saved request changed. Check its current status.");
        if (prior.confirmed || prior.timeRejected) return;
        await send(prior);
      });
    }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not confirm the same request."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  const syncDraft = (snapshot: ScheduleEditorDraftSnapshot) => onChange({ ...draft, caption: snapshot.caption, date: snapshot.date, time: snapshot.time, timezone: snapshot.timezone,
    ...(snapshot.targets ? { platforms: snapshot.targets.map(target => target.platform!), connectionIds: Object.fromEntries(snapshot.targets.map(target => [target.platform, target.connectionId])), platform: snapshot.targets[0]?.platform ?? "", connectionId: snapshot.targets[0]?.connectionId ?? "" } : {}) });
  const pendingMedia: ScheduleMediaOption = { id: composition.sourceId, sourceType: "combined_video", status: "missing_render", title: composition.title };
  const actions = <div className={styles.actions} aria-label="Schedule actions">
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    <div className={styles.actionRow}>{onBackToEdit ? <Button type="button" variant="outline" className={styles.backButton} disabled={busy} onClick={onBackToEdit}><ArrowLeft size={16} aria-hidden="true" />Back to Edit</Button> : <span />}
      <div className={styles.reviewAction}><p role="status" className={styles.actionHelp}>{saved?.timeRejected && !saved.confirmed ? SCHEDULE_TIME_REJECTED_MESSAGE : boundResult?.preparation.message ?? composition.error ?? (unresolved ? "Check the earlier saved request before confirming another schedule." : "Save your schedule now. Video preparation will continue in the background.")}</p>
      <Button type="button" size="lg" className={styles.reviewButton} disabled={busy || formLoading || confirmed || !!composition.error || !composition.draft} onClick={() => { if (unresolved) void check(); else setFormAttempt(value => value + 1); }}>{busy ? "Checking…" : formLoading ? "Loading settings…" : unresolved ? "Check saved request" : confirmed ? "Schedule saved" : "Retry loading settings"}<ArrowRight size={16} aria-hidden="true" /></Button></div></div>
    {unresolved && result?.preparation.state === "unconfirmed" ? <Button type="button" variant="outline" disabled={busy} onClick={() => void retrySavedRequest()}>Confirm the same saved request</Button> : null}
    {confirmed ? <Link href="/scheduling" className="text-sm text-primary underline">View saved post in Scheduling</Link> : null}
  </div>;
  return <div hidden={!active} className={styles.panel}>{openSignature === composition.signature && !confirmed && (!unresolved || busy) ? <ScheduleEditor key={openSignature} presentation="workflow" pendingVideo={pendingMedia} demoMediaOptions={[pendingMedia]} hookMediaOptions={[]} editingIsCombinedVideo={false} editingPlannedPlatforms={[]} editingSchedule={null} editingScheduledDate={null} editingScheduledTime={null} initialClipSelection="secondary_only" initialDemoMediaId={pendingMedia.id} initialHookMediaId="" initialCaption={draft.caption} initialPlannedTargets={targets} initialScheduledDate={draft.date} initialScheduledTime={draft.time} initialTimezone={timezone} minimumScheduleLeadMinutes={lead} requireScheduleTarget saving={busy} errorMessage={error}
    socialConnections={connections} tiktokBetaEnabled youtubeBetaEnabled onClose={() => { if (!busy) onBackToEdit?.(); }} onCloseDraft={syncDraft} onDraftChange={syncDraft} onRefreshMedia={async () => true} onRefreshConnections={async () => {
      try { const value = await authorized(owner, "/api/social/connections"); parseWorkflowConnectedAccounts(value); setConnections(value.connections); return true; } catch { return false; }
    }} onSave={value => void confirm(value)} />
    : formLoading && canShowForm ? <p role="status">Loading scheduling settings…</p> : <WorkflowSchedulingPanel draft={draft} onChange={onChange} timezone={timezone} presentation="review" footer={actions} accountsControl={<WorkflowConnectedAccounts enabled active={active} ownerId={owner} platforms={platforms} selectedIds={workflowSelectedAccounts(draft)} onSelect={(platform,id) => onChange(selectWorkflowAccount(draft,platform,id))} />} />}</div>;
}
