"use client";

import { AudioLines, Check } from "lucide-react";
import { useState } from "react";

import { RemoveMediaButton, WorkflowFilePicker, WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import creation from "@/components/explore/workflow-creation.module.css";
import studio from "@/components/explore/workflow-studio.module.css";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WorkflowSavedAudioChoices } from "@/components/explore/workflow-saved-audio-choices";

export type WorkflowAudioReferenceProps = {
  ownerId?: string | null;
  audioLabel: "Hook audio" | "Creator audio";
  audio: WorkflowAttachment;
  audioMode: "voice" | "recording";
  onAudioModeChange: (mode: "voice" | "recording") => void;
};

/** An AI reference only; no recording is inserted as generated-video music. */
export function WorkflowAudioReference({ audioLabel, audio, ownerId }: WorkflowAudioReferenceProps) {
  const [open, setOpen] = useState(false);
  const audioName = audioLabel.toLowerCase();
  const videoName = audioLabel === "Hook audio" ? "hook" : "creator video";
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className={creation.referenceButton} aria-busy={audio.loading} data-state={audio.loading ? "loading" : audio.error ? "error" : audio.asset ? "selected" : "empty"} aria-label={`Select audio, ${audioName}${audio.asset ? ` selected: ${audio.asset.name}` : " optional"}`} title={audio.asset?.name ?? "Choose an optional audio reference"} />}>
      <AudioLines className="relative size-5" aria-hidden="true" />
      <span className={creation.referenceLabel}>Select audio</span>
      {audio.asset ? <Check className={creation.referenceCheck} aria-label="Audio attached" /> : null}
    </PopoverTrigger>
    <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
      <PopoverTitle>Main voice reference</PopoverTitle>
      <p className="text-sm leading-6 text-muted">Optional audio reference up to 30 seconds for Seedance 2.5 through OpenRouter. It guides the generated {videoName} voice—not background music or demo audio. Files upload only when you Generate in the connected workflow.</p>
      <WorkflowFilePicker attachment={{ ...audio, choose: file => audio.choose(file, { maxDuration: 30 }) }} kind="audio" label={audio.asset ? `Replace ${audioName}` : `Attach ${audioName}`} buttonLabel={audio.asset ? "Replace audio" : "Choose audio"} className="h-9 text-sm" />
      {open && ownerId ? <WorkflowSavedAudioChoices ownerId={ownerId} audio={audio} onVoiceReference={() => {}} /> : null}
      {audio.asset ? <>
        <div className="flex min-w-0 items-center gap-1"><WorkflowMediaPlayer asset={audio.asset} kind="audio" label={`${audioLabel} preview`} /><RemoveMediaButton label={audioName} onClick={audio.remove} /></div>
        <p className="break-all text-xs text-muted">{audio.asset.name}</p>
        <p className="text-xs leading-5 text-muted">Your instructions stay unchanged. The model uses this as a reference; an exact copy of the voice or recording is not guaranteed.</p>
      </> : <p className="text-xs text-muted">No audio selected. No sample audio is added.</p>}
      {audio.error ? <p role="alert" className="text-sm text-destructive">{audio.error}</p> : null}
    </PopoverContent>
  </Popover>;
}
