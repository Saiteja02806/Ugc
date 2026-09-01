export const CONTENT_PLAN_CONCEPT_LANES = [
  {
    key: "everyday_friction",
    direction: "An ordinary moment where the audience notices unnecessary effort, delay, or confusion.",
  },
  {
    key: "specific_audience_pressure",
    direction: "A pressure felt by one supported audience segment, without treating the audience as everyone.",
  },
  {
    key: "false_assumption",
    direction: "A common assumption, shortcut, or expectation that creates the wrong kind of pressure.",
  },
  {
    key: "decision_moment",
    direction: "A recognisable decision point, trade-off, or moment of hesitation.",
  },
  {
    key: "emotional_cost",
    direction: "The private emotional cost of a recurring situation, grounded in a concrete human moment.",
  },
  {
    key: "routine_pattern",
    direction: "A small repeated routine, ritual, or behaviour that reveals a broader tension.",
  },
  {
    key: "perspective_shift",
    direction: "A supported reframe that changes how the audience sees a familiar situation without making a promise.",
  },
  {
    key: "small_practical_move",
    direction: "A modest, factual next step or choice that the business can credibly connect to.",
  },
  {
    key: "objection_or_risk",
    direction: "A realistic concern, objection, or fear behind delayed action.",
  },
  {
    key: "identity_and_aspiration",
    direction: "The identity, confidence, or aspiration at stake in an ordinary situation, without aspirational claims.",
  },
] as const;

export type ContentPlanConceptLane = (typeof CONTENT_PLAN_CONCEPT_LANES)[number];

export function getContentPlanItemConceptLanes(params: {
  briefCount: number;
  briefIndexStart: number;
}) {
  if (!Number.isInteger(params.briefIndexStart) || params.briefIndexStart < 1) {
    throw new Error("Content-plan concept-lane start index must be positive.");
  }
  if (!Number.isInteger(params.briefCount) || params.briefCount < 1) {
    throw new Error("Content-plan concept-lane count must be positive.");
  }

  return Array.from({ length: params.briefCount * 5 }, (_, sequence) => {
    const briefSlotIndex = Math.floor(sequence / 5);
    const itemSlotIndex = sequence % 5;
    const lane = CONTENT_PLAN_CONCEPT_LANES[
      ((params.briefIndexStart - 1) * 5 + sequence) % CONTENT_PLAN_CONCEPT_LANES.length
    ]!;

    return { briefSlotIndex, itemSlotIndex, ...lane };
  });
}
