export const WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v1" as const;
export const WALL_TEXT_LAYOUT_VERSION = "wall-text-layout-v1" as const;

export type WallTextBlockId = "headline" | "body" | "closing";

export type TrendingWallTextContent = {
  blocks: Array<{
    id: WallTextBlockId;
    text: string;
  }>;
  kind: "wall_text";
  layoutVersion: typeof WALL_TEXT_CONTENT_LAYOUT_VERSION;
};

export type TrendingWallTextLayout = {
  alignment: "left";
  placement: "bottom" | "center" | "top";
  safeArea: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  version: typeof WALL_TEXT_LAYOUT_VERSION;
};
