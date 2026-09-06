import OpenAI from "openai";

export const REACTION_GENERATION_PROMPT_VERSION = "reaction-brief-batch-v1";
export const REACTION_GENERATION_SELECTION_VERSION = "reaction-batch-match-v1";
export const MAX_REACTION_CLIP_PRESENTATIONS_PER_USER = 2;
export const MAX_REACTION_BRIEF_GENERATION_ATTEMPTS = 3;

const REACTIONS = [
  "side_eye", "facepalm", "deadpan", "confusion", "shock", "relief",
  "celebration", "laughter", "disappointment", "regret", "unbothered",
  "concern", "focused", "playful",
] as const;
const EMOTIONS = ["relief", "frustration", "surprise", "regret", "satisfaction", "irony", "escalation"] as const;
const LANGUAGE_FORMATS = ["pov", "when", "me_when", "me_after", "me_realizing", "direct_statement", "comparison"] as const;
// V1 deliberately supports only treatments the worker renders completely.
// Character labels are deferred until their own visual renderer exists.
const TREATMENTS = ["white_card", "outlined_text"] as const;
const SEMANTIC_STRUCTURES = ["situation_payoff", "expectation_reality", "comparison", "action_realization", "setup_escalation"] as const;
const EMOTION_REACTIONS: Record<(typeof EMOTIONS)[number], readonly ReactionIntent[]> = {
  escalation: ["concern", "facepalm", "shock"],
  frustration: ["side_eye", "facepalm", "confusion", "disappointment"],
  irony: ["side_eye", "deadpan", "laughter", "unbothered"],
  regret: ["regret", "disappointment", "concern"],
  relief: ["relief", "unbothered", "celebration"],
  satisfaction: ["celebration", "unbothered", "focused"],
  surprise: ["shock", "laughter", "focused"],
};

const productCopyPattern = /\b(our|we|sign\s*up|start\s+(?:your|a)\s+free|try\s+(?:it|us|this)|buy\s+now|download\s+(?:it|the))\b/iu;
const featureClaimPattern = /\b(?:ai|app|platform|tool)\s+(?:automatically|instantly|guarantees|will)\b/iu;

export type ReactionIntent = (typeof REACTIONS)[number];
export type ReactionGenerationContext = {
  audience: readonly string[];
  commonSituations: readonly string[];
  desiredOutcomes: readonly string[];
  pains: readonly string[];
  productName?: string | null;
};

export type ReactionCatalogClip = {
  composition: string | null;
  durationSeconds: number;
  foregroundAnchor: string | null;
  foregroundHeightPercent: number | null;
  hasAlpha: boolean;
  id: string;
  reactions: readonly string[];
  sourceStorageKey: string | null;
  status: string;
  subjectCount: string | null;
};

export type ReactionCatalogBackground = {
  contextTags: readonly string[];
  foregroundPlacement: string | null;
  id: string;
  sourceStorageKey: string | null;
  status: string;
};

export type ReactionPlanItem = {
  backgroundAssetId: string;
  caption: string;
  clipAssetId: string;
  content: ReactionBriefContent;
  durationSeconds: number;
  primaryReaction: ReactionIntent;
  renderPlan: Record<string, unknown>;
  slotIndex: number;
  title: string;
};

type ReactionBrief = {
  content: ReactionBriefContent;
  preferredReactions: ReactionIntent[];
  slotIndex: number;
};

type ReactionBriefContent = {
  caption: string;
  emotion: (typeof EMOTIONS)[number];
  languageFormat: (typeof LANGUAGE_FORMATS)[number];
  lines: string[];
  semantic: ReactionSemantic;
  visualContextTags: string[];
  visualTreatment: (typeof TREATMENTS)[number];
};

type ReactionSemantic =
  | { payoff: string; situation: string; structure: "situation_payoff" }
  | { expectation: string; reality: string; structure: "expectation_reality" }
  | { left: string; right: string; structure: "comparison" }
  | { action: string; realization: string; structure: "action_realization" }
  | { escalation: string; setup: string; structure: "setup_escalation" };

