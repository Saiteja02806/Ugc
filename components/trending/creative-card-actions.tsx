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
      className="mx-auto mt-4 flex w-full max-w-[300px] items-center justify-center gap-4 sm:gap-5"
      role="group"
    >
      <Button
        type="button"
        variant="creative-reject"
        size="creative-icon"
        aria-label="Reject this creative"
        title="Reject"
        disabled={disabled}
        onClick={onReject}
      >
        <X aria-hidden="true" />
      </Button>
      <Button
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
      <Button
        type="button"
        variant="creative-accept"
        size="creative-icon"
        aria-label="Accept this creative"
        title="Accept"
        disabled={disabled}
        onClick={onAccept}
      >
        <Check aria-hidden="true" />
      </Button>
    </div>
  );
}
