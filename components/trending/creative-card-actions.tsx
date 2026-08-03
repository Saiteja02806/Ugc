"use client";

import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CreativeCardActions({
  disabled = false,
  onAccept,
  onEdit,
  onReject,
}: {
  disabled?: boolean;
  onAccept: () => void;
  onEdit: () => void;
  onReject: () => void;
}) {
  return (
    <div
      data-deck-control
      aria-label="Creative actions"
      className="mx-auto mt-4 grid w-full max-w-md grid-cols-3 gap-2 sm:gap-3"
      role="group"
    >
      <Button
        type="button"
        variant="creative-reject"
        size="creative-action"
        aria-label="Reject this creative"
        disabled={disabled}
        onClick={onReject}
      >
        <X data-icon="inline-start" aria-hidden="true" />
        Reject
      </Button>
      <Button
        type="button"
        variant="creative-edit"
        size="creative-action"
        aria-label="Edit this creative"
        disabled={disabled}
        onClick={onEdit}
      >
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Edit
      </Button>
      <Button
        type="button"
        variant="creative-accept"
        size="creative-action"
        aria-label="Accept this creative"
        disabled={disabled}
        onClick={onAccept}
      >
        <Check data-icon="inline-start" aria-hidden="true" />
        Accept
      </Button>
    </div>
  );
}
