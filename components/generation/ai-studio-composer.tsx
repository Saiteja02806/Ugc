"use client";

import {
  Check,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function AiStudioComposer({
  active,
  accessMessage,
  ariaLabel,
  contextBanner,
  generateDisabled,
  generateLabel,
  generationLocked,
  isGenerating,
  layout = "standard",
  leadingControl,
  maxLength,
  name,
  onPromptChange,
  onSubmit,
  onTextareaKeyDown,
  placeholder,
  prompt,
  secondaryActions,
  settings,
}: {
  active: boolean;
  accessMessage?: string | null;
  ariaLabel: string;
  contextBanner?: ReactNode;
  generateDisabled: boolean;
  generateLabel: string;
  generationLocked: boolean;
  isGenerating: boolean;
  layout?: "standard" | "unified";
  leadingControl?: ReactNode;
  maxLength: number;
  name: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  prompt: string;
  secondaryActions?: ReactNode;
  settings: ReactNode;
}) {
  const promptId = useId();
  const promptHelperId = useId();
  const controlsId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const promptTooLong = prompt.length > maxLength;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || !active) {
      return;
    }

    textarea.style.height = "auto";
    const minimumHeight = layout === "unified" ? 40 : 64;
    const maximumHeight = layout === "unified" ? 144 : 128;
    textarea.style.height = `${Math.min(
      Math.max(textarea.scrollHeight, minimumHeight),
      maximumHeight,
    )}px`;
  }, [active, layout, prompt]);

  return (
    <div className="sticky bottom-0 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <form
        data-layout={layout}
        noValidate
        onSubmit={onSubmit}
        className={cn(
          "mx-auto w-full border bg-card transition-all duration-200",
          layout === "unified"
            ? "max-w-[944px] rounded-[24px] border-border/80 p-0 shadow-[0_8px_30px_rgb(0_0_0_/_0.06),0_2px_8px_rgb(0_0_0_/_0.03)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15"
            : "max-w-[1024px] rounded-[20px] border-border p-2.5 shadow-[0_8px_30px_rgb(0_0_0_/_0.06),0_2px_8px_rgb(0_0_0_/_0.03)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 sm:p-3",
        )}
      >
        <FieldGroup className={layout === "unified" ? "gap-0" : "gap-2"}>
          {contextBanner ? (
            <div className={layout === "unified" ? "px-4 pt-3 sm:px-5" : "px-1 pt-1"}>
              {contextBanner}
            </div>
          ) : null}
          <Field
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3",
              layout === "unified"
                ? "gap-y-1 px-4 pb-1 pt-3 sm:px-5"
                : "gap-y-2 px-1 pt-1",
              contextBanner && layout === "unified" && "!pt-1.5",
            )}
          >
            {leadingControl}
            <FieldLabel htmlFor={promptId} className="sr-only">
              {ariaLabel}
            </FieldLabel>
            <textarea
              id={promptId}
              ref={textareaRef}
              rows={1}
              aria-describedby={promptHelperId}
              aria-invalid={promptTooLong}
              autoComplete="off"
              name={name}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={onTextareaKeyDown}
              className={cn(
                "w-full resize-none overflow-y-auto bg-transparent text-foreground outline-none placeholder:text-muted-subtle",
                layout === "unified"
                  ? "max-h-36 min-h-10 rounded-none px-0 py-0 text-base font-normal leading-7"
                  : "max-h-32 min-h-16 rounded-lg px-2 py-1.5 text-sm font-medium leading-6 focus-visible:ring-2 focus-visible:ring-focus sm:text-[15px]",
                leadingControl ? "col-start-2 row-start-1" : "col-span-full",
              )}
              placeholder={placeholder}
            />
            <FieldDescription
              id={promptHelperId}
              className={cn(
                "col-span-full flex min-w-0 items-start justify-between gap-3 text-xs",
                layout === "unified" ? "px-0" : "px-2",
                leadingControl && "col-start-2",
                promptTooLong && "text-destructive",
              )}
              role={promptTooLong ? "alert" : undefined}
            >
              <span className="min-w-0">
                {promptTooLong
                  ? `Prompt is ${(
                      prompt.length - maxLength
                    ).toLocaleString("en-US")} character${
                      prompt.length - maxLength === 1 ? "" : "s"
                    } too long. Shorten it before generating.`
                  : accessMessage ??
                    "Press Enter to generate. Use Shift+Enter for a new line."}
              </span>
              <span className="shrink-0 tabular-nums font-mono">
                {prompt.length.toLocaleString("en-US")}/
                {maxLength.toLocaleString("en-US")}
              </span>
            </FieldDescription>
          </Field>

          <div
            className={cn(
              "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
              layout === "unified" && "px-3 pb-2 sm:px-4 sm:pb-3",
            )}
          >
            <div className="min-w-0 flex-1">
              {layout === "standard" ? (
                <Button
                  type="button"
                  variant="muted"
                  size="lg"
                  aria-controls={controlsId}
                  aria-expanded={controlsOpen}
                  onClick={() => setControlsOpen((current) => !current)}
                  className="w-full justify-between sm:hidden"
                >
                  <SlidersHorizontal
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  <span className="mr-auto">Controls</span>
                  <ChevronDown
                    data-icon="inline-end"
                    className={cn(
                      "transition-transform motion-reduce:transition-none",
                      controlsOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              ) : null}
              <div
                id={controlsId}
                className={cn(
                  "flex-wrap items-center gap-2",
                  layout === "unified"
                    ? "flex"
                    : cn(
                        "mt-2 sm:mt-0 sm:flex",
                        controlsOpen ? "flex" : "hidden",
                      ),
                )}
              >
                {settings}
              </div>
            </div>

            <div
              className={cn(
                "flex min-w-0 flex-col gap-1.5 sm:items-end",
                layout === "unified" && "w-full sm:w-auto",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                {secondaryActions}
                <Button
                  type="submit"
                  size="lg"
                  disabled={generateDisabled || promptTooLong}
                  title={generationLocked ? accessMessage ?? undefined : undefined}
                  className={cn(
                    "min-w-0 flex-1 h-10 rounded-full px-5 text-sm font-semibold tracking-[-0.01em] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-150 active:scale-[0.98] sm:min-w-[168px]",
                    isGenerating && "ring-2 ring-primary/35 shadow-xs shadow-primary/20",
                    layout === "unified" && "w-full",
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      Generating…
                    </>
                  ) : (
                    <>
                      {generateLabel}
                      <Sparkles data-icon="inline-end" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

export function AiStudioSetting({
  icon,
  label,
}: {
  icon?: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card-muted/80 px-3 text-xs font-medium text-foreground ring-1 ring-inset ring-border/70">
      {icon}
      {label}
    </span>
  );
}

export function AiStudioSettingSelect<TValue extends string>({
  ariaLabel,
  icon,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  icon?: ReactNode;
  onChange: (value: TValue) => void;
  options: readonly { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <label className="relative inline-flex h-8 min-w-0 items-center rounded-full bg-card-muted/80 text-xs font-medium text-foreground ring-1 ring-inset ring-border/70 transition-colors focus-within:ring-2 focus-within:ring-focus hover:bg-card">
      <span className="pointer-events-none absolute left-3 z-10 inline-flex items-center">
        {icon}
      </span>
      <span className="sr-only">{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className={cn(
          "h-full min-w-0 cursor-pointer appearance-none rounded-[inherit] bg-transparent py-0 pr-8 text-xs font-medium text-foreground outline-none",
          icon ? "pl-9" : "pl-3",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 size-3 text-muted"
      />
    </label>
  );
}

export type AIStudioAspectRatio = "4:5" | "1:1" | "9:16" | "16:9";

export const AI_STUDIO_RATIO_OPTIONS: {
  id: AIStudioAspectRatio;
  label: string;
  sublabel: string;
  iconClassName: string;
}[] = [
  {
    id: "4:5",
    label: "4:5 portrait",
    sublabel: "Instagram Feed (Default)",
    iconClassName: "h-4 w-3.5",
  },
  {
    id: "1:1",
    label: "1:1 square",
    sublabel: "Square Post / Carousel",
    iconClassName: "size-3.5",
  },
  {
    id: "9:16",
    label: "9:16 vertical",
    sublabel: "Reel / Story / TikTok",
    iconClassName: "h-5 w-3",
  },
  {
    id: "16:9",
    label: "16:9 landscape",
    sublabel: "Horizontal Video",
    iconClassName: "h-3 w-5",
  },
];

export function AiStudioRatioPicker({
  allowedRatios,
  disabled = false,
  onChange,
  value,
}: {
  allowedRatios?: AIStudioAspectRatio[];
  disabled?: boolean;
  onChange: (ratio: AIStudioAspectRatio) => void;
  value: AIStudioAspectRatio;
}) {
  const [open, setOpen] = useState(false);
  const options = allowedRatios
    ? AI_STUDIO_RATIO_OPTIONS.filter((option) => allowedRatios.includes(option.id))
    : AI_STUDIO_RATIO_OPTIONS;
  const currentOption =
    options.find((option) => option.id === value) ?? options[0]!;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={`Aspect ratio, currently ${currentOption.label}`}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-card-muted/80 px-3 text-xs font-medium text-foreground ring-1 ring-inset ring-border/70 transition-all hover:bg-card hover:ring-border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          />
        }
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block shrink-0 rounded-[3px] border-2 border-muted-foreground",
            currentOption.iconClassName,
          )}
        />
        <span>{currentOption.label}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-56 p-1.5"
      >
        <div className="flex flex-col gap-0.5">
          {options.map((option) => {
            const isSelected = option.id === value;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                  isSelected
                    ? "bg-brand-soft font-semibold text-primary"
                    : "text-foreground hover:bg-card-muted",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-5 shrink-0 items-center justify-center text-muted">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-block rounded-[3px] border-2",
                        isSelected ? "border-primary" : "border-muted-foreground",
                        option.iconClassName,
                      )}
                    />
                  </div>
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-[10px] text-muted">{option.sublabel}</div>
                  </div>
                </div>
                {isSelected ? (
                  <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
