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
          "mx-auto w-full border bg-card shadow-floating",
          layout === "unified"
            ? "max-w-[944px] rounded-[24px] border-border-strong p-0"
            : "max-w-[1024px] rounded-[var(--radius-panel)] border-border p-2.5 sm:p-3",
        )}
      >
        <FieldGroup className={layout === "unified" ? "gap-0" : "gap-2"}>
          <Field
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3",
              layout === "unified"
                ? "gap-y-1 px-4 pb-1 pt-3 sm:px-5"
                : "gap-y-2 px-1 pt-1",
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
              <span className="shrink-0 tabular-nums">
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
                    "min-w-0 flex-1 transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.98] sm:min-w-[168px]",
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
    <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-card-muted px-3 text-sm font-medium text-foreground ring-1 ring-inset ring-border">
      {icon}
      {label}
    </span>
  );
}
