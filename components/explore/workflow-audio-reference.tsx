"use client";

import { AudioLines, Plus } from "lucide-react";
import { useState } from "react";

import { RemoveMediaButton, WorkflowFilePicker, WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import creation from "@/components/explore/workflow-creation.module.css";
import studio from "@/components/explore/workflow-studio.module.css";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WorkflowSavedAudioChoices } from "@/components/explore/workflow-saved-audio-choices";
import { WorkflowReferencePreview } from "@/components/explore/workflow-reference-preview";
import reference from "@/components/explore/workflow-reference-preview.module.css";

export type WorkflowAudioReferenceProps = {
  ownerId?: string | null;
  audioLabel: "Hook audio" | "Creator audio";
  audio: WorkflowAttachment;
  audioMode: "voice" | "recording";
  onAudioModeChange: (mode: "voice" | "recording") => void;
};

/** An AI reference only; no recording is inserted as generated-video music. */
export function WorkflowAudioReference({ audioLabel, audio, ownerId, tile = false }: WorkflowAudioReferenceProps & { tile?: boolean }) {
  const [open, setOpen] = useState(false);
  const audioName = audioLabel.toLowerCase();
  return <div className={reference.picker}>
    {audio.asset ? <WorkflowReferencePreview key={audio.asset.url} kind="voice" url={audio.asset.url} name={audio.asset.name} disabled={audio.loading} onRemove={audio.remove} /> : null}
    <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className={cn(creation.referenceButton, reference.action)} aria-busy={audio.loading} data-state={audio.loading ? "loading" : audio.error ? "error" : audio.asset ? "selected" : "empty"} aria-label={`Select audio, ${audioName}${audio.asset ? ` selected: ${audio.asset.name}` : " optional"}`} title={audio.asset?.name ?? "Choose an optional audio reference"} />}>
      {!audio.asset ? <>{tile ? <AudioLines aria-hidden="true" /> : null}<span className={creation.referenceLabel}>{tile ? "Select audio" : "Choose audio"}</span></> : null}<Plus className={reference.add} aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent side="right" align="start" className={cn(studio.floating, creation.floating)}>
      <PopoverTitle>Audio reference</PopoverTitle>
      <p className="text-xs text-muted">Guide vocal delivery with an audio clip. Requires Seedance 2.5 · Up to 30 seconds.</p>
      <WorkflowFilePicker attachment={{ ...audio, choose: file => audio.choose(file, { maxDuration: 30 }) }} kind="audio" label={audio.asset ? `Replace ${audioName}` : `Attach ${audioName}`} buttonLabel={audio.asset ? "Replace audio" : "Choose audio"} className="h-9 text-sm" />
      {open && ownerId ? <WorkflowSavedAudioChoices ownerId={ownerId} audio={audio} onVoiceReference={() => {}} /> : null}
      {audio.asset ? <>
        <div className="flex min-w-0 items-center gap-1"><WorkflowMediaPlayer asset={audio.asset} kind="audio" label={`${audioLabel} preview`} /><RemoveMediaButton label={audioName} onClick={audio.remove} /></div>
        <p className="break-all text-xs text-muted">{audio.asset.name}</p>
      </> : null}
      {audio.error ? <p role="alert" className="text-sm text-destructive">{audio.error}</p> : null}
      {audio.error && !audio.asset ? <Button type="button" variant="ghost" onClick={audio.remove}>Cancel audio selection</Button> : null}
    </PopoverContent>
  </Popover></div>;
}
