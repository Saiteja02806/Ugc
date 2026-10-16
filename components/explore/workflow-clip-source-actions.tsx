"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, FolderOpen, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

type SourceOption = "upload" | "assets" | "generate";

/** Inline entry points use the same selection flow as the workflow controls. */
export function WorkflowClipSourceActions({ label, onUpload, onChooseAssets, onGenerate, selectedMode, disabled = false, presentation = "menu", triggerLabel }: {
  label: string;
  onUpload: (file: File) => Promise<unknown>;
  onChooseAssets: () => void;
  onGenerate?: () => void;
  selectedMode?: SourceOption;
  disabled?: boolean;
  presentation?: "menu" | "inline";
  triggerLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<SourceOption>("upload");
  const selected = selectedMode ?? chosen;
  const Icon = selected === "assets" ? FolderOpen : selected === "generate" ? Sparkles : Upload;
  const title = selected === "assets" ? "Creative Assets" : selected === "generate" ? "Generate video" : "Upload video";
  function choose(option: SourceOption) {
    if (disabled) return;
    setChosen(option); setOpen(false);
    if (option === "upload") input.current?.click();
    else if (option === "assets") onChooseAssets();
    else onGenerate?.();
  }
  return <div role="group" aria-label={`${triggerLabel ?? "Add"} ${label}`} className={presentation === "inline" ? "flex min-w-0 flex-wrap justify-center gap-2" : triggerLabel ? "inline-flex min-w-0" : "w-full"}>
    <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" hidden disabled={disabled} aria-label={`Upload ${label} file`} onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file && !disabled) void onUpload(file);
    }} />
    {presentation === "inline" ? <>
      <Button type="button" className="min-h-11" disabled={disabled} aria-label={`Upload ${label}`} onClick={() => choose("upload")}><Upload className="size-4" aria-hidden="true" />Upload video</Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={disabled} aria-label={`Choose ${label} from Creative Assets`} onClick={() => choose("assets")}><FolderOpen className="size-4" aria-hidden="true" />Creative Assets</Button>
      {onGenerate ? <Button type="button" variant="outline" className="min-h-11" disabled={disabled} aria-label={`Generate ${label}`} onClick={() => choose("generate")}><Sparkles className="size-4" aria-hidden="true" />Generate video</Button> : null}
    </> : <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger openOnHover={!triggerLabel} delay={150} closeDelay={150} render={<Button type="button" variant="outline" disabled={disabled} className={triggerLabel ? "min-h-10 gap-2" : "min-h-10 w-full gap-2"} aria-label={triggerLabel ? `${triggerLabel} ${label}` : `Choose ${label} source`} />}>
        {triggerLabel ? null : <Icon className="size-4 shrink-0" aria-hidden="true" />}<span>{triggerLabel ?? title}</span><ChevronDown className="ml-auto size-3.5 shrink-0 text-muted" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 max-w-[calc(100vw-32px)] gap-1 p-1.5">
        <PopoverTitle className="sr-only">Choose {label} source</PopoverTitle>
        {(["upload", "assets", ...(onGenerate ? ["generate"] : [])] as SourceOption[]).map(option => {
          const OptionIcon = option === "assets" ? FolderOpen : option === "generate" ? Sparkles : Upload;
          const optionLabel = option === "assets" ? "Creative Assets" : option === "generate" ? "Generate video" : "Upload video";
          return <Button key={option} type="button" variant="ghost" disabled={disabled} aria-pressed={selected === option}
            aria-label={option === "upload" ? `Upload ${label}` : option === "assets" ? `Choose ${label} from Creative Assets` : `Generate ${label}`}
            className="min-h-10 w-full justify-start gap-2 px-2.5 text-sm" onClick={() => choose(option)}>
            <OptionIcon className="size-4 shrink-0" aria-hidden="true" /><span>{optionLabel}</span>{selected === option ? <Check className="ml-auto size-3.5 text-primary" aria-hidden="true" /> : null}
          </Button>;
        })}
      </PopoverContent>
    </Popover>}
  </div>;
}
