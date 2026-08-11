"use client";

import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      className="mx-auto mt-5 flex items-center justify-center gap-4 sm:gap-5"
      role="group"
    >
      <Button
        type="button"
        variant="creative-reject"
        size="creative-icon"
        aria-label="Reject this creative"
        title="Reject"
        disabled={disabled || rejectDisabled}
        onClick={onReject}
      >
        <X data-icon="inline-start" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="creative-accept"
        size="creative-icon"
        aria-label="Accept this creative"
        title="Accept"
        disabled={disabled || acceptDisabled}
        onClick={onAccept}
      >
        <Check data-icon="inline-start" aria-hidden="true" />
      </Button>
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
      type="button"
      variant="creative-edit"
      size="creative-edit"
      aria-label="Edit this creative"
      disabled={disabled}
      onClick={onEdit}
    >
      <Pencil data-icon="inline-start" aria-hidden="true" />
      Edit
    </Button>
  );
}
