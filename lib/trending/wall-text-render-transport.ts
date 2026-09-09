import type { TrendingWallTextContent } from "./wall-text-types.ts";

/**
 * B (V13 / final V9) travels unchanged so an outdated worker cannot silently
 * draw it in Arial Regular. Stage the app, deploy the supporting worker, then
 * promote the app to production domains.
 * Historical V12/V11/V10 Arial Bold layouts
 * and V9 Avenir layouts travel as valid V4 Arial Regular; an updated worker uses
 * the content-layout version to restore the intended face before drawing it.
 * An older worker still renders the job instead of rejecting it. V8 keeps its
 * existing V3-compatible Arial Bold envelope.
 */
export function toWallTextRenderTransportContent(
  content: TrendingWallTextContent,
): TrendingWallTextContent {
  if (
    content.finalLayout?.version === "wall-text-final-layout-v8" ||
    content.finalLayout?.version === "wall-text-final-layout-v7" ||
    content.finalLayout?.version === "wall-text-final-layout-v6" ||
    content.finalLayout?.version === "wall-text-final-layout-v5"
  ) {
    return {
      ...content,
      finalLayout: {
        ...content.finalLayout,
        fontFamily: "Arial",
        fontWeight: 400,
        version: "wall-text-final-layout-v4",
      },
    };
  }

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
