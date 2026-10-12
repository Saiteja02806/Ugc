"use client";

import { useId, useState, type ReactNode } from "react";
import { AiStudioSettingSelect } from "@/components/generation/ai-studio-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getAIStudioVideoDurations, getAIStudioVideoModelLabel, type AIStudioVideoDuration, type AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import { customWorkflowDuration, workflowDurationPresets } from "@/lib/explore/workflow-duration";

export function WorkflowDurationControl({
  model, value, onChange, ariaLabel, disabled = false,
  creditsPerSecond, fieldLabel, fieldLayout, size, icon,
}: {
  model: AIStudioVideoModel;
  value: AIStudioVideoDuration;
  onChange: (seconds: AIStudioVideoDuration) => void;
  ariaLabel: string;
  disabled?: boolean;
  creditsPerSecond?: number;
  fieldLabel?: string;
  fieldLayout?: "classic";
  size?: "default" | "sm";
  icon?: ReactNode;
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
  const customTriggerLabel = isPreset ? "Custom" : creditsPerSecond === undefined ? `${value} sec · Custom` : `${value} sec`;
  const hint = custom === null
    ? "Enter a supported duration before applying."
    : creditsPerSecond === undefined
      ? `The video will be ${custom} seconds.`
      : `${custom} seconds · ${custom * creditsPerSecond} credits per video.`;

  function applyDuration() {
    if (disabled || custom === null) return;
    onChange(custom);
    setOpen(false);
  }

  return <>
    <AiStudioSettingSelect
      ariaLabel={isPreset ? ariaLabel : `${ariaLabel}, ${value} seconds`}
      value={isPreset ? String(value) : "custom"}
      disabled={disabled}
      fieldLabel={fieldLabel}
      fieldLayout={fieldLayout}
      size={size}
      icon={icon}
      options={[
        ...presets.map(seconds => ({
          value: String(seconds),
          label: creditsPerSecond === undefined ? `${seconds} seconds` : `${seconds} sec · ${seconds * creditsPerSecond} credits`,
          triggerLabel: creditsPerSecond === undefined ? undefined : `${seconds} sec`,
        })),
        { value: "custom", label: "Custom", triggerLabel: customTriggerLabel },
      ]}
      onChange={next => {
        if (disabled) return;
        if (next === "custom") { setInput(String(value)); setOpen(true); }
        else { const seconds = customWorkflowDuration(model, next); if (seconds !== null) onChange(seconds); }
      }} />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom duration</DialogTitle>
          <DialogDescription>{getAIStudioVideoModelLabel(model)}: {limits}</DialogDescription>
        </DialogHeader>
        <label htmlFor={id} className="text-sm font-medium">Duration in seconds</label>
        <Input id={id} type="number" inputMode="numeric" min={supported[0]} max={supported.at(-1)} step={1} value={input}
          disabled={disabled}
          aria-invalid={custom === null} aria-describedby={`${id}-hint`} onChange={event => setInput(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyDuration(); } }} />
        <p id={`${id}-hint`} aria-live="polite" className="text-xs text-muted">{hint}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={disabled || custom === null} onClick={applyDuration}>Apply duration</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
