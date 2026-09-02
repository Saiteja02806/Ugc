import "server-only";

import { stat } from "node:fs/promises";
import { join } from "node:path";

const FONTCONFIG_FILE_PATH = join(process.cwd(), "fontconfig", "fonts.conf");

// Sharp/Pango emits a fallback-font warning in Vercel's serverless runtime
// when no system Fontconfig file exists. Set a bundled config before the first
// text measurement so the explicit font file is actually honoured.
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
const ARIAL_BOLD_FONT_PATH = join(
  process.cwd(),
  "lib",
  "trending",
  "fonts",
  "arial-bold.ttf",
);
const ARIAL_REGULAR_FONT_PATH = join(
  process.cwd(),
  "lib",
  "trending",
  "fonts",
  "arial-regular.ttf",
);

let verifiedInterFontPath: Promise<string> | null = null;
let verifiedArialBoldFontPath: Promise<string> | null = null;
let verifiedArialRegularFontPath: Promise<string> | null = null;

/**
 * Sharp can silently fall back to a different installed font when fontfile is
 * unavailable. Verify the packaged Inter face before measuring any Wall copy
 * so a deployment cannot approve lines using different glyph metrics.
 */
export function getVerifiedWallTextInterFontPath() {
  verifiedInterFontPath ??= verifyFontPath({
    fontPath: INTER_REGULAR_FONT_PATH,
    label: "Inter Regular",
  });
  return verifiedInterFontPath;
}

export function getVerifiedWallTextArialBoldFontPath() {
  verifiedArialBoldFontPath ??= verifyFontPath({
    fontPath: ARIAL_BOLD_FONT_PATH,
    label: "Arial Bold",
  });
  return verifiedArialBoldFontPath;
}

/**
 * New Wall-of-Text layouts use the packaged Arial Regular face at 400. Verify
 * it before measurement so preview line breaks match the GCP render worker.
 */
export function getVerifiedWallTextArialRegularFontPath() {
  verifiedArialRegularFontPath ??= verifyFontPath({
    fontPath: ARIAL_REGULAR_FONT_PATH,
    label: "Arial Regular",
  });
  return verifiedArialRegularFontPath;
}

async function verifyFontPath(params: { fontPath: string; label: string }) {
  const font = await stat(params.fontPath).catch(() => null);

  if (!font?.isFile() || font.size === 0) {
    throw new Error(
      `The packaged ${params.label} font is unavailable for Wall-of-text measurement.`,
    );
  }

  return params.fontPath;
}
