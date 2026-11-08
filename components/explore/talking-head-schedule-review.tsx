"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useDeviceTimeFormat } from "@/components/scheduling/use-device-time-format";
import { displayScheduleTime } from "@/lib/scheduling/time-display";
import { Button } from "@/components/ui/button";
import type { WorkflowAction } from "@/components/explore/use-workflow-finishing";
import { workflowSelectedAccountIds, workflowSelectedPlatforms, workflowAccountSelectionError, type WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";
import reviewStyles from "@/components/explore/workflow-schedule-review.module.css";

/** Review copy describes the current draft; the finishing boundary still validates submission. */
export function TalkingHeadScheduleSummary({ draft, timezone }: { draft: WorkflowScheduleDraft; timezone?: string }) {
  const deviceHour12 = useDeviceTimeFormat();
  const platforms = workflowSelectedPlatforms(draft);
  const accounts = workflowSelectedAccountIds(draft);
  const selectedAccountCount = new Set(Object.values(accounts).flat()).size;
  const destinations = platforms.map(platform => platform === "instagram" ? "Instagram Reels" : platform === "tiktok" ? "TikTok" : "YouTube").join(" + ");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? new Date(`${draft.date}T12:00:00Z`) : null;
  const timing = (draft.publishMode === "now" || !draft.publishMode && !draft.date && !draft.time) ? "Earliest available" : date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === draft.date && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
    ? `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date)}, ${displayScheduleTime(draft.time, deviceHour12)}`
    : "Choose date and time";
  return <section aria-label="Schedule summary" className={reviewStyles.summary}>
    <h3 className="sr-only">Schedule summary</h3>
    <p className={reviewStyles.summaryDestination}>{destinations || "Choose where to publish"}</p>
    <p>{!workflowAccountSelectionError(draft) ? `${selectedAccountCount} ${selectedAccountCount === 1 ? "account" : "accounts"} selected` : "Choose an account for each platform"}<span aria-hidden="true"> · </span>{timing}<span aria-hidden="true"> · </span>{timezone || "Your device’s time zone"}</p>
  </section>;
}

/** The Schedule action schedules, and prepares the video first when it is not ready yet. */
export function TalkingHeadScheduleActions({ action, preparation, outputReady = true, prepareDisabled = false, enabled, help, onBackToEdit }: {
  action?: WorkflowAction; preparation?: WorkflowAction; outputReady?: boolean; prepareDisabled?: boolean; enabled: boolean; help?: string; onBackToEdit: () => void;
}) {
  const prepareThenSchedule = useRef(false);
  const submitted = useRef(false);
  const schedulingBusy = Boolean(action?.busy);
  const preparationBusy = Boolean(preparation?.busy || preparation?.processing);
  const preparing = preparationBusy;
  const canPrepare = Boolean(preparation && !preparation.disabled && !prepareDisabled);
  const busy = schedulingBusy || preparing;
  const error = action?.error ?? preparation?.error;
  const message = preparing ? "Preparing your final video. It will be scheduled when ready." : help ?? action?.message;
  const disabled = !enabled || (outputReady ? !action || action.disabled || schedulingBusy : !canPrepare || preparing);
  useEffect(() => {
    if (!prepareThenSchedule.current || submitted.current) return;
    if (preparation?.error) { prepareThenSchedule.current = false; return; }
    if (!outputReady || !action || action.disabled || action.busy) return;
    submitted.current = true;
    prepareThenSchedule.current = false;
    action.onAction();
  }, [outputReady, action, preparation?.error]);
  function run() {
    if (outputReady) {
      prepareThenSchedule.current = false;
      submitted.current = true;
      action?.onAction();
      return;
    }
    if (!canPrepare) return;
    submitted.current = false;
    prepareThenSchedule.current = true;
    preparation?.onAction();
  }
  return <div className={reviewStyles.actions} aria-label="Schedule actions">
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    <div className={reviewStyles.actionRow}>
      <Button type="button" variant="outline" disabled={busy} className={reviewStyles.backButton} onClick={onBackToEdit}><ArrowLeft size={16} aria-hidden="true" />Back to Edit</Button>
      <div className={reviewStyles.reviewAction}>
        <div className={`${reviewStyles.actionHelp} ${reviewStyles.confirmation}`}><p role="status">{enabled && (action || preparation) ? message : "Preview · scheduling disabled"}</p>{action?.completed ? <a href="/scheduling" className={`${reviewStyles.schedulingLink} ${reviewStyles.compactSchedulingLink}`}>View in Scheduling<ArrowRight size={14} aria-hidden="true" /></a> : null}</div>
        <Button type="button" size="lg" className={reviewStyles.reviewButton} disabled={disabled} aria-busy={busy} onClick={run}>{preparing ? "Preparing video…" : schedulingBusy ? "Scheduling…" : action?.label ?? (error ? "Try again" : "Schedule post")}<ArrowRight size={16} aria-hidden="true" /></Button>
      </div>
    </div>
    {preparation?.error && preparation.refresh ? <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={preparation.refresh}>Refresh status</Button></div> : null}
  </div>;
}
