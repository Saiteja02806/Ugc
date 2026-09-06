import type { ReactionMatch } from "./matcher.ts";
import type { ReactionContent } from "./taxonomy.ts";

export const REACTION_RENDER_CANVAS = { height: 1920, width: 1080 } as const;

export type ReactionRenderPlan = {
  canvas: typeof REACTION_RENDER_CANVAS;
  foreground: {
    anchor: ReactionMatch["clip"]["placement"]["anchor"];
    heightPercent: number;
  };
  labels: readonly string[];
  text: {
    lines: readonly string[];
    position: { x: number; y: number };
    treatment: ReactionContent["visualTreatment"];
  };
};

export function buildReactionRenderPlan(params: {
  content: ReactionContent;
  match: ReactionMatch;
}): ReactionRenderPlan {
  const labels =
    params.content.semantic.structure === "role_contrast"
      ? params.content.semantic.roles
      : [];
  return {
    canvas: REACTION_RENDER_CANVAS,
    foreground: {
      anchor: params.match.clip.placement.anchor,
      heightPercent: params.match.clip.placement.heightPercent,
    },
    labels,
    text: {
      lines: params.content.lines,
      position: { x: 0.5, y: params.content.visualTreatment === "white_card" ? 0.12 : 0.1 },
      treatment: params.content.visualTreatment,
    },
  };
}
