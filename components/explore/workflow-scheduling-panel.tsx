"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import creation from "@/components/explore/workflow-creation.module.css";
import { isSocialPlatformVisible } from "@/lib/social/platform-visibility";

export type WorkflowScheduleDraft = { platform: string; caption: string; date: string; time: string; connectionId?: string };
export const EMPTY_SCHEDULE_DRAFT: WorkflowScheduleDraft = { platform: "", caption: "", date: "", time: "", connectionId: "" };
export const SCHEDULE_PLATFORMS = ([
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
] as const).filter(({ value }) => isSocialPlatformVisible(value));

/** Pure draft form. Authenticated account display is supplied only by a connected workflow. */
export function WorkflowSchedulingPanel({ draft, onChange, accountsControl }: {
  draft: WorkflowScheduleDraft;
  onChange: (draft: WorkflowScheduleDraft) => void;
  accountsControl?: ReactNode;
}) {
  const id = useId();
  return <section aria-label="Post scheduling settings" className={creation.scheduling}>
    <h2 className="sr-only">Schedule</h2>
    <p className={creation.sectionHelp}>Choose where and when to share your finished video.</p>
    <div className={creation.scheduleField}>
      <span className="text-sm font-medium">Platform</span>
      <div role="group" aria-label="Posting platform" className={creation.platformGrid} style={{ gridTemplateColumns: `repeat(${SCHEDULE_PLATFORMS.length}, minmax(0, 1fr))` }}>
        {SCHEDULE_PLATFORMS.map(({ value, label }) => <Button key={value} type="button" variant="ghost" aria-label={label} aria-pressed={draft.platform === value} title={label} data-platform={value} className={creation.platformButton} onClick={() => onChange({ ...draft, platform: value, connectionId: draft.platform === value ? draft.connectionId : "" })}>
          <SocialPlatformIcon platform={value} className="size-6" />
          <span aria-hidden="true">{label}</span>
          {draft.platform === value && <Check className={creation.referenceCheck} aria-hidden="true" />}
        </Button>)}
      </div>
    </div>
    {accountsControl}
    <div className={creation.scheduleField}>
      <label htmlFor={`${id}-caption`} className="text-sm font-medium">Post caption</label>
      <textarea id={`${id}-caption`} name="postCaption" autoComplete="off" rows={4} className={creation.prompt} value={draft.caption} onChange={(event) => onChange({ ...draft, caption: event.target.value })} placeholder="Write your post caption…" aria-describedby={`${id}-caption-help`} />
      <p id={`${id}-caption-help`} className="text-xs leading-5 text-muted">The text below your social post—not the video’s subtitles.</p>
    </div>
    <div className={creation.scheduleDateTime}>
      <div className={creation.scheduleField}>
        <label htmlFor={`${id}-date`} className="text-sm font-medium">Date</label>
        <Input id={`${id}-date`} name="postDate" type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} aria-describedby={`${id}-timezone`} />
      </div>
      <div className={creation.scheduleField}>
        <label htmlFor={`${id}-time`} className="text-sm font-medium">Time</label>
        <Input id={`${id}-time`} name="postTime" type="time" value={draft.time} onChange={(event) => onChange({ ...draft, time: event.target.value })} aria-describedby={`${id}-timezone`} />
      </div>
    </div>
    <p id={`${id}-timezone`} className="sr-only">Date and time use your device’s time zone.</p>
  </section>;
}
