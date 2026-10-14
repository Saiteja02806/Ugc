"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkflowAction } from "@/components/explore/use-workflow-finishing";
import { workflowSelectedAccounts, workflowSelectedPlatforms, type WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";
import reviewStyles from "@/components/explore/workflow-schedule-review.module.css";

/** Review copy describes the current draft; the finishing boundary still validates submission. */
export function TalkingHeadScheduleSummary({ draft, timezone }: { draft: WorkflowScheduleDraft; timezone?: string }) {
  const platforms = workflowSelectedPlatforms(draft);
  const accounts = workflowSelectedAccounts(draft);
  const selectedAccountCount = new Set(platforms.map(platform => accounts[platform]).filter(Boolean)).size;
  const destinations = platforms.map(platform => platform === "instagram" ? "Instagram Reels" : platform === "tiktok" ? "TikTok" : "YouTube").join(" + ");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? new Date(`${draft.date}T12:00:00Z`) : null;
  const timing = date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === draft.date && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
    ? `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date)}, ${draft.time}`
    : "Choose date and time";
  return <section aria-label="Schedule summary" className={reviewStyles.summary}>
    <h3 className="sr-only">Schedule summary</h3>
    <p className={reviewStyles.summaryDestination}>{destinations || "Choose where to publish"}</p>
    <p>{selectedAccountCount === platforms.length && selectedAccountCount > 0 ? `${selectedAccountCount} ${selectedAccountCount === 1 ? "account" : "accounts"} selected` : "Choose an account for each platform"}<span aria-hidden="true"> · </span>{timing}<span aria-hidden="true"> · </span>{timezone || "Your device’s time zone"}</p>
  </section>;
}

/** Both preparation and review reuse the finishing boundary's guarded actions. */
export function TalkingHeadScheduleActions({ action, preparation, enabled, onBackToEdit }: { action?: WorkflowAction; preparation?: WorkflowAction; enabled: boolean; onBackToEdit: () => void }) {
  // An enabled schedule action can resume an existing durable request, even
  // before the current output has reloaded. Keep that recovery path available.
  const needsPreparation = Boolean(preparation && !action?.busy && (!action || action.disabled));
  const current = needsPreparation ? preparation : action;
  const busy = Boolean(current?.busy);
  const preparing = needsPreparation && Boolean(current?.processing || current?.cancel);
  const error = current?.error ?? action?.error;
  const refresh = current?.error || !error ? current?.refresh : action?.refresh;
  return <div className={reviewStyles.actions} aria-label="Schedule actions">
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    <div className={reviewStyles.actionRow}>
      <Button type="button" variant="outline" disabled={busy} className={reviewStyles.backButton} onClick={onBackToEdit}><ArrowLeft size={16} aria-hidden="true" />Back to Edit</Button>
      <div className={reviewStyles.reviewAction}>
        <p className={reviewStyles.actionHelp} role="status">{enabled && current ? current.message : "Preview · scheduling disabled"}</p>
        <Button type="button" size="lg" className={reviewStyles.reviewButton} disabled={!enabled || !current || current.disabled || busy} aria-busy={busy || preparing} onClick={current?.onAction}>{needsPreparation ? busy || preparing ? "Preparing video…" : current?.error ? "Retry final video" : "Prepare final video" : busy ? "Checking…" : action?.message.includes("interrupted schedule") || action?.message.includes("Resume the saved") ? "Resume saved request" : action?.message.includes("is scheduled") || action?.message.includes("schedule is saved") ? "Schedule saved" : "Schedule post"}<ArrowRight size={16} aria-hidden="true" /></Button>
      </div>
    </div>
    {current && (error || preparing) ? <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={refresh}>Refresh status</Button>{needsPreparation && current.cancel ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={current.cancel}>Cancel preparation</Button> : null}</div> : null}
  </div>;
}
