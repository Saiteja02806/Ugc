export const WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v5" as const;
export const LEGACY_WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v4" as const;
export const WALL_TEXT_LAYOUT_VERSION = "wall-text-layout-v4" as const;
export const WALL_TEXT_FINAL_LAYOUT_VERSION = "wall-text-final-layout-v1" as const;
export const WALL_TEXT_GENERATOR_VERSION =
  "business-profile-wall-text-v6" as const;
export const LEGACY_WALL_TEXT_GENERATOR_VERSION =
  "business-profile-wall-text-v5" as const;

export const LEGACY_WALL_TEXT_PATTERNS = [
  "problem_change_result",
  "mistake_correction",
  "situation_discovery",
  "before_after",
  "belief_reframe",
  "action_benefit",
] as const;

export const WALL_TEXT_FORMAT_IDS = [
  "identity_mirror",
  "recognizable_moment",
  "hidden_truth",
  "contrarian_reframe",
  "personal_confession",
  "aspiration_redefinition",
  "pain_beneath_the_pain",
  "niche_insight",
  "list_rules",
  "community_prompt",
  "analogy_reframe",
  "progression_sequence",
] as const;

// Kept as a compatibility export for consumers that read legacy saved Walls.
export const WALL_TEXT_PATTERNS = [
  ...LEGACY_WALL_TEXT_PATTERNS,
  ...WALL_TEXT_FORMAT_IDS,
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

export type LegacyWallTextPattern =
  (typeof LEGACY_WALL_TEXT_PATTERNS)[number];
export type WallTextFormatId = (typeof WALL_TEXT_FORMAT_IDS)[number];
export type WallTextPattern = (typeof WALL_TEXT_PATTERNS)[number];
export type WallTextSegmentRole = (typeof WALL_TEXT_SEGMENT_ROLES)[number];
export type WallTextPlacementZone = (typeof WALL_TEXT_PLACEMENT_ZONES)[number];
export type WallTextFontSize = 44 | 46 | 48 | 50 | 52;
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
export type WallTextProseContent = {
  kind: "prose";
  text: string;
};
export type WallTextListContent = {
  items: string[];
  kind: "list";
  title: string;
};
export type WallTextSourceContent =
  | WallTextProseContent
  | WallTextListContent;
export type WallTextLayoutBlock = {
  lines: string[];
  role: "prose" | "title" | "item";
};
export type WallTextFinalLayout = {
  blocks: WallTextLayoutBlock[];
  fontFamily: "Inter";
  fontSizePx: WallTextFontSize;
  fontWeight: 700;
  lineHeightPx: number;
  textBox: WallTextNormalizedBox;
  version: typeof WALL_TEXT_FINAL_LAYOUT_VERSION;
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
  finalLayout?: WallTextFinalLayout;
  formatId?: WallTextFormatId;
  fullText: string;
  kind: "wall_text";
  layoutVersion:
    | typeof WALL_TEXT_CONTENT_LAYOUT_VERSION
    | typeof LEGACY_WALL_TEXT_CONTENT_LAYOUT_VERSION;
  pattern: WallTextPattern;
  renderFontSize?: WallTextFontSize;
  segments: WallTextSegment[];
  sourceContent?: WallTextSourceContent;
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

export function getWallTextRenderBlocks(content: TrendingWallTextContent) {
  return (
    content.finalLayout?.blocks ??
    content.segments.map((segment) => ({
      lines: segment.lines,
      role: "prose" as const,
    }))
  );
}
