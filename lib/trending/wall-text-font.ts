import "server-only";

import { stat } from "node:fs/promises";
import { join } from "node:path";

const INTER_REGULAR_FONT_PATH = join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "inter",
  "files",
  "inter-latin-400-normal.woff",
);

let verifiedInterFontPath: Promise<string> | null = null;

/**
 * Sharp can silently fall back to a different installed font when fontfile is
 * unavailable. Verify the packaged Inter face before measuring any Wall copy
 * so a deployment cannot approve lines using different glyph metrics.
 */
export function getVerifiedWallTextInterFontPath() {
  verifiedInterFontPath ??= verifyInterFontPath();
  return verifiedInterFontPath;
}

async function verifyInterFontPath() {
  const font = await stat(INTER_REGULAR_FONT_PATH).catch(() => null);

  if (!font?.isFile() || font.size === 0) {
    throw new Error(
      "The packaged Inter Regular font is unavailable for Wall-of-text measurement.",
    );
  }

  return INTER_REGULAR_FONT_PATH;
}
