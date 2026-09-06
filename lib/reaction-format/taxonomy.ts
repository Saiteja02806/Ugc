export const reactionMemeStructures = [
  "situation_payoff",
  "expectation_reality",
  "comparison",
  "action_realization",
  "setup_escalation",
  "role_contrast",
] as const;

export const reactionLanguageFormats = [
  "pov",
  "when",
  "me_when",
  "me_after",
  "me_realizing",
  "direct_statement",
  "comparison",
] as const;

export const reactionEmotions = [
  "relief",
  "frustration",
  "surprise",
  "regret",
  "satisfaction",
  "irony",
  "escalation",
] as const;

export const reactionVisualTreatments = [
  "white_card",
  "outlined_text",
  "caption_with_labels",
] as const;

export const reactionClipTypes = [
  "side_eye",
  "facepalm",
  "deadpan",
  "confusion",
  "shock",
  "relief",
  "celebration",
  "laughter",
  "disappointment",
  "regret",
  "unbothered",
  "concern",
  "focused",
  "playful",
] as const;

export const reactionForegroundAnchors = [
  "bottom_center",
  "bottom_left",
  "bottom_right",
  "center",
] as const;

export const reactionSubjectCounts = ["one", "two", "group"] as const;

export const reactionCompositions = [
  "close_up",
  "bust",
  "full_body",
  "wide",
] as const;

export const reactionAssetStatuses = ["pending", "active", "excluded"] as const;

export type ReactionMemeStructure = (typeof reactionMemeStructures)[number];
export type ReactionLanguageFormat = (typeof reactionLanguageFormats)[number];
export type ReactionEmotion = (typeof reactionEmotions)[number];
export type ReactionVisualTreatment = (typeof reactionVisualTreatments)[number];
export type ReactionClipType = (typeof reactionClipTypes)[number];
export type ReactionForegroundAnchor =
  (typeof reactionForegroundAnchors)[number];
export type ReactionSubjectCount = (typeof reactionSubjectCounts)[number];
export type ReactionComposition = (typeof reactionCompositions)[number];
export type ReactionAssetStatus = (typeof reactionAssetStatuses)[number];

export type ReactionSemanticBeats =
  | {
      expectation: string;
      reality: string;
      structure: "expectation_reality";
    }
  | {
      left: string;
      right: string;
      structure: "comparison";
    }
  | {
      action: string;
      realization: string;
      structure: "action_realization";
    }
  | {
      setup: string;
      escalation: string;
      structure: "setup_escalation";
    }
  | {
      caption: string;
      roles: readonly string[];
      structure: "role_contrast";
    }
  | {
      payoff: string;
      situation: string;
      structure: "situation_payoff";
    };

export type ReactionContent = {
  caption: string;
  emotion: ReactionEmotion;
  languageFormat: ReactionLanguageFormat;
  lines: readonly string[];
  semantic: ReactionSemanticBeats;
  visualContextTags: readonly string[];
  visualTreatment: ReactionVisualTreatment;
};

export const reactionTypesByEmotion: Record<
  ReactionEmotion,
  readonly ReactionClipType[]
> = {
  escalation: [
    "concern",
    "facepalm",
    "shock",
  ],
  frustration: [
    "side_eye",
    "facepalm",
    "confusion",
    "disappointment",
  ],
  irony: ["side_eye", "deadpan", "laughter", "unbothered"],
  regret: ["regret", "disappointment", "concern"],
  relief: ["relief", "unbothered", "celebration"],
  satisfaction: ["celebration", "unbothered", "focused"],
  surprise: ["shock", "laughter", "focused"],
};

export function isReactionMemeStructure(
  value: string,
): value is ReactionMemeStructure {
  return reactionMemeStructures.includes(value as ReactionMemeStructure);
}

export function isReactionLanguageFormat(
  value: string,
): value is ReactionLanguageFormat {
  return reactionLanguageFormats.includes(value as ReactionLanguageFormat);
}

export function isReactionEmotion(value: string): value is ReactionEmotion {
  return reactionEmotions.includes(value as ReactionEmotion);
}

export function isReactionVisualTreatment(
  value: string,
): value is ReactionVisualTreatment {
  return reactionVisualTreatments.includes(value as ReactionVisualTreatment);
}

export function isReactionClipType(value: string): value is ReactionClipType {
  return reactionClipTypes.includes(value as ReactionClipType);
}
