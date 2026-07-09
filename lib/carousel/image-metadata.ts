export type VisualSetting =
  | "coffee-shop"
  | "home-office"
  | "meeting"
  | "neutral-background"
  | "office"
  | "outdoor"
  | "workspace";

export type VisualStyle =
  | "casual"
  | "corporate"
  | "creator"
  | "founder"
  | "lifestyle"
  | "object-only"
  | "team";

export type ImageStyleMetadata = {
  contentTags: string[];
  hasHuman: boolean;
  sourceQuery: string;
  visualSetting: VisualSetting;
  visualStyle: VisualStyle;
};

const HUMAN_TERMS = [
  "businesswoman",
  "businessman",
  "creator",
  "entrepreneur",
  "founder",
  "freelancer",
  "girl",
  "group",
  "human",
  "man",
  "people",
  "person",
  "professional",
  "team",
  "woman",
  "worker",
];

const LAPTOP_TERMS = ["computer", "desk", "laptop", "macbook", "screen", "workspace"];

function normalizeText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function unique(values: string[]) {
  return values.filter((value, index, items) => items.indexOf(value) === index);
}

function getVisualSetting(text: string): VisualSetting {
  if (includesAny(text, ["coffee shop", "cafe", "coffeehouse"])) {
    return "coffee-shop";
  }

  if (
    includesAny(text, [
      "home office",
      "working from home",
      "work from home",
      "remote worker home",
    ])
  ) {
    return "home-office";
  }

  if (includesAny(text, ["meeting", "whiteboard", "brainstorm", "collaboration"])) {
    return "meeting";
  }

  if (includesAny(text, ["office", "boardroom", "coworking"])) {
    return "office";
  }

  if (includesAny(text, ["outdoor", "park", "street", "outside"])) {
    return "outdoor";
  }

  if (includesAny(text, ["desk", "laptop", "workspace", "remote", "startup"])) {
    return "workspace";
  }

  return "neutral-background";
}

function getVisualStyle(text: string, hasHuman: boolean): VisualStyle {
  if (includesAny(text, ["creator", "content", "filming", "influencer"])) {
    return "creator";
  }

  if (includesAny(text, ["founder", "entrepreneur", "startup"])) {
    return "founder";
  }

  if (includesAny(text, ["team", "meeting", "collaboration", "group"])) {
    return "team";
  }

  if (
    includesAny(text, [
      "casual",
      "coffee",
      "cafe",
      "freelancer",
      "home",
      "people",
      "person",
      "remote",
      "woman",
      "young",
    ])
  ) {
    return "casual";
  }

  if (includesAny(text, ["corporate", "office", "professional", "business"])) {
    return "corporate";
  }

  return hasHuman ? "lifestyle" : "object-only";
}

export function inferImageStyleMetadata(input: {
  alt?: string | null;
  query: string;
  visualKeywords?: string[];
}): ImageStyleMetadata {
  const sourceQuery = input.query.trim();
  const classificationText = normalizeText([sourceQuery, input.alt]);
  const tagText = normalizeText([
    sourceQuery,
    input.alt,
    ...(input.visualKeywords ?? []),
  ]);
  const hasHuman = includesAny(classificationText, HUMAN_TERMS);
  const visualSetting = getVisualSetting(classificationText);
  const visualStyle = getVisualStyle(classificationText, hasHuman);
  const tags = [
    hasHuman ? "human" : "",
    includesAny(tagText, LAPTOP_TERMS) ? "laptop" : "",
    visualSetting,
    visualStyle,
    includesAny(tagText, ["phone", "mobile"]) ? "phone" : "",
    includesAny(tagText, ["planning", "whiteboard", "notes"]) ? "planning" : "",
  ].filter(Boolean);

  return {
    contentTags: unique(tags),
    hasHuman,
    sourceQuery,
    visualSetting,
    visualStyle,
  };
}
