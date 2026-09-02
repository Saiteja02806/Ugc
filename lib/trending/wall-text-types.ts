export const WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v8" as const;
export const PREVIOUS_WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v7" as const;
export const LEGACY_WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v6" as const;
export const OLDER_WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v5" as const;
// V4 predates the measured final-layout contract. It remains readable for the
// writer's historical semantic payloads and must not be reclassified as V5.
export const HISTORICAL_WALL_TEXT_CONTENT_LAYOUT_VERSION =
  "wall-text-overlay-v4" as const;
export const WALL_TEXT_LAYOUT_VERSION = "wall-text-layout-v4" as const;
// V4 moves new Wall-of-Text renders from the old Arial Bold treatment to the
// packaged Arial Regular face at 400. Keep V3 readable for historical drafts
// and already-rendered videos, but never use it for new content.
export const WALL_TEXT_FINAL_LAYOUT_VERSION = "wall-text-final-layout-v4" as const;
export const PREVIOUS_WALL_TEXT_FINAL_LAYOUT_VERSION =
  "wall-text-final-layout-v3" as const;
export const LEGACY_WALL_TEXT_FINAL_LAYOUT_VERSION =
  "wall-text-final-layout-v2" as const;
export const OLDER_WALL_TEXT_FINAL_LAYOUT_VERSION =
  "wall-text-final-layout-v1" as const;
export const WALL_TEXT_GENERATOR_VERSION =
  "business-profile-wall-text-v9" as const;
// Version the measured inner text boundary separately from the generator.
// This lets the feed recognize older V9 rows that were saved before the
// boundary was enforced and send them through the existing backfill path.
export const WALL_TEXT_RENDER_SAFETY_VERSION =
  "wall-text-inner-safe-v2" as const;
// Freeform is the current Wall writing mode. It is deliberately separate from
// the dormant 30-format registry so new copy is never mislabeled as a format
// it was not asked to follow.
export const WALL_TEXT_FREEFORM_PATTERN = "freeform" as const;
export const WALL_TEXT_FREEFORM_FORMAT_LIBRARY_VERSION =
  "wall-text-formats-disabled-v1" as const;
export const WALL_TEXT_FREEFORM_SELECTOR_VERSION =
  "wall-text-freeform-selection-v1" as const;
export const PREVIOUS_WALL_TEXT_GENERATOR_VERSION =
  "business-profile-wall-text-v8" as const;
export const LEGACY_WALL_TEXT_GENERATOR_VERSION =
  "business-profile-wall-text-v7" as const;
export const OLDER_WALL_TEXT_GENERATOR_VERSION =
  "business-profile-wall-text-v6" as const;
export const WALL_TEXT_READABLE_GENERATOR_VERSIONS = [
  OLDER_WALL_TEXT_GENERATOR_VERSION,
  LEGACY_WALL_TEXT_GENERATOR_VERSION,
  PREVIOUS_WALL_TEXT_GENERATOR_VERSION,
  WALL_TEXT_GENERATOR_VERSION,
] as const;

export const LEGACY_WALL_TEXT_PATTERNS = [
  "problem_change_result",
  "mistake_correction",
  "situation_discovery",
  "before_after",
  "belief_reframe",
  "action_benefit",
] as const;

export const LEGACY_WALL_TEXT_FORMAT_IDS = [
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

export const WALL_TEXT_FORMAT_IDS = [
  "hidden_alternative",
  "manual_automatic",
  "secret_advantage",
  "outcome_mystery",
  "authority_reaction",
  "personal_obsession",
  "numbered_curiosity",
  "rule_checklist",
  "hidden_cause",
  "contrarian_opinion",
  "niche_pov",
  "community_question",
  "transformation_timeframe",
  "method_framework",
  "emotional_reframe",
  "personal_manifesto",
  "relatable_situation",
  "desire_identity_stack",
  "old_way_regret",
  "retrospective_lesson",
  "self_audit",
  "warning_alert",
  "personal_stance",
  "future_snapshot",
  "metaphor_reframe",
  "swap_upgrade_stack",
  "niche_milestones",
  "insider_truths",
  "aspirational_archetype",
  "internal_conflict",
] as const;

// Kept as a compatibility export for consumers that read legacy saved Walls.
export const WALL_TEXT_PATTERNS = [
  ...LEGACY_WALL_TEXT_PATTERNS,
  ...LEGACY_WALL_TEXT_FORMAT_IDS,
  ...WALL_TEXT_FORMAT_IDS,
  WALL_TEXT_FREEFORM_PATTERN,
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
export type LegacyWallTextFormatId =
  (typeof LEGACY_WALL_TEXT_FORMAT_IDS)[number];
export type WallTextPattern = (typeof WALL_TEXT_PATTERNS)[number];
export type WallTextSegmentRole = (typeof WALL_TEXT_SEGMENT_ROLES)[number];
export type WallTextPlacementZone = (typeof WALL_TEXT_PLACEMENT_ZONES)[number];
// Existing 36-42px layouts remain readable without reflow. The current layout
// engine emits the restored 44-52px range.
export type WallTextFontSize = 36 | 38 | 40 | 42 | 44 | 46 | 48 | 50 | 52;
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
export type WallTextPlainContent = {
  kind: "text";
  text: string;
};
export type WallTextSourceContent =
  | WallTextPlainContent
  | WallTextProseContent
  | WallTextListContent;
export type WallTextLayoutBlock = {
  lines: string[];
  role: "item" | "prose" | "text" | "title";
};
type WallTextFinalLayoutBase = {
  blocks: WallTextLayoutBlock[];
  fontSizePx: WallTextFontSize;
  lineHeightPx: number;
  textBox: WallTextNormalizedBox;
};
export type WallTextFinalLayout =
  | (WallTextFinalLayoutBase & {
      fontFamily: "Arial";
      fontWeight: 400;
      version: typeof WALL_TEXT_FINAL_LAYOUT_VERSION;
    })
  | (WallTextFinalLayoutBase & {
      fontFamily: "Arial";
      fontWeight: 500;
      version: typeof PREVIOUS_WALL_TEXT_FINAL_LAYOUT_VERSION;
    })
  | (WallTextFinalLayoutBase & {
      fontFamily: "Inter";
      fontWeight: 400;
      version:
        | typeof LEGACY_WALL_TEXT_FINAL_LAYOUT_VERSION
        | typeof OLDER_WALL_TEXT_FINAL_LAYOUT_VERSION;
    });
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
  formatId?: WallTextPattern;
  fullText: string;
  kind: "wall_text";
  layoutVersion:
    | typeof WALL_TEXT_CONTENT_LAYOUT_VERSION
    | typeof PREVIOUS_WALL_TEXT_CONTENT_LAYOUT_VERSION
    | typeof LEGACY_WALL_TEXT_CONTENT_LAYOUT_VERSION
    | typeof OLDER_WALL_TEXT_CONTENT_LAYOUT_VERSION
    | typeof HISTORICAL_WALL_TEXT_CONTENT_LAYOUT_VERSION;
  pattern: WallTextPattern;
  renderFontSize?: WallTextFontSize;
  renderSafetyVersion?: typeof WALL_TEXT_RENDER_SAFETY_VERSION;
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
