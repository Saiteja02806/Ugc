"use client";

import {
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
import { cn } from "@/lib/utils";

export function AiStudioComposer({
  active,
  accessMessage,
  ariaLabel,
  generateDisabled,
  generateLabel,
  generationLocked,
  isGenerating,
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
  generateDisabled: boolean;
  generateLabel: string;
  generationLocked: boolean;
  isGenerating: boolean;
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
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 64), 128)}px`;
  }, [active, prompt]);

  return (
    <div className="sticky bottom-0 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <form
        noValidate
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-[1024px] rounded-[var(--radius-panel)] border border-border bg-card p-2.5 shadow-floating sm:p-3"
      >
        <FieldGroup className="gap-2">
          <Field className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-1 pt-1">
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
                "max-h-32 min-h-16 w-full resize-none overflow-y-auto rounded-lg bg-transparent px-2 py-1.5 text-sm font-medium leading-6 text-foreground outline-none placeholder:text-muted-subtle focus-visible:ring-2 focus-visible:ring-focus sm:text-[15px]",
                leadingControl ? "col-start-2 row-start-1" : "col-span-full",
              )}
              placeholder={placeholder}
            />
            <FieldDescription
              id={promptHelperId}
              className={cn(
                "col-span-full flex min-w-0 items-start justify-between gap-3 px-2 text-xs",
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
              <span className="shrink-0 tabular-nums">
                {prompt.length.toLocaleString("en-US")}/
                {maxLength.toLocaleString("en-US")}
              </span>
            </FieldDescription>
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <Button
              type="button"
              variant="muted"
              size="lg"
              aria-controls={controlsId}
              aria-expanded={controlsOpen}
              onClick={() => setControlsOpen((current) => !current)}
              className="w-full justify-between sm:hidden"
            >
              <SlidersHorizontal data-icon="inline-start" aria-hidden="true" />
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
            <div
              id={controlsId}
              className={cn(
                "mt-2 flex-wrap items-center gap-2 sm:mt-0 sm:flex",
                controlsOpen ? "flex" : "hidden",
              )}
            >
              {settings}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 sm:items-end">
            {generationLocked ? (
              <p
                className="px-0.5 text-[11px] font-medium text-muted-subtle"
              >
                {accessMessage ?? "Generation is currently unavailable."}
              </p>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              {secondaryActions}
              <Button
                type="submit"
                size="lg"
                disabled={generateDisabled || promptTooLong}
                title={generationLocked ? accessMessage ?? undefined : undefined}
                className="min-w-0 flex-1 sm:min-w-[168px]"
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
    <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-card-muted px-3 text-sm font-medium text-foreground ring-1 ring-inset ring-border">
      {icon}
      {label}
    </span>
  );
}
