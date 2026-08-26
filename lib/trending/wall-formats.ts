import { WALL_TEXT_FREEFORM_PATTERN } from "./wall-text-types.ts";
import type {
  LegacyWallTextFormatId,
  WallTextFormatId,
  WallTextPattern,
} from "./wall-text-types";

export const WALL_TEXT_FORMAT_REGISTRY_VERSION =
  "wall-text-format-registry-v2-30-formats" as const;

export type WallTextFormat = {
  eligibility?: {
    requiresAuthorityEvidence?: boolean;
    requiresFirstPersonEvidence?: boolean;
  };
  example: string;
  preferredWordRange: readonly [minimum: number, maximum: number];
  howToWrite: string;
  id: WallTextFormatId;
  mechanism: string;
  name: string;
  requiredInformation: readonly string[];
  rotationOrder: number;
  structure: readonly string[];
  whenToUse: string;
};

// Every v7 format returns one continuous message. The examples demonstrate
// meaning only; the layout engine, never the model, creates the final 4-7 lines.
export const WALL_TEXT_FORMATS: readonly WallTextFormat[] = [
  format(1, "hidden_alternative", "Hidden Alternative Discovery", "Social proof, curiosity and alternative discovery.", "When the business genuinely replaces or improves an existing tool, workflow, habit or workaround.", ["audience", "current solution or behavior", "supported alternative or capability"], ["recognizable audience", "different solution", "old solution", "surprise"], "Reveal that the audience uses a different supported solution. Vary the opening and normally hide the product name.", "People in this niche stopped rebuilding the same process once they found a simpler way to handle it.", [8, 26]),
  format(2, "manual_automatic", "Manual to Automatic Surprise", "Surprise that a frustrating manual task can happen automatically.", "When the Business Profile proves that the manual task is genuinely automated.", ["manual task", "supported automated capability"], ["manual frustration", "automation reveal", "disbelief"], "Contrast the real manual task with the supported automation. Never invent automation.", "The part people still do by hand can now happen automatically without adding another complicated step.", [8, 22]),
  format(3, "secret_advantage", "Secret Advantage", "Demystification of an impressive behavior by revealing a hidden system.", "When a supported process or capability explains how the audience handles a difficult behavior.", ["audience", "hard behavior", "assumed reason", "real advantage"], ["incorrect assumption", "impressive behavior", "reversal", "real advantage"], "Replace the talent or discipline assumption with one supported system-level advantage.", "It looked like perfect discipline, but the real advantage was having a system that made the next step obvious.", [13, 28]),
  format(4, "outcome_mystery", "Outcome Mystery", "Show a desired outcome while keeping the mechanism curious.", "When the Business Profile supports a concrete desired outcome and capability.", ["audience", "desired outcome", "supported capability"], ["mystery cue", "audience", "desired outcome"], "Center the message on a supported outcome and imply a mechanism without making an unsupported promise.", "This is how busy people keep the important work visible without carrying the entire plan in their head.", [8, 24]),
  format(5, "authority_reaction", "Authority Reaction", "Legitimate authority context lends credibility to an old-method realization.", "Only when a real authority relationship is present in supplied facts.", ["verified authority", "real reaction", "old behavior"], ["realization", "authority", "reaction", "old method"], "Use only a verified authority and reaction. Never invent an endorsement or relationship.", "Now the repeated question from the coach makes sense: the old routine never showed what was actually changing.", [14, 30], { requiresAuthorityEvidence: true }),
  format(6, "personal_obsession", "Personal Obsession", "A soft discovery framed as genuine interest rather than advertising.", "Only when first-person product use or discovery is supported.", ["verified personal discovery", "persona", "specific problem"], ["personal discovery", "identity", "specific relevance"], "Keep it natural and specific. Do not fabricate personal use or enthusiasm.", "The latest useful discovery for someone who forgets the small details is a way to capture them while they are fresh.", [10, 26], { requiresFirstPersonEvidence: true }),
  format(7, "numbered_curiosity", "Numbered Curiosity", "A finite promise creates an information gap.", "When the business context supports several related signs, mistakes or habits.", ["honest number", "item type", "supported effect"], ["number", "specific item type", "interesting consequence"], "Write one flowing explanatory message using the honest number. Do not return a title or list items.", "Three quiet habits can make a simple workday feel overloaded before the first important task even starts.", [10, 30]),
  format(8, "rule_checklist", "Rule or Checklist", "Scannable guidance compressed into one coherent message.", "When several supported rules belong to one outcome.", ["outcome", "supported rules"], ["outcome", "compact rule sequence", "payoff"], "Express the rules as one connected sentence or message. Never return a heading, bullets or separate list items.", "A calmer workday starts by capturing new tasks, choosing one priority and leaving real space for changes.", [16, 38]),
  format(9, "hidden_cause", "Hidden Cause Explainer", "Reject the obvious explanation and reveal a deeper supported cause.", "When the Business Profile supports the deeper cause without invented psychology, science or health claims.", ["observed problem", "obvious explanation", "supported deeper cause"], ["problem", "reject obvious cause", "deeper cause", "implication"], "Explain one grounded deeper cause in plain language and keep it compact enough for one Wall message.", "The growing list may not mean you lack discipline; it may mean the plan contains more work than the day can hold.", [18, 42]),
  format(10, "contrarian_opinion", "Contrarian Opinion", "Pattern interruption through a grounded disagreement.", "When a common belief can be corrected using supplied facts.", ["common belief", "supported correction", "reason"], ["challenge belief", "contrarian claim", "reason"], "Challenge one belief without manufacturing controversy or certainty.", "More tasks do not always create more progress; choosing fewer priorities can make the important work easier to finish.", [12, 34]),
  format(11, "niche_pov", "Niche POV", "Specific identity recognition.", "When the audience and situation can be made highly specific.", ["specific audience", "specific niche event"], ["POV cue", "hyper-specific event", "recognition"], "Describe one precise niche situation. Avoid generic identity language.", "A meeting lands in the middle of the afternoon and the carefully planned workday has to reorganize itself again.", [10, 30]),
  format(12, "community_question", "Community Question", "A genuine niche disagreement invites responses.", "When one useful question can be answered without manufactured controversy.", ["audience", "brief context", "one question"], ["audience cue", "context", "one question"], "End with exactly one clear question and stop. Do not add a CTA.", "When a new task changes the whole day, do you rebuild the plan or protect the original priority?", [10, 30]),
  format(13, "transformation_timeframe", "Transformation Timeframe", "A defined period makes a supported starting plan concrete.", "When the timeframe is framing, not a guaranteed result.", ["desired result", "timeframe", "supported starting action"], ["desired result", "timeframe", "what to do first"], "Frame what someone would start doing in the period. Never guarantee the result.", "If the goal were to make spending clearer over the next month, the first step would be capturing the small purchases consistently.", [14, 32]),
  format(14, "method_framework", "Method or Framework", "Connect a desired outcome to one real method.", "When the method or framework genuinely exists in supplied facts.", ["desired outcome", "supported method"], ["outcome", "method", "brief explanation"], "Name one supported method and explain its practical role without calling it a secret formula.", "A realistic weekly plan starts with capacity first, then places the important work inside the time that actually exists.", [12, 30]),
  format(15, "emotional_reframe", "Emotional Reframe", "Replace a familiar interpretation with a more useful one.", "When the new interpretation is grounded and non-clinical.", ["common interpretation", "reversal", "new interpretation"], ["familiar belief", "reversal", "useful meaning"], "Resolve one misunderstanding clearly without therapy, medical or guaranteed language.", "One difficult day does not erase the routine; treating it as proof of failure is what makes returning harder.", [10, 30]),
  format(16, "personal_manifesto", "Personal Manifesto", "A compact personal belief develops into a reflective conclusion.", "Only when a first-person belief or experience is supported.", ["verified realization", "evidence", "interpretation", "conclusion"], ["realization", "reason", "deeper meaning", "conclusion"], "Build a real thought progression but compress it into one short Wall message. Never fabricate personal experience.", "I stopped measuring a productive day by everything finished and started measuring it by whether the most important work received real attention.", [20, 44], { requiresFirstPersonEvidence: true }),
  format(17, "relatable_situation", "Relatable Situation", "Recognition through one specific everyday moment.", "When the audience has a clear, relevant situation to recognize.", ["specific situation", "reaction or consequence"], ["recognizable moment", "specific detail", "consequence"], "Show one concrete situation and its consequence. Avoid a generic 'when' opening every time.", "The plan looked realistic until one unexpected meeting moved every important task into the same crowded afternoon.", [10, 32]),
  format(18, "desire_identity_stack", "Desire or Standards Stack", "Self-identification through connected wants and standards.", "When several supported aspirations belong to one audience identity.", ["audience identity", "related desires or standards"], ["identity", "connected aspirations", "emotional payoff"], "Combine the aspirations into one flowing message. Do not return a heading or vertical list.", "The ideal workday has focused mornings, fewer unnecessary meetings, a real lunch break and nothing important following you home.", [16, 38]),
  format(19, "old_way_regret", "Old-Way Regret", "Reveal the cost of an inefficient old behavior.", "When the cost is supported and not an invented customer result.", ["old behavior", "real cost", "new realization"], ["old behavior", "cost", "realization"], "Describe a grounded cost such as time or repeated effort without fabricating personal experience.", "Rebuilding tomorrow's list every night felt productive until the repeated planning became more work than following the plan itself.", [12, 34]),
  format(20, "retrospective_lesson", "Retrospective Lesson", "Earned wisdom expressed as a practical takeaway.", "When the lesson can be framed without inventing a founder or customer story.", ["period or repeated situation", "lesson", "takeaway"], ["context", "lesson", "practical meaning"], "Use a supported observation or verified experience. Keep the takeaway concrete.", "The clearest lesson from overloaded weeks is that consistency depends more on realistic capacity than on a perfect daily plan.", [16, 38]),
  format(21, "self_audit", "Self-Audit Challenge", "Prompt private inspection of the viewer's behavior.", "When two real behaviors or constraints can be compared.", ["behavior to inspect", "comparison", "one self-question"], ["inspect first fact", "compare second fact", "private question"], "Lead the viewer through one compact comparison and end with one self-audit question, not a comment CTA.", "Look at tomorrow's calendar beside the task list: can the available hours honestly hold everything that was planned?", [14, 34]),
  format(22, "warning_alert", "Warning or Red Flag", "Threat detection and prevention without alarmism.", "When a factual warning can be supported by the Business Profile.", ["signal", "behavior", "consequence"], ["warning", "behavior", "grounded consequence"], "State one useful warning in non-alarmist language. Do not invent danger or certainty.", "A planning red flag is treating every task as urgent, because nothing remains clear enough to guide the next decision.", [12, 34]),
  format(23, "personal_stance", "Personal Stance or Boundary", "Identity expressed through a choice, rejection or standard.", "Only when the first-person stance is supported or can safely represent the brand's stated principle.", ["verified position", "boundary", "reason"], ["position", "standard", "reason"], "Use a real brand principle or verified first-person position. Never invent a founder belief.", "The standard is simple: a day is not unproductive merely because every possible task was not finished.", [10, 32], { requiresFirstPersonEvidence: true }),
  format(24, "future_snapshot", "Future Snapshot", "Place the viewer inside one coherent desired scene.", "When the scene reflects supported audience desires without guaranteeing them.", ["future scene", "specific details", "emotional payoff"], ["future cue", "scene details", "payoff"], "Describe one compact scene rather than listing unrelated wishes.", "Imagine reaching the end of the day with the important work finished, tomorrow already planned and nothing urgent following you home.", [18, 42]),
  format(25, "metaphor_reframe", "Metaphor Reframe", "One familiar analogy makes an abstract idea memorable.", "When one accurate metaphor can explain the business idea.", ["metaphor", "problem mapping", "lesson"], ["metaphor", "mapping", "lesson"], "Use exactly one metaphor and map only the relevant parts.", "A calendar works like a budget: every new yes spends time that must come from somewhere else.", [10, 32]),
  format(26, "swap_upgrade_stack", "Upgrade or Swap", "Contrast old choices with better supported alternatives.", "When several old behaviors have clear, grounded replacements.", ["old behaviors", "better alternatives"], ["old pattern", "better replacement", "combined payoff"], "Turn the swaps into one connected message. Do not return arrows, bullets, a heading or separate list items.", "Schedule it instead of remembering it, choose one priority instead of ten urgencies, and plan capacity instead of filling every hour.", [16, 40]),
  format(27, "niche_milestones", "Niche Milestones", "Belonging through several recognizable experiences in one niche.", "When the experiences are common, specific and non-fabricated.", ["niche identity", "recognizable experiences"], ["identity", "connected experiences", "recognition"], "Compress the experiences into one flowing message rather than a title and list.", "New founders eventually meet the impossible Monday list, the task moved six times and the meeting that rearranges the whole afternoon.", [18, 42]),
  format(28, "insider_truths", "Insider Truths", "Useful information people often learn later than expected.", "When several truths are supported by the supplied facts.", ["specific topic", "supported truths"], ["late-discovery cue", "connected truths", "practical meaning"], "Present the truths as one coherent explanation, not a heading or list. Avoid pretending information is secret.", "What people learn late about planning is that urgent work expands, capacity stays limited and one imperfect day changes less than it feels.", [18, 44]),
  format(29, "aspirational_archetype", "Aspirational Archetype", "Describe the type of person the audience wants to become.", "When the desired behaviors are grounded and relevant.", ["archetype", "desirable behaviors", "payoff"], ["persona", "connected behaviors", "admiration"], "Describe one coherent archetype in a compact message. Do not create a vertical stack or impossible ideal.", "The organized founder is not doing everything; they protect the important work, remember follow-ups and still leave space for changes.", [18, 42]),
  format(30, "internal_conflict", "Internal Conflict", "Expose tension between knowledge, intention and behavior.", "When both sides of the contradiction are plausible and supported.", ["known truth or intention", "contradictory behavior", "tension"], ["side A", "side B", "unresolved realization"], "Show both sides clearly without resolving them into an emotional reframe.", "The plan needs to stay simple, yet every new task still feels important enough to add to it.", [12, 34]),
] as const;

