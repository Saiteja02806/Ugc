"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { EMPTY_SCHEDULE_DRAFT, WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { useAccountTimeZone } from "@/components/providers/account-timezone-provider";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { workflowScheduleTargets, workflowSelectedAccounts, workflowSelectedPlatforms, selectWorkflowAccount } from "@/lib/explore/workflow-scheduling-draft";
import type { WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";
import { formatScheduleDraftKey, readFormatScheduleDraft, serializeFormatScheduleDraft } from "@/lib/explore/format-schedule-draft";
import { readScheduleReceipt, verifySavedSchedule, scheduleReceiptMessage, isScheduleTimeRejected, SCHEDULE_TIME_REJECTED_MESSAGE, type ScheduleReceipt } from "@/lib/explore/workflow-schedule-client";
import { prepareSimpleWorkflowSchedule } from "@/lib/explore/simple-workflow-schedule";
import { archiveConfirmedSchedule } from "@/lib/explore/schedule-repeat-intent";
import { requestWorkflowSchedule } from "@/lib/explore/workflow-schedule-transport";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { invalidateAccountSchedules, upsertAccountSchedule } from "@/lib/scheduling/account-data-query";
import reviewStyles from "@/components/explore/workflow-schedule-review.module.css";
import { PendingExploreSchedulePanel } from "@/components/explore/pending-schedule-panel";
import type { ExploreScheduleComposition } from "@/lib/explore/pending-schedule-client";

export function FormatSchedulePanel({ output, localPreview, imageOnly, active, format, pendingSource = false, preparing = false, draftScopeId, onBackToEdit, pendingComposition }: {
  output: { id: string; kind: "media_asset" | "library_item"; url: string; title: string } | null; localPreview: boolean; imageOnly: boolean; active: boolean;
  format: "hook" | "wall_text" | "slideshow";
  pendingSource?: boolean;
  preparing?: boolean; draftScopeId?: string;
  onBackToEdit?: () => void;
  pendingComposition?: ExploreScheduleComposition | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountTimezone = useAccountTimeZone();
  const owner = user?.uid ?? (localPreview ? "signed-out-preview" : null);
  // Form settings follow the selected source while rendering replaces its
  // final output. Confirmed schedule receipts still use that exact output.
  const draftKey = owner ? formatScheduleDraftKey({ environment: localPreview ? "preview" : "live", owner, format, output: draftScopeId ? { id: draftScopeId, kind: imageOnly ? "library_item" : "media_asset" } : output }) : null;
  const [storedDraft, setStoredDraft] = useState<{ key: string | null; draft: WorkflowScheduleDraft }>({ key: null, draft: EMPTY_SCHEDULE_DRAFT });
  const hydratedDraftKey = useRef<string | null>(null);
  const draft = storedDraft.key === draftKey ? storedDraft.draft : EMPTY_SCHEDULE_DRAFT;
  const timezone = draft.timezone ?? accountTimezone;
  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      if (hydratedDraftKey.current === draftKey) return;
      let restored: WorkflowScheduleDraft | null = null;
      try { restored = readFormatScheduleDraft(localStorage.getItem(draftKey), draftKey); } catch { /* Storage is optional for unsent forms. */ }
      hydratedDraftKey.current = draftKey;
      setStoredDraft({ key: draftKey, draft: restored ?? EMPTY_SCHEDULE_DRAFT });
    }, 0);
    return () => clearTimeout(timer);
  }, [draftKey]);
  function setDraft(next: WorkflowScheduleDraft) {
    hydratedDraftKey.current = draftKey;
    setStoredDraft({ key: draftKey, draft: next });
    if (draftKey) try {
      const serialized = serializeFormatScheduleDraft(draftKey, next);
      if (serialized) localStorage.setItem(draftKey, serialized);
    } catch { /* Editing still works if browser storage is unavailable. */ }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedReceipt, setReceipt] = useState<ScheduleReceipt | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const alive = useRef(true), working = useRef(false);
  const key = `ugc-explore:schedule:v1:${user?.uid}:format:${output?.kind}:${output?.id}`;
  const currentKey = useRef(key);
  useLayoutEffect(() => { currentKey.current = key; }, [key]);
  const identity = JSON.stringify([key, draft, timezone]);
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => { currentIdentity.current = identity; }, [identity]);
  const receipt = savedReceipt?.input.source.id === output?.id && savedReceipt?.input.source.kind === output?.kind ? savedReceipt : null;
  const platforms = workflowSelectedPlatforms(draft);
  const targets = workflowScheduleTargets(draft);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function saved() { return user && output ? readScheduleReceipt(localStorage.getItem(key), user.uid, "hook", output.kind) : null; }
  async function authorized(url: string, init?: RequestInit) {
    const requestKey = key;
    return requestWorkflowSchedule({ token: () => getCurrentUserIdToken(user?.uid), fetch,
      assertActive: () => { if (!alive.current || currentKey.current !== requestKey) throw new Error("This workflow changed. Review its schedule again."); } }, url, init);
  }
  function accept(entry: ScheduleReceipt, data: unknown) {
    const schedule = verifySavedSchedule(data, entry);
    if (saved()?.input.idempotencyKey !== entry.input.idempotencyKey) return;
    upsertAccountSchedule(queryClient, entry.owner, schedule);
    void invalidateAccountSchedules(queryClient, entry.owner);
    const next = { ...entry, scheduleId: schedule.id, timeRejected: undefined };
    setReceipt(next); setMessage(scheduleReceiptMessage(schedule));
    if (draftKey) try { localStorage.removeItem(draftKey); } catch { /* The confirmed receipt remains the scheduling authority. */ }
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { setError("The post is saved. Review it in Scheduling."); }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setReceipt(null); setMessage(null); setError(null);
      if (!user || !output || localPreview) return;
      try { const prior = saved(); setReceipt(prior); if (prior) setMessage(prior.scheduleId ? "Post scheduled" : prior.timeRejected ? SCHEDULE_TIME_REJECTED_MESSAGE : "Scheduling was interrupted. Try again to finish scheduling your post."); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not restore scheduling."); }
    }, 0);
    return () => clearTimeout(timer);
    // Restore once per output; never publish or POST during hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, localPreview]);
  async function send(entry: ScheduleReceipt) {
    try { accept(entry, await authorized("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry.input) })); }
    catch (e) {
      if (isScheduleTimeRejected(e) && !entry.scheduleId) {
        const rejected = { ...entry, timeRejected: true as const };
        localStorage.setItem(key, JSON.stringify(rejected)); setReceipt(rejected); setMessage(SCHEDULE_TIME_REJECTED_MESSAGE);
        throw e;
      }
      try {
        const value = await authorized("/api/schedules");
        const match = Array.isArray(value.schedules) && value.schedules.find((item: { idempotencyKey?: string }) => item.idempotencyKey === entry.input.idempotencyKey);
        if (match) { accept(entry, { ok: true, schedule: match }); return; }
      } catch { /* Preserve the same idempotency key for Try again. */ }
      throw new Error("Could not schedule your post. Try again.");
    }
  }
  async function schedule() {
    if (!active || !user || !output || localPreview || pendingSource || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to schedule safely across tabs.");
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is scheduling this output.");
        if (!alive.current || currentKey.current !== key) return;
        const prior = saved();
        if (prior?.scheduleId) {
          if (receipt?.scheduleId !== prior.scheduleId) { accept(prior, await authorized(`/api/schedules/${prior.scheduleId}`)); return; }
          archiveConfirmedSchedule(localStorage, key, prior.input.idempotencyKey!, prior);
          setReceipt(null); setMessage(null);
          return;
        }
        // A stale click from a confirmed screen only opens the new intent;
        // it cannot immediately submit it after another tab cleared the receipt.
        if (!prior && receipt?.scheduleId) { setReceipt(null); return; }
        if (prior && !prior.timeRejected) { await send(prior); return; }
        if (prior?.timeRejected) {
          const value = await authorized("/api/schedules");
          if (!Array.isArray(value.schedules)) throw new Error("Could not verify the rejected scheduling request.");
          const match = value.schedules.find((item: { idempotencyKey?: string }) => item.idempotencyKey === prior.input.idempotencyKey);
          if (match) { accept(prior, { ok: true, schedule: match }); return; }
        }
        const submission = await prepareSimpleWorkflowSchedule({ draft, timezone, source: { kind: output.kind, id: output.id }, title: output.title, load: authorized });
        if (!alive.current || currentIdentity.current !== identity) throw new Error("Your video or schedule changed. Check the current selections and click Schedule post again.");
        const entry: ScheduleReceipt = { version: 1, owner: user.uid, kind: "hook", input: { source: submission.scheduledSource, title: output.title, caption: submission.caption, targets: submission.targets, scheduledFor: submission.scheduledFor, scheduledDate: submission.scheduledDate, scheduledTime: submission.scheduledTime, timezone: submission.timezone, idempotencyKey: prior?.timeRejected ? prior.input.idempotencyKey : `explore:${crypto.randomUUID()}`, metadata: { mediaMode: imageOnly ? "carousel" : "single_video", exploreWorkflow: "format" } } };
        readScheduleReceipt(JSON.stringify(entry), user.uid, "hook", output.kind);
        localStorage.setItem(key, JSON.stringify(entry)); setReceipt(entry); await send(entry);
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not schedule your post. Try again."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  const actionHelp = localPreview ? "Preview · scheduling disabled" : pendingSource ? imageOnly ? "Your slideshow changes are still being prepared. Finish them before scheduling." : "Your selected video is uploading. You can choose your posting settings below." : !output ? preparing ? "Preparing your publishing file. Choose your accounts, caption and time while it finishes." : imageOnly ? "Save your final edits before scheduling." : "Add at least one video in Create or Demo before scheduling." : busy ? "Checking your video and scheduling settings…" : receipt?.scheduleId ? "Your previous post is saved. You can schedule this content again." : !receipt && !targets.length ? "Choose a connected account for each selected platform." : "Choose your accounts and time, then click Schedule post.";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? new Date(`${draft.date}T12:00:00Z`) : null;
  const timing = date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === draft.date && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
    ? `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date)}, ${draft.time}`
    : "Choose date and time";
  const destinations = platforms.map(platform => platform === "instagram" ? imageOnly ? "Instagram" : "Instagram Reels" : platform === "tiktok" ? "TikTok" : "YouTube").join(" + ");
  const selectedAccounts = workflowSelectedAccounts(draft);
  const selectedAccountCount = new Set(platforms.map(platform => selectedAccounts[platform]).filter(Boolean)).size;
  const actions = <div hidden={!active} className={reviewStyles.actions} aria-label="Schedule actions">
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {message ? <p role="status" className="text-xs leading-5 text-muted">{message}</p> : null}
    <div className={reviewStyles.actionRow}>
      {onBackToEdit ? <Button type="button" variant="outline" disabled={busy} className={reviewStyles.backButton} onClick={onBackToEdit}><ArrowLeft size={16} aria-hidden="true" />Back to Edit</Button> : <span />}
      <div className={reviewStyles.reviewAction}>
        <p className={reviewStyles.actionHelp} role="status">{actionHelp}</p>
        <Button type="button" size="lg" className={reviewStyles.reviewButton} disabled={localPreview || pendingSource || !output || busy || !receipt && !targets.length} onClick={() => void schedule()}>{busy ? "Scheduling…" : receipt && !receipt.scheduleId && !receipt.timeRejected ? "Try again" : "Schedule post"}<ArrowRight size={16} aria-hidden="true" /></Button>
      </div>
    </div>
    {receipt?.scheduleId ? <Link href="/scheduling" className="text-sm text-primary underline">View in Scheduling</Link> : null}
  </div>;
  if (pendingComposition && user && !localPreview && !imageOnly) return <PendingExploreSchedulePanel key={`${format}:${draftScopeId}`} owner={user.uid} scope={`${format}:${draftScopeId ?? "workflow"}`} composition={pendingComposition} draft={draft} onChange={setDraft} timezone={timezone} active={active} onBackToEdit={onBackToEdit} />;
  return <div hidden={!active} className={reviewStyles.panel}><div><WorkflowSchedulingPanel draft={draft} onChange={setDraft} imageOnly={imageOnly} timezone={timezone} presentation="review" footer={actions} accountsControl={<WorkflowConnectedAccounts enabled={!localPreview} active={active} ownerId={user?.uid ?? null} platforms={platforms} selectedIds={workflowSelectedAccounts(draft)} onSelect={(platform, id) => setDraft(selectWorkflowAccount(draft, platform, id))} />} /></div>
    <section aria-label="Schedule summary" className={reviewStyles.summary}>
      <h3 className="sr-only">Schedule summary</h3>
      <p className={reviewStyles.summaryDestination}>{destinations || "Choose where to publish"}</p>
      <p>{selectedAccountCount === platforms.length && selectedAccountCount > 0 ? `${selectedAccountCount} ${selectedAccountCount === 1 ? "account" : "accounts"} selected` : "Choose an account for each platform"}<span aria-hidden="true"> · </span>{timing}<span aria-hidden="true"> · </span>{timezone || "Your device’s time zone"}</p>
    </section>
  </div>;
}
