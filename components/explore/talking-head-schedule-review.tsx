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

/** Moving the controls does not create a second scheduling or preparation action. */
export function TalkingHeadScheduleActions({ action, enabled, onBackToEdit }: { action?: WorkflowAction; enabled: boolean; onBackToEdit: () => void }) {
  const busy = Boolean(action?.busy);
  return <div className={reviewStyles.actions}>
    {action?.error ? <div className="space-y-1"><p role="alert" className="text-xs leading-5 text-destructive">{action.error}</p><Button type="button" variant="ghost" disabled={busy} onClick={action.refresh}>Refresh status</Button></div> : null}
    <div className={reviewStyles.actionRow}>
      <Button type="button" variant="outline" disabled={busy} className={reviewStyles.backButton} onClick={onBackToEdit}><ArrowLeft size={16} aria-hidden="true" />Back to Edit</Button>
      <div className={reviewStyles.reviewAction}>
        <p className={reviewStyles.actionHelp} role="status">{enabled && action ? action.message : "Preview · scheduling disabled"}</p>
        <Button type="button" size="lg" className={reviewStyles.reviewButton} disabled={!enabled || !action || action.disabled || busy} aria-busy={busy} onClick={action?.onAction}>{busy ? "Checking…" : "Review schedule"}<ArrowRight size={16} aria-hidden="true" /></Button>
      </div>
    </div>
  </div>;
}