function format(
  rotationOrder: number,
  id: WallTextFormatId,
  name: string,
  mechanism: string,
  whenToUse: string,
  requiredInformation: readonly string[],
  structure: readonly string[],
  howToWrite: string,
  example: string,
  preferredWordRange: readonly [number, number],
  eligibility?: WallTextFormat["eligibility"],
): WallTextFormat {
  return {
    ...(eligibility ? { eligibility } : {}),
    example,
    preferredWordRange,
    howToWrite,
    id,
    mechanism,
    name,
    requiredInformation,
    rotationOrder,
    structure,
    whenToUse,
  };
}

const formatById = new Map(WALL_TEXT_FORMATS.map((entry) => [entry.id, entry]));

const LEGACY_WALL_TEXT_FORMAT_MAP = {
  action_benefit: "method_framework",
  analogy_reframe: "metaphor_reframe",
  aspiration_redefinition: "emotional_reframe",
  before_after: "transformation_timeframe",
  belief_reframe: "emotional_reframe",
  community_prompt: "community_question",
  contrarian_reframe: "contrarian_opinion",
  hidden_truth: "insider_truths",
  identity_mirror: "niche_pov",
  list_rules: "rule_checklist",
  mistake_correction: "hidden_cause",
  niche_insight: "insider_truths",
  pain_beneath_the_pain: "hidden_cause",
  personal_confession: "personal_stance",
  problem_change_result: "hidden_cause",
  progression_sequence: "retrospective_lesson",
  recognizable_moment: "relatable_situation",
  situation_discovery: "relatable_situation",
} as const satisfies Record<
  Exclude<
    WallTextPattern,
    WallTextFormatId | typeof WALL_TEXT_FREEFORM_PATTERN
  >,
  WallTextFormatId
