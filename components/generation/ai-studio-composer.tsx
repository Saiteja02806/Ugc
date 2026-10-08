"use client";

import {
  Check,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ComposerSettingsRail } from "@/components/generation/composer-settings-rail";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import creation from "@/components/explore/workflow-creation.module.css";

export function AiStudioComposer({
  active,
  compact = false,
  accessMessage,
  ariaLabel,
  contextBanner,
  generateDisabled,
  generateLabel,
  generationLocked,
  hasAttachments = true,
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
  showPromptHint = true,
  settings,
  unifiedMaxWidthClassName,
  portalTarget,
  promptHelper,
  promptLabel,
  settingsSummary,
  actionsTarget,
  referenceControls,
  workflowDesign,
  settingsClassName,
  settingsLabel = "Video generation settings",
}: {
  active: boolean;
  compact?: boolean;
  accessMessage?: string | null;
  ariaLabel: string;
  contextBanner?: ReactNode;
  generateDisabled: boolean;
  generateLabel: string;
  generationLocked: boolean;
  hasAttachments?: boolean;
  isGenerating: boolean;
  layout?: "standard" | "unified" | "workflow";
  leadingControl?: ReactNode;
  maxLength?: number;
  name: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  prompt: string;
  secondaryActions?: ReactNode;
  showPromptHint?: boolean;
  settings: ReactNode;
  unifiedMaxWidthClassName?: string;
  portalTarget?: HTMLElement | null;
  promptHelper?: string;
  promptLabel?: string;
  settingsSummary?: string;
  actionsTarget?: HTMLElement | null;
  referenceControls?: ReactNode;
  workflowDesign?: "classic";
  settingsClassName?: string;
  settingsLabel?: string;
}) {
  const promptId = useId();
  const formId = useId();
  const promptHelperId = useId();
  const controlsId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const promptTooLong = maxLength !== undefined && prompt.length > maxLength;
  const excessCharacters = maxLength !== undefined ? Math.max(0, prompt.length - maxLength) : 0;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || !active) {
      return;
    }

    textarea.style.height = "auto";
    const minimumHeight = compact ? 40 : layout === "unified" ? 40 : 64;
    const maximumHeight = compact ? 72 : layout === "unified" ? 64 : 128;
    textarea.style.height = `${Math.min(
      Math.max(textarea.scrollHeight, minimumHeight),
      maximumHeight,
    )}px`;
  }, [active, compact, hasAttachments, layout, prompt]);

  if (layout === "workflow" && workflowDesign === "classic") {
    const actions = <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><p role="status" className="text-xs leading-5 text-muted">{accessMessage}</p>{secondaryActions ? <div className="flex shrink-0 gap-2">{secondaryActions}</div> : null}</div>
      <Button type="submit" form={formId} aria-label={generateLabel} disabled={generateDisabled || promptTooLong} className={creation.primaryAction}>{isGenerating ? <><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Generating…</> : generateLabel}</Button>
    </div>;
    const content = <form id={formId} data-layout="workflow" data-workflow-design="classic" noValidate onSubmit={onSubmit} className={creation.composer}>
      {referenceControls}
      <div className={creation.instructionsField}>
        <label htmlFor={promptId} className="block text-sm font-medium">{promptLabel ?? "Your instructions"}</label>
        <textarea id={promptId} name={name} value={prompt} rows={4} autoComplete="off" onChange={event => onPromptChange(event.target.value)}
          aria-label={ariaLabel} aria-invalid={promptTooLong} aria-describedby={promptHelperId} placeholder={placeholder} className={creation.prompt} />
        <p id={promptHelperId} role={promptTooLong ? "alert" : undefined} className={promptTooLong ? "text-xs leading-5 text-destructive" : "sr-only"}>{promptTooLong ? `Shorten your instructions by ${excessCharacters} characters.` : promptHelper}</p>
      </div>
      <div role="group" aria-label={settingsLabel} className={cn(creation.settingsGrid, settingsClassName)}>{settings}</div>
      {!actionsTarget ? actions : null}
    </form>;
    return <>{portalTarget ? createPortal(content, portalTarget) : content}{actionsTarget ? createPortal(actions, actionsTarget) : null}</>;
  }

  if (layout === "workflow") {
    const actions = <div className={cn("space-y-2", !actionsTarget && "shrink-0 border-t border-border bg-card p-5")}>
      <Popover key={active ? "visible-controls" : "hidden-controls"}>
        <PopoverTrigger render={<Button type="button" variant="outline" size="sm" aria-label="Generation settings" title="Change generation settings" className="h-9 w-full min-w-0 justify-start gap-2 rounded-lg px-3 text-xs" />}>
          <SlidersHorizontal className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left tabular-nums" aria-label="Current generation settings">{settingsSummary ?? "Generation settings"}</span>
          <ChevronDown className="size-3 shrink-0 text-muted" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent side="top" align="start" sideOffset={8} className="max-h-[min(32rem,calc(100dvh-2rem))] w-[min(328px,calc(100vw-2rem))] gap-4 overflow-y-auto overscroll-contain rounded-xl p-4">
          <PopoverTitle className="text-sm">Generation settings</PopoverTitle>
          <div className="grid grid-cols-2 gap-3">{settings}</div>
        </PopoverContent>
      </Popover>
      {secondaryActions ? <div className="flex flex-wrap gap-2">{secondaryActions}</div> : null}
      <Button type="submit" form={formId} size="lg" aria-label={generateLabel} disabled={generateDisabled || promptTooLong} className="h-11 w-full rounded-lg">{isGenerating ? <><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Generating…</> : generateLabel}</Button>
      <p role="status" className="text-xs leading-5 text-muted">{accessMessage}</p>
    </div>;
    const content = <form id={formId} data-layout="workflow" noValidate onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {contextBanner}
      <div className="space-y-2">
        <label htmlFor={promptId} className="block text-sm font-medium">{promptLabel ?? "Your instructions"}</label>
        <textarea id={promptId} name={name} value={prompt} rows={4} autoComplete="off" onChange={event => onPromptChange(event.target.value)}
          aria-label={ariaLabel} aria-invalid={promptTooLong} aria-describedby={promptHelperId}
          placeholder={placeholder} className="h-[72px] min-h-[72px] w-full resize-y rounded-lg border border-border/60 bg-card-muted/40 px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-subtle focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-focus" />
        <p id={promptHelperId} role={promptTooLong ? "alert" : undefined} className="text-xs leading-5 text-muted">{promptTooLong ? `Shorten your instructions by ${excessCharacters} characters.` : promptHelper}</p>
      </div>
      {referenceControls}
      {leadingControl ? <details className="rounded-lg border border-border px-3 py-2"><summary className="cursor-pointer rounded py-1 text-xs font-medium text-muted focus-visible:outline-2 focus-visible:outline-focus">Optional reference image</summary><p className="my-2 text-xs leading-5 text-muted">Add an image to guide the appearance. The selected reference is used by default.</p>{leadingControl}</details> : null}
      </div>
      {!actionsTarget ? actions : null}
    </form>;
    return <>{portalTarget ? createPortal(content, portalTarget) : content}{actionsTarget ? createPortal(actions, actionsTarget) : null}</>;
  }

  return (
    <div className={cn("shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2", !compact && "sticky bottom-0")}>
      <form
        data-layout={layout}
        data-compact={compact || undefined}
        noValidate
        onSubmit={onSubmit}
        className={cn(
          "mx-auto w-full border bg-card transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
          layout === "unified"
            ? cn(
                unifiedMaxWidthClassName ?? "max-w-[944px]",
                "rounded-[20px] border-border/80 p-0 shadow-[0_8px_30px_rgb(0_0_0_/_0.06),0_2px_8px_rgb(0_0_0_/_0.03)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15",
              )
            : "max-w-[1024px] rounded-[20px] border-border p-2.5 shadow-[0_8px_30px_rgb(0_0_0_/_0.06),0_2px_8px_rgb(0_0_0_/_0.03)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 sm:p-3",
          compact && "rounded-[28px] shadow-none",
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
              "flex min-w-0 flex-col items-stretch",
              layout === "unified"
                ? "gap-y-1 px-4 pb-1.5 pt-3"
                : "gap-y-2 px-1 pt-1",
              contextBanner && layout === "unified" && "!pt-1.5",
              !compact && layout === "unified" && leadingControl && !hasAttachments && "grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-2",
            )}
          >
            {leadingControl && (!compact || hasAttachments) ? <div className={cn("min-w-0", !compact && layout === "unified" && !hasAttachments && "col-start-1 row-start-1")}>{leadingControl}</div> : null}
            <FieldLabel htmlFor={promptId} className="sr-only">
              {ariaLabel}
            </FieldLabel>
            <textarea
              id={promptId}
              ref={textareaRef}
              rows={1}
              aria-describedby={promptTooLong || showPromptHint ? promptHelperId : undefined}
              aria-invalid={promptTooLong}
              autoComplete="off"
              name={name}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={onTextareaKeyDown}
              className={cn(
                "w-full resize-none overflow-y-auto bg-transparent text-foreground outline-none placeholder:text-muted-subtle",
                layout === "unified"
                  ? compact ? "max-h-18 min-h-10 rounded-none px-0 py-0 text-[13px] font-normal leading-5" : "max-h-16 min-h-10 rounded-none px-0 py-0 text-base font-normal leading-6 sm:text-sm"
                  : "max-h-32 min-h-16 rounded-lg px-2 py-1.5 text-sm font-medium leading-6 focus-visible:ring-2 focus-visible:ring-focus sm:text-[15px]",
                "min-w-0",
                !compact && layout === "unified" && leadingControl && !hasAttachments && "col-start-2 row-start-1 self-center",
              )}
              placeholder={placeholder}
            />
            {promptTooLong || showPromptHint ? (
              <FieldDescription
                id={promptHelperId}
                className={cn(
                  "flex min-w-0 items-start justify-between gap-3 text-xs",
                  !compact && layout === "unified" && leadingControl && !hasAttachments && "col-span-full",
                  layout === "unified" ? "px-0" : "px-2",
                  compact && "pb-1 text-[11px] leading-4 text-muted-subtle",
                  promptTooLong && "text-destructive",
                )}
                role={promptTooLong ? "alert" : undefined}
              >
                <span className="min-w-0">
                  {promptTooLong
                    ? "This prompt is too long for the selected model. Shorten it before generating."
                    : accessMessage ??
                      "Press Enter to generate. Use Shift+Enter for a new line."}
                </span>
              </FieldDescription>
            ) : null}
          </Field>

          <div
            data-slot={compact ? "composer-actions" : undefined}
            className={cn(
              compact ? "flex flex-col items-stretch gap-1" : "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
              layout === "unified" && "px-3 pb-2 sm:px-4 sm:pb-3",
            )}
          >
            {compact ? <div className="flex min-w-0 items-center gap-1.5">
              {!hasAttachments ? leadingControl : null}
              <ComposerSettingsRail>{settings}</ComposerSettingsRail>
            </div> : <div className="min-w-0 flex-1">
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
                  "items-center gap-2",
                  layout === "unified"
                    ? "flex flex-nowrap overflow-x-auto overscroll-x-contain py-1 [&>*]:shrink-0"
                    : cn(
                        "mt-2 flex-wrap sm:mt-0 sm:flex",
                        controlsOpen ? "flex" : "hidden",
                      ),
                )}
              >
                {settings}
              </div>
            </div>}

            <div
              className={cn(
                "flex min-w-0 flex-col gap-1.5 sm:items-end",
                layout === "unified" && (compact ? "shrink-0 self-end" : "w-full sm:w-auto"),
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                {secondaryActions}
                <Button
                  type="submit"
                  aria-label={generateLabel}
                  size="lg"
                  disabled={generateDisabled || promptTooLong}
                  title={generationLocked ? accessMessage ?? undefined : undefined}
                  className={cn(
                    "min-w-0 flex-1 h-10 rounded-full px-5 text-sm font-semibold tracking-[-0.01em] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-150 active:scale-[0.98] sm:min-w-[168px]",
                    isGenerating && "ring-2 ring-primary/35 shadow-xs shadow-primary/20",
                    layout === "unified" && "w-full",
                    compact && "h-8 rounded-full px-3 text-xs font-medium shadow-none sm:min-w-0",
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
                    compact ? "Generate" : generateLabel
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
  className,
  fieldLabel,
  fieldLayout,
  disabled = false,
  icon,
  onChange,
  options,
  size = "default",
  value,
}: {
  ariaLabel: string;
  className?: string;
  fieldLabel?: string;
  fieldLayout?: "classic";
  disabled?: boolean;
  icon?: ReactNode;
  onChange: (value: TValue) => void;
  options: readonly {
    disabled?: boolean;
    label: string;
    triggerLabel?: string;
    value: TValue;
  }[];
  size?: "default" | "sm";
  value: TValue;
}) {
  const [open, setOpen] = useState(false);
  const currentOption =
    options.find((option) => option.value === value) ?? options[0];

  if (!currentOption) {
    return null;
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const optionButtons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "[data-ai-studio-setting-option]:not(:disabled)",
      ) ?? [],
    );

    if (optionButtons.length === 0) {
      return;
    }

    const currentIndex = Math.max(0, optionButtons.indexOf(event.currentTarget));
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? optionButtons.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1) % optionButtons.length
            : (currentIndex - 1 + optionButtons.length) % optionButtons.length;

    optionButtons[nextIndex]?.focus();
  }

  return (
    <div className={cn(fieldLayout === "classic" ? creation.settingField : fieldLabel ? "min-w-0 space-y-2" : "contents", className)}>
    {fieldLabel ? <span className={fieldLayout === "classic" ? "text-sm font-medium" : "block text-xs text-muted"}>{fieldLabel}</span> : null}
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={`${ariaLabel}, currently ${currentOption.label}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "inline-flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-card-muted/80 px-3 text-xs font-medium text-foreground ring-1 ring-inset ring-border/70 transition-all hover:bg-card hover:ring-border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" && "h-7 gap-1 px-2.5 text-[11px]",
              fieldLayout === "classic" && creation.settingButton,
            )}
          />
        }
      >
        {icon ? <span className="inline-flex shrink-0 items-center">{icon}</span> : null}
        <span className="truncate">
          {currentOption.triggerLabel ?? currentOption.label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-max min-w-40 max-w-[min(20rem,calc(100vw-1rem))] p-1.5"
      >
        <div role="listbox" aria-label={ariaLabel} className="flex flex-col gap-0.5">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                role="option"
                aria-selected={isSelected}
                data-ai-studio-setting-option
                onKeyDown={handleOptionKeyDown}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45",
                  isSelected
                    ? "bg-brand-soft font-semibold text-primary"
                    : "text-foreground hover:bg-card-muted",
                )}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover></div>
  );
}

export type AIStudioAspectRatio = "4:5" | "1:1" | "9:16" | "16:9";

export const AI_STUDIO_RATIO_OPTIONS: {
  id: AIStudioAspectRatio;
  label: string;
  triggerLabel: string;
  sublabel: string;
  iconClassName: string;
}[] = [
  {
    id: "4:5",
    label: "4:5 portrait",
    triggerLabel: "4:5 portrait",
    sublabel: "Instagram Feed (Default)",
    iconClassName: "h-4 w-3.5",
  },
  {
    id: "1:1",
    label: "1:1 square",
    triggerLabel: "1:1 square",
    sublabel: "Square Post / Carousel",
    iconClassName: "size-3.5",
  },
  {
    id: "9:16",
    label: "9:16 vertical",
    triggerLabel: "9:16",
    sublabel: "Reel / Story / TikTok",
    iconClassName: "h-5 w-3",
  },
  {
    id: "16:9",
    label: "16:9 landscape",
    triggerLabel: "16:9 landscape",
    sublabel: "Horizontal Video",
    iconClassName: "h-3 w-5",
  },
];

export function AiStudioRatioPicker({
  allowedRatios,
  fieldLabel,
  fieldLayout,
  disabled = false,
  onChange,
  size = "default",
  value,
}: {
  allowedRatios?: AIStudioAspectRatio[];
  fieldLabel?: string;
  fieldLayout?: "classic";
  disabled?: boolean;
  onChange: (ratio: AIStudioAspectRatio) => void;
  size?: "default" | "sm";
  value: AIStudioAspectRatio;
}) {
  const [open, setOpen] = useState(false);
  const options = allowedRatios
    ? AI_STUDIO_RATIO_OPTIONS.filter((option) => allowedRatios.includes(option.id))
    : AI_STUDIO_RATIO_OPTIONS;
  const currentOption =
    options.find((option) => option.id === value) ?? options[0]!;

  return (
    <div className={fieldLayout === "classic" ? creation.settingField : fieldLabel ? "min-w-0 space-y-2" : "contents"}>
    {fieldLabel ? <span className={fieldLayout === "classic" ? "text-sm font-medium" : "block text-xs text-muted"}>{fieldLabel}</span> : null}
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={`Aspect ratio, currently ${currentOption.label}`}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-card-muted/80 px-3 text-xs font-medium text-foreground ring-1 ring-inset ring-border/70 transition-all hover:bg-card hover:ring-border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" && "h-7 gap-1 px-2.5 text-[11px]",
              fieldLayout === "classic" && creation.settingButton,
            )}
          />
        }
      >
        {fieldLayout !== "classic" ? <span
          aria-hidden="true"
          className={cn(
            "inline-block shrink-0 rounded-[3px] border-2 border-muted-foreground",
            currentOption.iconClassName,
            size === "sm" && "scale-75",
          )}
        /> : null}
        <span>{size === "sm" ? currentOption.id : currentOption.triggerLabel}</span>
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
    </Popover></div>
  );
}
