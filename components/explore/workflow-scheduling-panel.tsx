"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/** Pure draft form. Authenticated account display is supplied only by a connected workflow. */
export function WorkflowSchedulingPanel({ draft, onChange, accountsControl, imageOnly = false, timezone, presentation, footer }: {
  draft: WorkflowScheduleDraft;
  onChange: (draft: WorkflowScheduleDraft) => void;
  accountsControl?: ReactNode;
  imageOnly?: boolean;
  timezone?: string;
  presentation?: "review";
  footer?: ReactNode;
}) {
  const id = useId();
  const selected = workflowSelectedPlatforms(draft);
  const platforms = imageOnly ? SCHEDULE_PLATFORMS.filter(platform => platform.value !== "youtube") : SCHEDULE_PLATFORMS;
  return <section aria-label="Post scheduling settings" className={presentation === "review" ? `${creation.scheduling} ${reviewStyles.form}` : creation.scheduling}>
    <h2 className="text-lg font-semibold tracking-tight">Schedule your {imageOnly ? "slideshow" : "video"}</h2>
    <p className={creation.sectionHelp}>Choose where and when to share your {imageOnly ? "slideshow" : "finished video"}.</p>
    <div className={`${creation.scheduleField} ${presentation === "review" ? reviewStyles.contentField : ""}`}>
      <span className="text-sm font-medium">{presentation === "review" ? "Publish to" : "Platforms"}</span>
      <div role="group" aria-label="Posting platforms" className={creation.platformGrid} style={{ gridTemplateColumns: `repeat(${platforms.length}, minmax(0, 1fr))`, maxWidth: platforms.length === 1 ? 128 : undefined }}>
        {platforms.map(({ value, label }) => <Button key={value} type="button" variant="ghost" aria-label={label} aria-pressed={selected.includes(value)} title={label} data-platform={value} className={creation.platformButton} onClick={() => onChange(toggleWorkflowPlatform(draft, value))}>
          <SocialPlatformIcon platform={value} className="size-6" />
          <span aria-hidden="true">{label}</span>
          {selected.includes(value) && <Check className={creation.referenceCheck} aria-hidden="true" />}
        </Button>)}
      </div>
      <p className="text-xs text-muted">Select where you want to post.</p>
    </div>
    {accountsControl}
    <div className={`${creation.scheduleField} ${presentation === "review" ? reviewStyles.contentField : ""}`}>
      <label htmlFor={`${id}-caption`} className="text-sm font-medium">Post caption</label>
      <textarea id={`${id}-caption`} name="postCaption" autoComplete="off" rows={4} className={creation.prompt} value={draft.caption} onChange={(event) => onChange({ ...draft, caption: event.target.value })} placeholder="Write your post caption…" aria-describedby={`${id}-caption-help`} />
      <p id={`${id}-caption-help`} className="text-xs leading-5 text-muted">The caption shown below your social post.</p>
    </div>
    <div className={creation.scheduleDateTime} data-schedule-date-time>
      <div className={creation.scheduleField}>
        <label htmlFor={`${id}-date`} className="text-sm font-medium">Date</label>
        <Input id={`${id}-date`} name="postDate" type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} aria-describedby={`${id}-timezone`} />
      </div>
      <div className={creation.scheduleField}>
        <label htmlFor={`${id}-time`} className="text-sm font-medium">Time</label>
        <Input id={`${id}-time`} name="postTime" type="time" value={draft.time} onChange={(event) => onChange({ ...draft, time: event.target.value })} aria-describedby={`${id}-timezone`} />
      </div>
    </div>
    <p id={`${id}-timezone`} className="text-xs text-muted">Time zone: {timezone ?? "your device’s time zone"}</p>
    {footer}
  </section>;
}