type ClipHistory = { lastShownAt: string | null; shownCount: number };
type Candidate = {
  background: ReactionCatalogBackground;
  brief: ReactionBrief;
  clip: ReactionCatalogClip;
  primaryReaction: ReactionIntent;
  score: number;
};

let openaiClient: OpenAI | null = null;

export async function planReactionGeneration(params: {
  backgrounds: readonly ReactionCatalogBackground[];
  clips: readonly ReactionCatalogClip[];
  context: ReactionGenerationContext;
  historyByClipId: ReadonlyMap<string, ClipHistory>;
  requestedCount: number;
  reservedClipIds?: ReadonlySet<string>;
  seed: string;
}) {
  const clips = params.clips.filter((clip) =>
    isRenderableClip(clip) &&
    !params.reservedClipIds?.has(clip.id) &&
    isWithinPresentationLimit(params.historyByClipId.get(clip.id)),
  );
  const backgrounds = params.backgrounds.filter(isRenderableBackground);
  if (!clips.length || !backgrounds.length) {
    throw new Error("Reaction generation requires active alpha clips and active backgrounds.");
  }
  if (!Number.isInteger(params.requestedCount) || params.requestedCount < 1 || params.requestedCount > 12) {
    throw new Error("Reaction generation requested count must be between 1 and 12.");
  }

  const palette = buildAvailabilityPalette({ backgrounds, clips, historyByClipId: params.historyByClipId });
  const briefs = await generateAndValidateBriefs({
    context: params.context,
    palette,
    requestedCount: params.requestedCount,
  });
  const selected = selectUniquePairs({
    backgrounds,
    briefs,
    clips,
    historyByClipId: params.historyByClipId,
    seed: params.seed,
  });

  return {
    briefPayload: {
      availability: palette,
      briefs,
      promptVersion: REACTION_GENERATION_PROMPT_VERSION,
      selectionVersion: REACTION_GENERATION_SELECTION_VERSION,
      shortfallCount: params.requestedCount - selected.length,
    },
    items: selected.map((candidate) => toPlanItem(candidate)),
    shortfallCount: params.requestedCount - selected.length,
  };
}

function isRenderableClip(clip: ReactionCatalogClip) {
  return Boolean(
    clip.status === "active" &&
      clip.hasAlpha &&
      clip.sourceStorageKey &&
      clip.foregroundAnchor &&
      clip.foregroundHeightPercent &&
      clip.reactions.some(isReactionIntent),
  );
}

function isRenderableBackground(background: ReactionCatalogBackground) {
  return Boolean(
    background.status === "active" &&
      background.sourceStorageKey &&
      background.foregroundPlacement &&
      background.contextTags.length > 0,
  );
}

function buildAvailabilityPalette(params: {
  backgrounds: readonly ReactionCatalogBackground[];
  clips: readonly ReactionCatalogClip[];
  historyByClipId: ReadonlyMap<string, ClipHistory>;
}) {
  const countByIntent = new Map<ReactionIntent, { freshClipCount: number; reusableClipCount: number }>();
  for (const clip of params.clips) {
    if (!params.backgrounds.some((background) => background.foregroundPlacement === clip.foregroundAnchor)) continue;
    const history = params.historyByClipId.get(clip.id);
    for (const reaction of clip.reactions.filter(isReactionIntent)) {
      const current = countByIntent.get(reaction) ?? { freshClipCount: 0, reusableClipCount: 0 };
      if (!history || history.shownCount === 0) current.freshClipCount += 1;
      else current.reusableClipCount += 1;
      countByIntent.set(reaction, current);
    }
  }
  const recentlyShownIntents = [...countByIntent.keys()].filter((intent) =>
    params.clips.some((clip) =>
      clip.reactions.includes(intent) && Boolean(params.historyByClipId.get(clip.id)?.shownCount),
    ),
  );
  return {
    availableReactionPalette: [...countByIntent.entries()]
      .map(([intent, counts]) => ({ intent, ...counts }))
      .sort((a, b) => b.freshClipCount - a.freshClipCount || b.reusableClipCount - a.reusableClipCount || a.intent.localeCompare(b.intent)),
    generationRule: "Prefer fresh relevant intents. If fresh clips cannot cover the request, use the least-used, longest-unseen relevant clips. Never return an asset ID or filename.",
    recentlyShownIntents,
  };
}

