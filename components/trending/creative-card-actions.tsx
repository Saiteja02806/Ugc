"use client";

import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const LAPTOP_AND_DESKTOP_DECISION_BUTTON_CLASS =
  "min-[1024px]:size-[clamp(3.5rem,calc((100dvh-288px)*0.1584),4.75rem)] min-[1024px]:[&_svg:not([class*='size-'])]:size-[clamp(1.25rem,calc((100dvh-288px)*0.057),1.75rem)]";

export function CreativeDecisionActions({
  acceptDisabled = false,
  disabled = false,
  onAccept,
  onReject,
  rejectDisabled = false,
}: {
  acceptDisabled?: boolean;
  disabled?: boolean;
  onAccept: () => void;
  onReject: () => void;
  rejectDisabled?: boolean;
}) {
  return (
    <div
      data-deck-control
      aria-label="Creative decisions"
      className="mx-auto mt-3.5 sm:mt-4 flex items-center justify-center gap-4 sm:gap-5"
      role="group"
    >
      <div className="flex flex-col items-center gap-1.5">
        <Button
          type="button"
          variant="creative-reject"
          size="creative-icon"
          aria-label="Reject this creative"
          title="Reject"
          disabled={disabled || rejectDisabled}
          onClick={onReject}
          className={`transition-transform duration-150 active:scale-95 ${LAPTOP_AND_DESKTOP_DECISION_BUTTON_CLASS}`}
        >
          <X data-icon="inline-start" aria-hidden="true" />
        </Button>
        <span className="hidden items-center gap-1 text-[11px] font-medium text-muted sm:inline-flex">
          <kbd className="rounded border border-border/80 bg-card-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-foreground/75">
            ←
          </kbd>
          Skip
        </span>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <Button
          type="button"
          variant="creative-accept"
          size="creative-icon"
          aria-label="Accept this creative"
          title="Accept"
          disabled={disabled || acceptDisabled}
          onClick={onAccept}
          className={`transition-transform duration-150 active:scale-95 ${LAPTOP_AND_DESKTOP_DECISION_BUTTON_CLASS}`}
        >
          <Check data-icon="inline-start" aria-hidden="true" />
        </Button>
        <span className="hidden items-center gap-1 text-[11px] font-medium text-muted sm:inline-flex">
          Accept
          <kbd className="rounded border border-border/80 bg-card-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-foreground/75">
            →
          </kbd>
        </span>
      </div>
    </div>
  );
}

export function CreativeEditAction({
  disabled = false,
  onEdit,
}: {
  disabled?: boolean;
  onEdit: () => void;
}) {
  return (
    <Button
      data-deck-control
      data-trending-edit-control
      type="button"
      variant="creative-edit"
      size="creative-edit"
      aria-label="Edit this creative (Press E)"
      title="Edit (E)"
      className="group transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary active:scale-[0.98]"
      disabled={disabled}
      onClick={onEdit}
    >
      <Pencil
        data-icon="inline-start"
        className="size-3.5 transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110"
        aria-hidden="true"
      />
      <span>Edit</span>
      <kbd className="hidden ml-1 rounded border border-border/80 bg-card-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted transition-colors group-hover:border-primary/30 group-hover:text-primary sm:inline-block">
        E
      </kbd>
    </Button>
  );
}
