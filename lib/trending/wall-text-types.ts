export const WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v4" as const;
export const WALL_TEXT_LAYOUT_VERSION = "wall-text-layout-v4" as const;
export const WALL_TEXT_GENERATOR_VERSION =
  "business-profile-wall-text-v5" as const;

export const WALL_TEXT_PATTERNS = [
  "problem_change_result",
  "mistake_correction",
  "situation_discovery",
  "before_after",
  "belief_reframe",
  "action_benefit",
] as const;

export const WALL_TEXT_SEGMENT_ROLES = [
  "lead",
  "support",
  "closing",
] as const;
export const WALL_TEXT_PLACEMENT_ZONES = [
  "upper-middle",
  "middle",
  "lower-middle",
] as const;

export type WallTextPattern = (typeof WALL_TEXT_PATTERNS)[number];
export type WallTextSegmentRole = (typeof WALL_TEXT_SEGMENT_ROLES)[number];
export type WallTextPlacementZone = (typeof WALL_TEXT_PLACEMENT_ZONES)[number];
export type WallTextNormalizedBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};
export type WallTextSegment = {
  lines: string[];
  role: WallTextSegmentRole;
};
export type WallTextPlacementAnalysis = {
  contrastScore: number;
  faceBoxes: WallTextNormalizedBox[];
  faceOverlap: number;
  importantRegions: WallTextNormalizedBox[];
  selectedZone: WallTextPlacementZone;
  version: "wall-text-placement-v2";
};

export type TrendingWallTextContent = {
  fullText: string;
  kind: "wall_text";
  layoutVersion: typeof WALL_TEXT_CONTENT_LAYOUT_VERSION;
  pattern: WallTextPattern;
  renderFontSize?: 44 | 46 | 48 | 52;
  segments: WallTextSegment[];
};

export type TrendingWallTextLayout = {
  alignment: "center";
  placement: WallTextPlacementZone;
  placementSource: "face-analysis" | "visual-group-fallback";
  safeArea: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  textBox: WallTextNormalizedBox;
  version: typeof WALL_TEXT_LAYOUT_VERSION;
};
