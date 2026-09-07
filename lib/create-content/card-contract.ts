export const CREATE_CONTENT_CARD_VERSION = "create-content-card-v1" as const;

export const CREATE_CONTENT_TEXT_FORMATS = [
  "wall_text",
  "hook_text",
] as const;

export type CreateContentTextFormat =
  (typeof CREATE_CONTENT_TEXT_FORMATS)[number];

export type CreateContentTextPosition = {
  x: number;
  y: number;
};

export type CreateContentTextOverlay = {
  format: CreateContentTextFormat;
  position: CreateContentTextPosition;
  text: string;
};

/**
 * A Create Content card belongs to one source Creative Asset. It intentionally
 * has no Trending assignment, idea, or daily-plan reference.
 */
export type CreateContentCard = {
  overlay: CreateContentTextOverlay;
  revision: number;
  sourceMediaAssetId: string;
  updatedAt: string | null;
  version: typeof CREATE_CONTENT_CARD_VERSION;
};

const MINIMUM_POSITION = 0.04;
const MAXIMUM_POSITION = 0.96;

export const CREATE_CONTENT_TEXT_MAX_CHARACTERS = 600;

export function clampCreateContentTextPosition(
  position: CreateContentTextPosition,
): CreateContentTextPosition {
  return {
    x: clamp(position.x),
    y: clamp(position.y),
  };
}

export function createCenteredTextPosition(): CreateContentTextPosition {
  return { x: 0.5, y: 0.5 };
}

export function isCreateContentTextFormat(
  value: unknown,
): value is CreateContentTextFormat {
  return (
    typeof value === "string" &&
    CREATE_CONTENT_TEXT_FORMATS.includes(value as CreateContentTextFormat)
  );
}

export function normalizeCreateContentText(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .trim()
    .slice(0, CREATE_CONTENT_TEXT_MAX_CHARACTERS);
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(MAXIMUM_POSITION, Math.max(MINIMUM_POSITION, value));
}
