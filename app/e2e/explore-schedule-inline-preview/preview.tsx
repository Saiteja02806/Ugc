"use client";

import { useState } from "react";
import { ScheduleEditor, type ScheduleEditorDraftSnapshot } from "@/components/scheduling/schedule-editor";
import { WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { Button } from "@/components/ui/button";
import type { SocialConnection } from "@/lib/social/types";
import type { ScheduleMediaOption } from "@/lib/scheduling/types";
import type { WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";

const account: SocialConnection = {
  connectedAt: "2026-10-01T00:00:00Z", expiresAt: null, id: "00000000-0000-4000-8000-000000000001",
  platform: "instagram", platformAccountId: "fixture-instagram", platformAccountName: "Local preview account",
  platformAccountUsername: "local_preview", profilePictureUrl: null, provider: "meta", refreshExpiresAt: null,
  scopes: ["instagram_business_content_publish"], status: "connected", supportsBackgroundRefresh: true,
  tokenRefreshedAt: null, updatedAt: "2026-10-01T00:00:00Z",
};
const video: ScheduleMediaOption = { id: "00000000-0000-4000-8000-000000000010", sourceType: "combined_video", status: "ready", title: "Local preview footage", mediaUrl: "/marketing/showcase-part2/demo-preview.mp4" };

/** Actual review controls with local fixture values and a non-publishing callback. */
export function InlineSchedulePreview() {
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<WorkflowScheduleDraft>({ platform: "instagram", caption: "Plan your day in one place.", date: "2026-10-20", time: "16:30", timezone: "Asia/Calcutta", connectionId: account.id });
  function retain(snapshot: ScheduleEditorDraftSnapshot) { setDraft(current => ({ ...current, ...snapshot })); }
  return <section className="min-h-dvh bg-background text-foreground">
    <header className="flex flex-wrap items-center gap-6 px-6 py-4"><span className="font-semibold">Explore / Hook video</span><span>Create</span><span>Edit</span><span className="border-b-2 border-primary pb-2 font-semibold">Schedule</span></header>
    <div className="grid items-start gap-6 px-6 pb-6 lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
      <section className="rounded-xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">Final video preview</h2><video src={video.mediaUrl} aria-label="Local final video preview" controls playsInline className="mx-auto mt-5 max-h-[60dvh] max-w-full rounded-xl" /><p className="mt-4 text-sm text-muted">Development fixture. No rendering or publishing.</p></section>
      <div className="min-w-0">
        {review ? <ScheduleEditor presentation="inline" finalVideo={video} demoMediaOptions={[video]} hookMediaOptions={[]} editingIsCombinedVideo={false} editingPlannedPlatforms={[]} editingSchedule={null} editingScheduledDate={null} editingScheduledTime={null} initialClipSelection="secondary_only" initialDemoMediaId={video.id} initialHookMediaId="" initialCaption={draft.caption} initialPlannedTargets={[{ platform: "instagram", connectionId: account.id }]} initialScheduledDate={draft.date} initialScheduledTime={draft.time} initialTimezone={draft.timezone} minimumScheduleLeadMinutes={5} requireScheduleTarget saving={false} errorMessage={null} socialConnections={[account]} tiktokBetaEnabled={false} youtubeBetaEnabled={false} onClose={() => setReview(false)} onCloseDraft={retain} onRefreshMedia={async () => true} onRefreshConnections={async () => true} onSave={() => setMessage("Preview confirmation captured. Nothing was scheduled.")} />
          : <WorkflowSchedulingPanel draft={draft} onChange={setDraft} timezone={draft.timezone} presentation="review" accountsControl={<p className="text-sm text-muted">Local fixture account: @local_preview</p>} footer={<div aria-label="Schedule actions" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Button variant="outline" disabled>Back to Edit</Button><Button onClick={() => setReview(true)}>Review schedule</Button></div>} />}
        {message ? <p role="status" className="mt-4 text-sm text-muted">{message}</p> : null}
      </div>
    </div>
  </section>;
}