async function generateAndValidateBriefs(params: {
  context: ReactionGenerationContext;
  palette: ReturnType<typeof buildAvailabilityPalette>;
  requestedCount: number;
}) {
  let lastValidationError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_REACTION_BRIEF_GENERATION_ATTEMPTS; attempt += 1) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 4_000,
      messages: [
        {
          role: "system",
          content: "You create short, safe, relatable Reaction Reel captions. Return only the required JSON.",
        },
        {
          role: "user",
          content: buildBriefPrompt({
            ...params,
            retryingAfterValidationFailure: attempt > 1,
          }),
        },
      ],
      model: process.env.OPENAI_REACTION_MODEL?.trim() || "gpt-5-mini",
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reaction_brief_batch",
          schema: reactionBriefSchema(params.requestedCount),
          strict: true,
        },
      },
    });
    const text = completion.choices[0]?.message.content;

    try {
      if (!text) throw new Error("Reaction brief model returned no structured output.");
      return validateReactionBriefBatch(JSON.parse(text), params.palette, params.requestedCount);
    } catch (error) {
      lastValidationError = error instanceof Error
        ? error
        : new Error("Reaction brief model returned invalid structured output.");
    }
  }

  throw new Error(
    `Reaction brief model returned invalid structured output after ${MAX_REACTION_BRIEF_GENERATION_ATTEMPTS} attempts: ${lastValidationError?.message ?? "unknown validation error"}`,
  );
}

function buildBriefPrompt(params: {
  context: ReactionGenerationContext;
  palette: ReturnType<typeof buildAvailabilityPalette>;
  requestedCount: number;
  retryingAfterValidationFailure?: boolean;
}) {
  return [
    `Generate exactly ${params.requestedCount} varied Reaction Reel briefs, with slotIndex 0 through ${params.requestedCount - 1}.`,
    "Each caption is a recognizable human moment, never an advertisement or CTA. Keep caption and lines word-for-word equivalent. Use 5-20 total words across 1-3 lines.",
    "semantic must use the exact beat names for its structure: situation_payoff uses situation/payoff; expectation_reality uses expectation/reality; comparison uses left/right; action_realization uses action/realization; setup_escalation uses setup/escalation. Do not use role contrast or character labels in V1.",
    "preferredReactions must have 1-3 controlled intents, strongest first. Do not repeat primary intent if relevant alternatives exist.",
    params.retryingAfterValidationFailure
      ? "Your previous draft failed validation. Recheck that lines joined with single spaces exactly equal caption, each caption has 5-20 words, semantic fields match its structure, and the primary reaction fits the selected emotion."
      : "",
    "Do not output asset IDs, source filenames, URLs, or storage keys.",
    params.palette.generationRule,
    `Available intent palette: ${JSON.stringify(params.palette.availableReactionPalette)}.`,
    `Recently shown intents: ${params.palette.recentlyShownIntents.join(", ") || "none"}.`,
    `Audience: ${joinContext(params.context.audience)}.`,
    `Pains: ${joinContext(params.context.pains)}.`,
    `Common situations: ${joinContext(params.context.commonSituations)}.`,
    `Desired outcomes: ${joinContext(params.context.desiredOutcomes)}.`,
    params.context.productName ? `Business name for private context only: ${params.context.productName}.` : "",
  ].filter(Boolean).join("\n");
}

