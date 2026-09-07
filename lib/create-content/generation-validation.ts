import {
  createHookTextLayout,
  HookTextLayoutError,
} from "../trending/hook-text-layout.ts";

import {
  normalizeCreateContentText,
  type CreateContentTextFormat,
} from "./card-contract.ts";
import { CREATE_CONTENT_WALL_TEXT_LINE_RANGE } from "./generation-contract.ts";
import { getCreateContentWallTextLines } from "./render-contract.ts";

export class CreateContentGeneratedCopyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateContentGeneratedCopyValidationError";
  }
}

/**
 * Runs before generated copy reaches the AI drawer. This deliberately uses the
 * same layout logic as the preview and final renderer, rather than treating
 * the prompt as the only formatting guard.
 */
export function normalizeAndValidateGeneratedCreateContentText(params: {
  format: CreateContentTextFormat;
  text: string;
}) {
  const text = normalizeCreateContentText(params.text);

  if (!text) {
    throw new CreateContentGeneratedCopyValidationError(
      "The AI returned empty copy.",
    );
  }

  if (params.format === "hook_text") {
    try {
      // The saved lines are the exact lines that the Trending Hook overlay and
      // final MP4 renderer will use.
      return createHookTextLayout(text).lines.join("\n");
    } catch (error) {
      const detail =
        error instanceof HookTextLayoutError
          ? error.message
          : "Hook text cannot be rendered.";
      throw new CreateContentGeneratedCopyValidationError(detail);
    }
  }

  const lines = getCreateContentWallTextLines(text);
  if (
    lines.length < CREATE_CONTENT_WALL_TEXT_LINE_RANGE.min ||
    lines.length > CREATE_CONTENT_WALL_TEXT_LINE_RANGE.max
  ) {
    throw new CreateContentGeneratedCopyValidationError(
      "Wall-of-Text must contain five to eight readable lines.",
    );
  }

  return lines.join("\n");
}
