"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Video } from "lucide-react";

import { getVideoModelCreditsPerSecond } from "@/lib/billing/generation-credit-policy";
import { PRICING_VIDEO_MODELS, type PricingVideoModel } from "@/lib/pricing/plans";


export function PricingModelSelect({ planName, value, onChange }: {
  planName: string;
  value: PricingVideoModel;
  onChange: (model: PricingVideoModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const current = PRICING_VIDEO_MODELS.find(model => model.id === value)!;
  function moveOption(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const index = options.indexOf(event.currentTarget);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 :
      (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId}
        aria-label={`Video model for ${planName} allowance`}
        onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") {event.preventDefault(); setOpen(true);} }}
        className="mt-3 flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/70 px-3 text-left text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus data-popup-open:border-primary/60" /> }>
        <Video className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{current.label}</span>
        <span className="shrink-0 text-[10px] font-normal tabular-nums text-muted">{getVideoModelCreditsPerSecond(value)} credits/s</span>
        <ChevronDown className="size-3.5 text-muted" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent id={menuId} align="start" sideOffset={6} role="listbox" aria-label={`Video models for ${planName}`}
        className="w-[var(--anchor-width)] min-w-52 max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-xl border border-border bg-card p-1.5 text-foreground shadow-floating">
        {PRICING_VIDEO_MODELS.map(model => (
          <button key={model.id} type="button" role="option" aria-selected={model.id === value} onKeyDown={moveOption}
            onClick={() => {onChange(model.id); setOpen(false);}}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs outline-none hover:bg-card-muted focus-visible:ring-2 focus-visible:ring-focus ${model.id === value ? "bg-primary/10" : ""}`}>
            <span className="min-w-0 flex-1 font-medium">{model.label}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted">{getVideoModelCreditsPerSecond(model.id)} credits/s</span>
            <span className="flex size-4 shrink-0 items-center justify-center text-primary">{model.id === value ? <Check className="size-3.5" aria-hidden="true" /> : null}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