function reactionBriefSchema(requestedCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["briefs"],
    properties: {
      briefs: {
        type: "array",
        minItems: requestedCount,
        maxItems: requestedCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slotIndex", "preferredReactions", "content"],
          properties: {
            slotIndex: { type: "integer", minimum: 0 },
            preferredReactions: {
              type: "array", minItems: 1, maxItems: 3,
              items: { type: "string", enum: REACTIONS },
            },
            content: {
              type: "object", additionalProperties: false,
              required: ["caption", "lines", "emotion", "languageFormat", "visualTreatment", "visualContextTags", "semantic"],
              properties: {
                caption: { type: "string", minLength: 1, maxLength: 400 },
                lines: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 1, maxLength: 160 } },
                emotion: { type: "string", enum: EMOTIONS },
                languageFormat: { type: "string", enum: LANGUAGE_FORMATS },
                visualTreatment: { type: "string", enum: TREATMENTS },
                visualContextTags: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 1, maxLength: 50 } },
                semantic: semanticSchema(),
              },
            },
          },
        },
      },
    },
  } as const;
}

export function validateReactionBriefBatch(value: unknown, palette: ReturnType<typeof buildAvailabilityPalette>, requestedCount: number) {
  const raw = asRecord(value);
  if (!raw || !Array.isArray(raw.briefs) || raw.briefs.length !== requestedCount) {
    throw new Error("Reaction brief batch has the wrong number of briefs.");
  }
  const available = new Set(palette.availableReactionPalette.map((item) => item.intent));
  const seenSlots = new Set<number>();
  const briefs = raw.briefs.map((entry, index) => parseBrief(entry, index, available));
  for (const brief of briefs) {
    if (seenSlots.has(brief.slotIndex) || brief.slotIndex < 0 || brief.slotIndex >= requestedCount) {
      throw new Error("Reaction brief batch has invalid slot indexes.");
    }
    seenSlots.add(brief.slotIndex);
  }
  if (available.size >= requestedCount && new Set(briefs.map((brief) => brief.preferredReactions[0])).size !== briefs.length) {
    throw new Error("Reaction brief batch repeated a primary intent despite available alternatives.");
  }
  return briefs.sort((a, b) => a.slotIndex - b.slotIndex);
}

function parseBrief(value: unknown, index: number, available: ReadonlySet<ReactionIntent>): ReactionBrief {
  const raw = asRecord(value);
  const content = asRecord(raw?.content);
  if (!raw || !content || !Number.isInteger(raw.slotIndex) || !Array.isArray(raw.preferredReactions)) {
    throw new Error(`Reaction brief ${index + 1} is malformed.`);
  }
  const preferredReactions = raw.preferredReactions.filter(isReactionIntent);
  if (preferredReactions.length < 1 || preferredReactions.length > 3 || new Set(preferredReactions).size !== preferredReactions.length || !available.has(preferredReactions[0])) {
    throw new Error(`Reaction brief ${index + 1} has unavailable preferred reactions.`);
  }
  const lines = Array.isArray(content.lines) ? content.lines.map(normalizeText).filter(Boolean) : [];
  // Lines are the actual rendered copy. Derive the persisted caption from
  // them so an otherwise-safe model response cannot fail merely because it
  // introduced formatting drift between two representations of the same text.
  // All copy and safety validation still runs against this canonical value.
  const caption = lines.join(" ");
  const emotion = typeof content.emotion === "string" && EMOTIONS.includes(content.emotion as (typeof EMOTIONS)[number]) ? content.emotion as (typeof EMOTIONS)[number] : null;
  const languageFormat = typeof content.languageFormat === "string" && LANGUAGE_FORMATS.includes(content.languageFormat as (typeof LANGUAGE_FORMATS)[number]) ? content.languageFormat as (typeof LANGUAGE_FORMATS)[number] : null;
  const visualTreatment = typeof content.visualTreatment === "string" && TREATMENTS.includes(content.visualTreatment as (typeof TREATMENTS)[number]) ? content.visualTreatment as (typeof TREATMENTS)[number] : null;
  const visualContextTags = Array.isArray(content.visualContextTags) ? content.visualContextTags.map(normalizeTag).filter(Boolean) : [];
  if (!caption || !emotion || !languageFormat || !visualTreatment || lines.length < 1 || lines.length > 3 || lines.join(" ") !== caption || wordCount(caption) < 5 || wordCount(caption) > 20 || visualContextTags.length < 1 || visualContextTags.length > 3 || !EMOTION_REACTIONS[emotion].includes(preferredReactions[0]) || productCopyPattern.test(caption) || featureClaimPattern.test(caption)) {
    throw new Error(`Reaction brief ${index + 1} fails deterministic copy validation.`);
  }
  const semantic = parseSemantic(content.semantic);
  if (!semantic) {
    throw new Error(`Reaction brief ${index + 1} has invalid semantic beats.`);
  }
  return { content: { caption, emotion, languageFormat, lines, semantic, visualContextTags: [...new Set(visualContextTags)], visualTreatment }, preferredReactions, slotIndex: raw.slotIndex as number };
}

