"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { invalidateAccountSchedules, upsertAccountSchedule } from "@/lib/scheduling/account-data-query";
import { workflowAccountSelectionError, workflowScheduleTargets, workflowSelectedAccountIds, workflowSelectedPlatforms, selectWorkflowAccount, type WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";
import { prepareSimpleWorkflowSchedule } from "@/lib/explore/simple-workflow-schedule";
import { archiveConfirmedSchedule } from "@/lib/explore/schedule-repeat-intent";
import { isScheduleTimeout, requestWorkflowSchedule } from "@/lib/explore/workflow-schedule-transport";
import { parseExplorePendingSchedule, type ExplorePendingScheduleResult } from "@/lib/explore/pending-schedule-contract";
import { readSavedExploreSchedule, verifyExploreScheduleReply, type ExploreScheduleComposition, type SavedExploreSchedule } from "@/lib/explore/pending-schedule-client";
import { isScheduleTimeRejected, isScheduleSubmissionRejected, SCHEDULE_TIME_REJECTED_MESSAGE } from "@/lib/explore/workflow-schedule-client";
import styles from "@/components/explore/workflow-schedule-review.module.css";
import { pollInForeground } from "@/lib/http/foreground-polling";

async function authorized(owner: string, url: string, init?: RequestInit) {
  return requestWorkflowSchedule({ token: () => getCurrentUserIdToken(owner), fetch }, url, init);
}
export function useBackgroundScheduleAvailability(owner: string | null, enabled: boolean) {
  return useQuery({ queryKey: ["explore-background-scheduling", owner], enabled: enabled && !!owner, staleTime: 60000, retry: false,
    queryFn: async () => { try { return (await authorized(owner!, "/api/explore/schedules?configOnly=1")).enabled === true; } catch { return false; } } });
}

/** Confirmation saves a durable render/schedule snapshot. Polling never POSTs. */
export function PendingExploreSchedulePanel({ owner, scope, composition, draft, onChange, timezone, active, onBackToEdit, onScheduled }: {
  owner: string; scope: string; composition: ExploreScheduleComposition; draft: WorkflowScheduleDraft; onChange: (value: WorkflowScheduleDraft) => void;
  timezone: string; active: boolean; onBackToEdit?: () => void;
  onScheduled?: () => void;
}) {
  const queryClient = useQueryClient();
  const storageKey = `ugc-explore:background-schedule:v1:${encodeURIComponent(owner)}:${encodeURIComponent(scope)}`;
  const [saved, setSaved] = useState<SavedExploreSchedule | null>(null), [result, setResult] = useState<ExplorePendingScheduleResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("Checking your publishing settings…");
  const [restored, setRestored] = useState(false);
  const current = useRef(composition), working = useRef(false), alive = useRef(true);
  const scheduledCallback = useRef(onScheduled);
  useEffect(() => { scheduledCallback.current = onScheduled; }, [onScheduled]);
  const targets = workflowScheduleTargets(draft), platforms = workflowSelectedPlatforms(draft);
  const targetSignature = JSON.stringify([draft, timezone]);
  const currentIdentity = useRef({ storageKey, targetSignature });
  useLayoutEffect(() => { current.current = composition; currentIdentity.current = { storageKey, targetSignature }; }, [composition, storageKey, targetSignature]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const accept = useCallback((entry: SavedExploreSchedule, raw: unknown) => {
    const value = verifyExploreScheduleReply(raw, entry);
    if (!alive.current || currentIdentity.current.storageKey !== storageKey) return;
    if (readSavedExploreSchedule(localStorage.getItem(storageKey), owner)?.input.requestKey !== entry.input.requestKey) return;
    if (value.schedule) {
      upsertAccountSchedule(queryClient, owner, value.schedule);
      void invalidateAccountSchedules(queryClient, owner);
    }
    const next = { ...entry, confirmed: value.preparation.state !== "unconfirmed", timeRejected: value.preparation.state === "unconfirmed" ? entry.timeRejected : undefined };
    setSaved(next); setResult(value);
    if (next.confirmed) localStorage.setItem(storageKey, JSON.stringify(next));
    if (value.preparation.state === "scheduled" && value.schedule) scheduledCallback.current?.();
  }, [storageKey, owner, queryClient]);
  useEffect(() => {
    let stopped = false;
    void Promise.resolve().then(async () => {
      if (stopped) return;
      setSaved(null); setResult(null); setError(null); setRestored(false);
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
    let stopped = false;
    const stop = pollInForeground({ poll: async () => {
      try { const value = await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(saved.input.requestKey)}`); if (!stopped) accept(saved, value); }
      catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Could not refresh preparation."); }
    }, intervalMs: 5000 });
    return () => { stopped = true; stop(); };
  }, [active, saved, result?.preparation.state, owner, accept]);
  const matchesDestinations = (entry: SavedExploreSchedule) => {
    const keys = (values: readonly { platform?: string; connectionId: string }[]) => values.map(target => `${target.platform}:${target.connectionId}`).sort().join("|");
    return keys(entry.input.schedule.targets ?? []) === keys(targets);
  };
  const boundResult = saved?.signature === composition.signature ? result : null;
  const failedBeforePublishing = boundResult?.preparation.state === "failed" && boundResult.schedule?.targets.length === 0;
  const confirmed = saved?.signature === composition.signature && saved.confirmed && matchesDestinations(saved) && !failedBeforePublishing;
  const unresolved = !!saved && !saved.confirmed && !saved.timeRejected;
  async function startAnother() {
    if (!active || !restored || !saved?.confirmed || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to schedule safely across tabs.");
      await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is scheduling this post. Please wait.");
        const prior = readSavedExploreSchedule(localStorage.getItem(storageKey), owner);
        if (currentIdentity.current.storageKey !== storageKey || !alive.current) return;
        if (!prior) { setSaved(null); setResult(null); return; }
        if (!prior.confirmed || prior.input.requestKey !== saved.input.requestKey) { setSaved(prior); setResult(null); throw new Error("Scheduling changed in another tab. Try again."); }
        archiveConfirmedSchedule(localStorage, storageKey, prior.input.requestKey, prior);
        setSaved(null); setResult(null);
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not start another schedule."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function send(entry: SavedExploreSchedule) {
    setProgress("Saving your scheduled post…");
    try {
      accept(entry, await authorized(owner, "/api/explore/schedules", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": entry.input.requestKey }, body: JSON.stringify(entry.input) }));
    } catch (error) {
      if (isScheduleTimeRejected(error) && !entry.confirmed && alive.current && currentIdentity.current.storageKey === storageKey) {
        const rejected = { ...entry, timeRejected: true as const };
        localStorage.setItem(storageKey, JSON.stringify(rejected)); setSaved(rejected); setResult(null);
        throw error;
      }
      // A lost response is reconciled silently. Only a verified server receipt
      // can show success; this read never creates a second post.
      setProgress("Checking whether your post was saved…");
      let rejected = false;
      try {
        const checked = verifyExploreScheduleReply(await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(entry.input.requestKey)}`), entry);
        if (checked.preparation.state !== "unconfirmed") { accept(entry, checked); return; }
        if (isScheduleSubmissionRejected(error) && !entry.confirmed && alive.current && currentIdentity.current.storageKey === storageKey && readSavedExploreSchedule(localStorage.getItem(storageKey), owner)?.input.requestKey === entry.input.requestKey) {
          localStorage.removeItem(storageKey); setSaved(null); setResult(null); setProgress("Review your updated choices, then click Schedule post."); rejected = true;
        }
      } catch { /* Keep the exact durable request for the single Try again action. */ }
      if (rejected) throw error;
      throw new Error("We could not confirm whether your post was scheduled. Your request is kept; Try again checks the same post.");
    }
  }
  async function schedule() {
    if (!active || !restored || working.current || confirmed || composition.error || !composition.draft) return;
    working.current = true; setBusy(true); setError(null); setProgress("Checking your publishing settings…");
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to schedule safely across tabs.");
      await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is scheduling this post. Please wait.");
        const prior = readSavedExploreSchedule(localStorage.getItem(storageKey), owner);
        if (prior && !prior.confirmed && !prior.timeRejected) {
          setSaved(prior);
          const checked = verifyExploreScheduleReply(await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(prior.input.requestKey)}`), prior);
          if (checked.preparation.state !== "unconfirmed") { accept(prior, checked); return; }
          await send(prior); return;
        }
        if (prior?.timeRejected) {
          const checked = verifyExploreScheduleReply(await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(prior.input.requestKey)}`), prior);
          if (checked.preparation.state !== "unconfirmed") { accept(prior, checked); return; }
        }
        if (prior?.confirmed && prior.signature === composition.signature && matchesDestinations(prior)) {
          const checked = verifyExploreScheduleReply(await authorized(owner, `/api/explore/schedules?requestKey=${encodeURIComponent(prior.input.requestKey)}`), prior);
          if (checked.preparation.state !== "failed" || checked.schedule?.targets.length !== 0) { accept(prior, checked); return; }
          // A verified preparation failure with no publishing targets can be
          // replaced only by this new explicit confirmation, never by polling.
        }
        const submission = await prepareSimpleWorkflowSchedule({ draft, timezone, source: { kind: "media_asset", id: composition.sourceId }, title: composition.title, load: url => authorized(owner, url) });
        setProgress("Preparing your video and background audio…");
        let finishDraft;
        try { finishDraft = await composition.resolve(); }
        catch (error) {
          if (isScheduleTimeout(error)) throw new Error("Preparing your video or background audio took too long. Your post has not been submitted. Try Schedule post again; if it repeats, return to Edit to check your audio.");
          throw error;
        }
        if (!alive.current || current.current.signature !== composition.signature || currentIdentity.current.storageKey !== storageKey || currentIdentity.current.targetSignature !== targetSignature) throw new Error("Your clips or accounts changed. Review the updated schedule before confirming.");
        if (finishDraft.sourceAssetId !== composition.sourceId) throw new Error("The prepared video changed. Review the updated video before scheduling.");
        const entry: SavedExploreSchedule = { version: 1, owner, signature: composition.signature, confirmed: false, input: parseExplorePendingSchedule({ version: 1, requestKey: crypto.randomUUID(), draft: finishDraft,
          schedule: { caption: submission.caption, title: composition.title.slice(0,160), targets: submission.targets, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone, ...(submission.useDefaultScheduleTime ? { useDefaultScheduleTime: true } : {}) } }) };
        if (prior?.confirmed) archiveConfirmedSchedule(localStorage, storageKey, prior.input.requestKey, prior);
        localStorage.setItem(storageKey, JSON.stringify(entry)); setSaved(entry);
        await send(entry);
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not schedule your post. Try again."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  const preparationState = boundResult?.preparation.state;
  const actionHelp = saved?.timeRejected && !saved.confirmed ? SCHEDULE_TIME_REJECTED_MESSAGE
    : preparationState === "failed" ? "Video preparation failed. You can try scheduling again."
    : preparationState === "cancelled" ? "This post was cancelled. You can schedule another post."
    : confirmed ? "Post scheduled"
    : composition.error ?? (!confirmed && !unresolved ? workflowAccountSelectionError(draft) : null) ?? (unresolved ? "Try again checks your earlier post with its original accounts. Your new choices are kept for another post." : "Choose your accounts, caption, date and time, then schedule your post.");
  const accountProblem = !confirmed && !unresolved ? workflowAccountSelectionError(draft) : null;
  const actions = <div className={styles.actions} aria-label="Schedule actions">
    {accountProblem && composition.error ? <p role="alert" className="text-xs text-destructive">{accountProblem}</p> : null}
    {composition.error && composition.retryLoad ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={composition.retryLoad}>Retry loading saved edits</Button> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    <div className={styles.actionRow}>{onBackToEdit ? <Button type="button" variant="outline" className={styles.backButton} disabled={busy} onClick={onBackToEdit}><ArrowLeft size={16} aria-hidden="true" />Back to Edit</Button> : <span />}
      <div className={styles.reviewAction}><div className={`${styles.actionHelp} ${styles.confirmation}`}><p role="status">{busy ? progress : actionHelp}</p>{confirmed ? <Link href="/scheduling" className={`${styles.schedulingLink} ${styles.compactSchedulingLink}`}>View in Scheduling<ArrowRight size={14} aria-hidden="true" /></Link> : null}</div>
      <Button type="button" size="lg" className={styles.reviewButton} disabled={!restored || busy || !!composition.error || !composition.draft || !confirmed && !unresolved && !targets.length} onClick={() => { if (confirmed) void startAnother(); else void schedule(); }}>{busy ? "Scheduling…" : !confirmed && unresolved ? "Try again" : (draft.publishMode === "now" || !draft.publishMode && !draft.date && !draft.time) ? "Post now" : "Schedule post"}<ArrowRight size={16} aria-hidden="true" /></Button></div></div>
  </div>;
  return <div hidden={!active} className={styles.panel}><WorkflowSchedulingPanel ownerId={owner} captionEnabled={active && restored && !saved} captionScope={scope} draft={draft} onChange={onChange} timezone={timezone} presentation="review" footer={actions} accountsControl={<WorkflowConnectedAccounts enabled active={active} ownerId={owner} platforms={platforms} selectedIds={workflowSelectedAccountIds(draft)} onSelect={(platform,id) => onChange(selectWorkflowAccount(draft,platform,id))} />} /></div>;
}
