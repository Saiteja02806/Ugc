import "server-only";

import { stat } from "node:fs/promises";
import { join } from "node:path";

const FONTCONFIG_FILE_PATH = join(process.cwd(), "fontconfig", "fonts.conf");

// Sharp/Pango emits a fallback-font warning in Vercel's serverless runtime
// when no system Fontconfig file exists. Set a bundled config before the first
// text measurement so the explicit Inter font file is actually honoured.
if (!process.env.FONTCONFIG_FILE) {
  process.env.FONTCONFIG_FILE = FONTCONFIG_FILE_PATH;
}
if (!process.env.FONTCONFIG_PATH) {
  process.env.FONTCONFIG_PATH = join(process.cwd(), "fontconfig");
}

const INTER_REGULAR_FONT_PATH = join(
  process.cwd(),
  "lib",
  "trending",
  "fonts",
  // Keep server-side measurement on the same Inter face that the browser
  // loads through next/font. A TrueType asset is used here because it is
  // reliably parsed by Sharp/Pango in Vercel's serverless runtime.
  "inter-variable.ttf",
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