function selectUniquePairs(params: {
  backgrounds: readonly ReactionCatalogBackground[];
  briefs: readonly ReactionBrief[];
  clips: readonly ReactionCatalogClip[];
  historyByClipId: ReadonlyMap<string, ClipHistory>;
  seed: string;
}) {
  const candidatesBySlot = new Map<number, Candidate[]>();
  for (const brief of params.briefs) {
    const candidates: Candidate[] = [];
    for (const clip of params.clips) {
      const primaryReaction = brief.preferredReactions.find((intent) => clip.reactions.includes(intent));
      if (!primaryReaction) continue;
      for (const background of params.backgrounds) {
        if (background.foregroundPlacement !== clip.foregroundAnchor) continue;
        const history = params.historyByClipId.get(clip.id);
        const freshness = !history || history.shownCount === 0 ? 10_000 : 0;
        const preference = 3 - brief.preferredReactions.indexOf(primaryReaction);
        const matchingBackgroundTags = intersectionSize(background.contextTags, brief.content.visualContextTags);
        const unseenDays = daysSince(history?.lastShownAt);
        candidates.push({
          background,
          brief,
          clip,
          primaryReaction,
          score: freshness + preference * 1_000 + matchingBackgroundTags * 90 - (history?.shownCount ?? 0) * 100 + unseenDays + stableTieBreak(params.seed, clip.id, background.id) / 1_000_000,
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.clip.id.localeCompare(b.clip.id));
    candidatesBySlot.set(brief.slotIndex, candidates.slice(0, 16));
  }
  const ordered = [...params.briefs].sort((a, b) => (candidatesBySlot.get(a.slotIndex)?.length ?? 0) - (candidatesBySlot.get(b.slotIndex)?.length ?? 0));
  let best: Candidate[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  let nodes = 0;
  const visit = (index: number, selected: Candidate[], usedClips: Set<string>, score: number) => {
    if (++nodes > 50_000) return;
    if (index === ordered.length) {
      if (selected.length > best.length || (selected.length === best.length && score > bestScore)) {
        best = [...selected]; bestScore = score;
      }
      return;
    }
    for (const candidate of candidatesBySlot.get(ordered[index].slotIndex) ?? []) {
      if (usedClips.has(candidate.clip.id)) continue;
      const next = new Set(usedClips); next.add(candidate.clip.id);
      visit(index + 1, [...selected, candidate], next, score + candidate.score);
    }
    visit(index + 1, selected, usedClips, score);
  };
  visit(0, [], new Set(), 0);
  return best.sort((a, b) => a.brief.slotIndex - b.brief.slotIndex);
}

function toPlanItem(candidate: Candidate): ReactionPlanItem {
  const anchor = candidate.clip.foregroundAnchor as "bottom_center" | "bottom_left" | "bottom_right" | "center";
  const heightPercent = Number(candidate.clip.foregroundHeightPercent);
  return {
    backgroundAssetId: candidate.background.id,
    caption: candidate.brief.content.caption,
    clipAssetId: candidate.clip.id,
    content: candidate.brief.content,
    durationSeconds: Math.min(8, Math.max(4, Number(candidate.clip.durationSeconds) || 6)),
    primaryReaction: candidate.primaryReaction,
    renderPlan: {
      canvas: { width: 1080, height: 1920 },
      foreground: { anchor, heightPercent },
      text: { lines: candidate.brief.content.lines, position: { x: 0.5, y: candidate.brief.content.visualTreatment === "white_card" ? 0.12 : 0.1 }, treatment: candidate.brief.content.visualTreatment },
    },
    slotIndex: candidate.brief.slotIndex,
    title: `Reaction Reel · ${candidate.primaryReaction.replace(/_/gu, " ")}`,
  };
}

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is required for Reaction brief generation.");
  openaiClient ??= new OpenAI({ apiKey: key });
  return openaiClient;
}

function isReactionIntent(value: unknown): value is ReactionIntent { return typeof value === "string" && (REACTIONS as readonly string[]).includes(value); }
function asRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function normalizeText(value: unknown) { return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : ""; }
function normalizeTag(value: unknown) { return normalizeText(value).toLowerCase(); }
function wordCount(value: string) { return value.split(/\s+/u).filter(Boolean).length; }
function joinContext(values: readonly string[]) { const clean = values.map(normalizeText).filter(Boolean); return clean.length ? clean.join("; ") : "not supplied"; }
function intersectionSize(left: readonly string[], right: readonly string[]) { const rightSet = new Set(right.map(normalizeTag)); return left.filter((value) => rightSet.has(normalizeTag(value))).length; }
function daysSince(value: string | null | undefined) { const timestamp = value ? Date.parse(value) : Number.NaN; return Number.isFinite(timestamp) ? Math.min(365, Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))) : 0; }
function stableTieBreak(seed: string, clipId: string, backgroundId: string) { let value = 2166136261; for (const character of `${seed}:${clipId}:${backgroundId}`) { value ^= character.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
function isWithinPresentationLimit(history: ClipHistory | undefined) { return (history?.shownCount ?? 0) < MAX_REACTION_CLIP_PRESENTATIONS_PER_USER; }
function parseSemantic(value: unknown): ReactionSemantic | null {
  const raw = asRecord(value);
  const structure = typeof raw?.structure === "string" && SEMANTIC_STRUCTURES.includes(raw.structure as (typeof SEMANTIC_STRUCTURES)[number])
    ? raw.structure as (typeof SEMANTIC_STRUCTURES)[number]
    : null;
  if (!structure) return null;
  if (structure === "situation_payoff") {
    const situation = normalizeText(raw?.situation);
    const payoff = normalizeText(raw?.payoff);
    return situation && payoff ? { payoff, situation, structure } : null;
  }
  if (structure === "expectation_reality") {
    const expectation = normalizeText(raw?.expectation);
    const reality = normalizeText(raw?.reality);
    return expectation && reality ? { expectation, reality, structure } : null;
  }
  if (structure === "comparison") {
    const left = normalizeText(raw?.left);
    const right = normalizeText(raw?.right);
    return left && right ? { left, right, structure } : null;
  }
  if (structure === "action_realization") {
    const action = normalizeText(raw?.action);
    const realization = normalizeText(raw?.realization);
    return action && realization ? { action, realization, structure } : null;
  }
  const setup = normalizeText(raw?.setup);
  const escalation = normalizeText(raw?.escalation);
  return setup && escalation ? { escalation, setup, structure } : null;
}

function semanticSchema() {
  const beat = { type: "string", minLength: 1, maxLength: 160 };
  return {
    anyOf: [
      { type: "object", additionalProperties: false, required: ["structure", "situation", "payoff"], properties: { structure: { type: "string", enum: ["situation_payoff"] }, situation: beat, payoff: beat } },
      { type: "object", additionalProperties: false, required: ["structure", "expectation", "reality"], properties: { structure: { type: "string", enum: ["expectation_reality"] }, expectation: beat, reality: beat } },
      { type: "object", additionalProperties: false, required: ["structure", "left", "right"], properties: { structure: { type: "string", enum: ["comparison"] }, left: beat, right: beat } },
      { type: "object", additionalProperties: false, required: ["structure", "action", "realization"], properties: { structure: { type: "string", enum: ["action_realization"] }, action: beat, realization: beat } },
      { type: "object", additionalProperties: false, required: ["structure", "setup", "escalation"], properties: { structure: { type: "string", enum: ["setup_escalation"] }, setup: beat, escalation: beat } },
    ],
  } as const;
}