>;

export function getWallTextFormat(formatId: WallTextFormatId) {
  const entry = formatById.get(formatId);
  if (!entry) throw new Error("Wall-of-text uses an unapproved format.");
  return entry;
}

export function getEligibleWallTextFormats(options: {
  hasAuthorityEvidence?: boolean;
  hasFirstPersonEvidence?: boolean;
} = {}) {
  return WALL_TEXT_FORMATS.filter(
    (entry) =>
      (!entry.eligibility?.requiresAuthorityEvidence ||
        options.hasAuthorityEvidence === true) &&
      (!entry.eligibility?.requiresFirstPersonEvidence ||
        options.hasFirstPersonEvidence === true),
  );
}

export function getEligibleWallTextFormatIds(): [
  WallTextFormatId,
  ...WallTextFormatId[],
] {
  const ids = getEligibleWallTextFormats().map((entry) => entry.id);
  if (ids.length === 0) {
    throw new Error("No Wall-of-text formats are eligible for generation.");
  }
  return ids as [WallTextFormatId, ...WallTextFormatId[]];
}

export function getBackfillWallTextFormatId(
  pattern: WallTextPattern | LegacyWallTextFormatId,
): WallTextPattern {
  return pattern in LEGACY_WALL_TEXT_FORMAT_MAP
    ? LEGACY_WALL_TEXT_FORMAT_MAP[
        pattern as keyof typeof LEGACY_WALL_TEXT_FORMAT_MAP
      ]
    : pattern;
}
