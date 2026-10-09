"use client";

import { useId, useState } from "react";
import { AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getAIStudioVideoDurations, getAIStudioVideoModelLabel, type AIStudioVideoDuration, type AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import { customWorkflowDuration, workflowDurationPresets } from "@/lib/explore/workflow-duration";

export function WorkflowDurationControl({ model, value, onChange, ariaLabel }: {
  model: AIStudioVideoModel; value: AIStudioVideoDuration;
  onChange: (seconds: AIStudioVideoDuration) => void; ariaLabel: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(String(value));
  const supported = getAIStudioVideoDurations(model);
  const presets = workflowDurationPresets(model);
  const isPreset = presets.some(seconds => seconds === value);
  const custom = customWorkflowDuration(model, input);
  const continuous = supported.every((seconds, index) => index === 0 || seconds === supported[index - 1] + 1);
  const limits = continuous ? `${supported[0]}–${supported.at(-1)} seconds, whole numbers only.` : `Supported seconds: ${supported.join(", ")}.`;
  return <>
    <AiStudioSettingSelect ariaLabel={isPreset ? ariaLabel : `${ariaLabel}, ${value} seconds`} value={isPreset ? String(value) : "custom"}
      options={[...presets.map(seconds => ({ value: String(seconds), label: `${seconds} seconds` })), { value: "custom", label: "Custom", triggerLabel: isPreset ? "Custom" : `${value} sec · Custom` }]}
      onChange={next => {
        if (next === "custom") { setInput(String(value)); setOpen(true); }
        else { const seconds = customWorkflowDuration(model, next); if (seconds !== null) onChange(seconds); }
      }} />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Custom duration</DialogTitle><DialogDescription>{getAIStudioVideoModelLabel(model)}: {limits}</DialogDescription></DialogHeader>
        <label htmlFor={id} className="text-sm font-medium">Duration in seconds</label>
        <Input id={id} type="number" inputMode="numeric" min={supported[0]} max={supported.at(-1)} step={1} value={input}
          aria-invalid={custom === null} aria-describedby={`${id}-hint`} onChange={event => setInput(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (custom !== null) { onChange(custom); setOpen(false); } } }} />
        <p id={`${id}-hint`} className="text-xs text-muted">{custom === null ? "Enter a supported duration before applying." : `The video will be ${custom} seconds.`}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" disabled={custom === null} onClick={() => { if (custom !== null) { onChange(custom); setOpen(false); } }}>Apply duration</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
