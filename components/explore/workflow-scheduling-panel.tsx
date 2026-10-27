"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { ScheduleQuickActions } from "@/components/scheduling/schedule-quick-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostCaptionField } from "@/components/scheduling/post-caption-field";
import { WorkflowTimePicker } from "@/components/scheduling/workflow-time-picker";
import creation from "@/components/explore/workflow-creation.module.css";
import reviewStyles from "@/components/explore/workflow-schedule-review.module.css";
import { isSocialPlatformVisible } from "@/lib/social/platform-visibility";
import { toggleWorkflowPlatform, workflowSelectedPlatforms, type WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";

export type { WorkflowScheduleDraft } from "@/lib/explore/workflow-scheduling-draft";
export const EMPTY_SCHEDULE_DRAFT: WorkflowScheduleDraft = { platform: "", caption: "", date: "", time: "", connectionId: "" };
export const SCHEDULE_PLATFORMS = ([
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
] as const).filter(({ value }) => isSocialPlatformVisible(value));

/** Controlled draft form; connected workflows opt into the account's saved captions. */
export function WorkflowSchedulingPanel({ draft, onChange, accountsControl, imageOnly = false, timezone, presentation, footer, ownerId = null, captionEnabled = false, captionScope = "workflow" }: {
  draft: WorkflowScheduleDraft;
  onChange: (draft: WorkflowScheduleDraft) => void;
  accountsControl?: ReactNode;
  imageOnly?: boolean;
  timezone?: string;
  presentation?: "review";
  footer?: ReactNode;
  ownerId?: string | null;
  captionEnabled?: boolean;
  captionScope?: string;
}) {
  const id = useId();
  const selected = workflowSelectedPlatforms(draft);
  const platforms = imageOnly ? SCHEDULE_PLATFORMS.filter(platform => platform.value !== "youtube") : SCHEDULE_PLATFORMS;
  return <section aria-label="Post scheduling settings" className={presentation === "review" ? `${creation.scheduling} ${reviewStyles.form}` : creation.scheduling}>
    <h2 className="text-lg font-semibold tracking-tight">Schedule your {imageOnly ? "slideshow" : "video"}</h2>
    <p className={creation.sectionHelp}>Choose where and when to share your {imageOnly ? "slideshow" : "finished video"}.</p>
    <div className={`${creation.scheduleField} ${presentation === "review" ? reviewStyles.contentField : ""}`}>
      <span className="text-sm font-medium">{presentation === "review" ? "Publish to" : "Platforms"}</span>
      <div role="group" aria-label="Posting platforms" className={creation.platformGrid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 80px), 1fr))", maxWidth: platforms.length === 1 ? 128 : undefined }}>
        {platforms.map(({ value, label }) => <Button key={value} type="button" variant="ghost" aria-label={label} aria-pressed={selected.includes(value)} title={label} data-platform={value} className={creation.platformButton} onClick={() => onChange(toggleWorkflowPlatform(draft, value))}>
          <SocialPlatformIcon platform={value} className="size-6" />
          <span aria-hidden="true" translate="no">{label}</span>
          {selected.includes(value) && <Check className={creation.referenceCheck} aria-hidden="true" />}
        </Button>)}
      </div>
      <p className="text-xs text-muted">Select where you want to post.</p>
    </div>
    {accountsControl}
    <div className={`${creation.scheduleField} ${presentation === "review" ? reviewStyles.contentField : ""}`}>
      <PostCaptionField key={`${ownerId}:${captionScope}`} ownerId={ownerId} enabled={captionEnabled} name="postCaption" value={draft.caption} initialized={draft.captionInitialized} onChange={caption => onChange({ ...draft, caption, captionInitialized: true })} />
    </div>
    <ScheduleQuickActions timezone={timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} onSelect={(parts, preset) => onChange({ ...draft, ...parts, publishMode: "scheduled", fiveMinutesFromSubmit: preset === 5 || undefined })} />
    <div className={creation.scheduleDateTime} data-schedule-date-time>
      <div className={creation.scheduleField}>
        <label htmlFor={`${id}-date`} className="text-sm font-medium">Date</label>
        <Input id={`${id}-date`} name="postDate" type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value, publishMode: event.target.value || draft.time ? "scheduled" : "now", fiveMinutesFromSubmit: undefined })} aria-describedby={`${id}-timezone`} />
      </div>
      <div className={creation.scheduleField}>
        <div className="flex items-center justify-between gap-2"><label htmlFor={`${id}-time`} className="text-sm font-medium">Time</label></div>
        <WorkflowTimePicker id={`${id}-time`} value={draft.time} onChange={time => onChange({ ...draft, time, publishMode: "scheduled", fiveMinutesFromSubmit: undefined })} describedBy={`${id}-timezone`} />
      </div>
    </div>
    <p id={`${id}-timezone`} className="text-xs text-muted">Time zone: {timezone ?? "your device’s time zone"}</p>
    {selected.includes("tiktok") ? <p className="text-xs leading-5 text-muted">By scheduling, you agree to TikTok’s Music Usage Confirmation.</p> : null}
    {footer}
  </section>;
}
