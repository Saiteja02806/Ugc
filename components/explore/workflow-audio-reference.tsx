"use client";

import { AudioLines, Check } from "lucide-react";
import { useState } from "react";

import { RemoveMediaButton, WorkflowFilePicker, WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import creation from "@/components/explore/workflow-creation.module.css";
import studio from "@/components/explore/workflow-studio.module.css";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type WorkflowAudioReferenceProps = {
  audioLabel: "Hook audio" | "Creator audio";
  audio: WorkflowAttachment;
  audioMode: "voice" | "recording";
  onAudioModeChange: (mode: "voice" | "recording") => void;
};

/** Local recordings only: no stock audio is inserted or instructions rewritten. */
export function WorkflowAudioReference({ audioLabel, audio, audioMode, onAudioModeChange }: WorkflowAudioReferenceProps) {
  const [open, setOpen] = useState(false);
  const audioName = audioLabel.toLowerCase();
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className={creation.referenceButton} aria-busy={audio.loading} data-state={audio.loading ? "loading" : audio.error ? "error" : audio.asset ? "selected" : "empty"} aria-label={`Select audio, ${audioName}${audio.asset ? ` selected: ${audio.asset.name}` : " optional"}`} title={audio.asset?.name ?? "Choose an optional audio reference"} />}>
      <AudioLines className="relative size-5" aria-hidden="true" />
      <span className={creation.referenceLabel}>Select audio</span>
      {audio.asset ? <Check className={creation.referenceCheck} aria-label="Audio attached" /> : null}
    </PopoverTrigger>
    <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
      <PopoverTitle>{audioLabel}</PopoverTitle>
      <p className="text-sm leading-6 text-muted">Choose your recording and how you want to use it.</p>
      <WorkflowFilePicker attachment={audio} kind="audio" label={audio.asset ? `Replace ${audioName}` : `Attach ${audioName}`} buttonLabel={audio.asset ? "Replace audio" : "Choose audio"} className="h-9 text-sm" />
      {audio.asset ? <>
        <div className="flex min-w-0 items-center gap-1"><WorkflowMediaPlayer asset={audio.asset} kind="audio" label={`${audioLabel} preview`} /><RemoveMediaButton label={audioName} onClick={audio.remove} /></div>
        <p className="break-all text-xs text-muted">{audio.asset.name}</p>
        <div role="group" aria-label={`How to use ${audioName}`} className="flex flex-wrap gap-2">
          <Button type="button" variant={audioMode === "voice" ? "default" : "outline"} aria-pressed={audioMode === "voice"} onClick={() => onAudioModeChange("voice")} className="h-9 rounded-lg text-sm">Voice reference</Button>
          <Button type="button" variant={audioMode === "recording" ? "default" : "outline"} aria-pressed={audioMode === "recording"} onClick={() => onAudioModeChange("recording")} className="h-9 rounded-lg text-sm">Exact recording</Button>
        </div>
        <p className="text-xs leading-5 text-muted">{audioMode === "voice" ? "Use as voice reference. Your instructions stay unchanged." : "Use exact recording for the spoken words. Your instructions stay unchanged."}</p>
      </> : <p className="text-xs text-muted">No audio selected. No sample audio is added.</p>}
      {audio.error ? <p role="alert" className="text-sm text-destructive">{audio.error}</p> : null}
    </PopoverContent>
  </Popover>;
}
