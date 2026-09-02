import type { TrendingWallTextContent } from "./wall-text-types.ts";

/**
 * V4 is the persisted Arial Regular 400 contract. During the required
 * Vercel-before-worker deployment order, an older worker does not yet know
 * V4. Send it a V3-compatible envelope that it can render instead of letting
 * it reject the job. The V8 layout version stays in the payload, so the new
 * worker recognizes this envelope and restores Arial Regular 400 before it
 * draws. Historic V3 records use V7 and therefore remain Arial Bold 500.
 */
export function toWallTextRenderTransportContent(
  content: TrendingWallTextContent,
): TrendingWallTextContent {
  if (content.finalLayout?.version === "wall-text-final-layout-v4") {
    return {
      ...content,
      finalLayout: {
        ...content.finalLayout,
        fontFamily: "Arial",
        fontWeight: 500,
        version: "wall-text-final-layout-v3",
      },
    };
  }

  return content;
}
