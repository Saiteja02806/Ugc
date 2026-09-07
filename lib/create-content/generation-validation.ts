import "server-only";

import {
  createHookTextLayout,
  HookTextLayoutError,
} from "../trending/hook-text-layout.ts";
import {
  validateWallTextRenderFit,
  WallTextRenderFitError,
} from "../trending/wall-text-render-validation.ts";

import {
  createCenteredTextPosition,
  normalizeCreateContentText,
  type CreateContentTextFormat,
  type CreateContentTextPosition,
} from "./card-contract.ts";
import {
  createCreateContentWallTextContent,
  createCreateContentWallTextLayout,
  getCreateContentWallTextLines,
} from "./render-contract.ts";

/**
 * Raised when text cannot be shown by the same layout that preview and the
 * final MP4 use. Callers can surface this as a correction instead of letting
 * invalid saved copy become a render job that can never complete.
 */
export class CreateContentTextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateContentTextValidationError";
  }
}

export class CreateContentGeneratedCopyValidationError extends CreateContentTextValidationError {
  constructor(message: string) {
    super(message);
    this.name = "CreateContentGeneratedCopyValidationError";
  }
}

/**
 * Canonicalizes text and proves that the exact Create Content preview/final
 * renderer can display it. This is intentionally shared by generation,
 * manual saves, and render enqueueing so no path can save copy that later
 * creates an unrenderable preview or background job.
 */
export async function normalizeAndValidateCreateContentText(params: {
  format: CreateContentTextFormat;
  position?: CreateContentTextPosition;
  text: string;
}): Promise<string> {
  const text = normalizeCreateContentText(params.text);

  if (!text) {
    throw new CreateContentTextValidationError("Text cannot be empty.");
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
      throw new CreateContentTextValidationError(detail);
    }
  }

  const lines = getCreateContentWallTextLines(text);
  if (lines.length < 4 || lines.length > 8) {
    throw new CreateContentTextValidationError(
      "Wall-of-Text must contain four to eight readable lines.",
    );
  }

  const normalizedText = lines.join("\n");
  const layout = createCreateContentWallTextLayout(
    params.position ?? createCenteredTextPosition(),
  );
  const content = createCreateContentWallTextContent(normalizedText, layout);

  try {
    // This uses the packaged Arial Bold font and the final 9:16 text box,
    // which is the same measurement guard used for final Wall rendering.
    await validateWallTextRenderFit(content);
  } catch (error) {
    if (error instanceof WallTextRenderFitError) {
      throw new CreateContentTextValidationError(error.message);
    }
    throw error;
  }

  return normalizedText;
}

/**
 * Runs before generated copy reaches the AI drawer. Keep its dedicated error
 * type so the generation API can report model-copy rejection as a 422 while
 * manual saves use the same renderer-fit gate with a normal input error.
 */
export async function normalizeAndValidateGeneratedCreateContentText(params: {
  format: CreateContentTextFormat;
  text: string;
}): Promise<string> {
  try {
    return await normalizeAndValidateCreateContentText(params);
  } catch (error) {
    if (error instanceof CreateContentTextValidationError) {
      throw new CreateContentGeneratedCopyValidationError(error.message);
    }
    throw error;
  }
}
