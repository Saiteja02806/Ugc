import type { Json } from "@/lib/avatars/types";

export const HOOK_VIDEO_TEXT_PLACEMENT_REVIEW_VERSION =
  "hook-first-frame-placement-v1" as const;

export const hookVideoTextPlacementPresets = [
  "above_head",
  "below_face",
] as const;

export type HookVideoTextPlacementPreset =
  (typeof hookVideoTextPlacementPresets)[number];

export type HookVideoTextPlacement = {
  preset: HookVideoTextPlacementPreset;
  reviewVersion: string;
  reviewedAt: string;
  x: number;
  y: number;
};

export type HookVideoTextPosition = Pick<HookVideoTextPlacement, "x" | "y">;

export function parseHookVideoTextPlacement(
  value: Json | null | undefined,
): HookVideoTextPlacement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const preset = value.preset;
  const reviewVersion = value.reviewVersion;
  const reviewedAt = value.reviewedAt;
  const x = value.x;
  const y = value.y;

  if (
    typeof preset !== "string" ||
    !hookVideoTextPlacementPresets.includes(
      preset as HookVideoTextPlacementPreset,
    ) ||
    typeof reviewVersion !== "string" ||
    !reviewVersion.trim() ||
    typeof reviewedAt !== "string" ||
    !reviewedAt.trim() ||
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    x < 0 ||
    x > 1 ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    y < 0 ||
    y > 1
  ) {
    return null;
  }

  return {
    preset: preset as HookVideoTextPlacementPreset,
    reviewVersion: reviewVersion.trim(),
    reviewedAt: reviewedAt.trim(),
    x,
    y,
  };
}

export function getHookVideoTextPosition(
  placement: HookVideoTextPlacement | null | undefined,
): HookVideoTextPosition | null {
  return placement ? { x: placement.x, y: placement.y } : null;
}
