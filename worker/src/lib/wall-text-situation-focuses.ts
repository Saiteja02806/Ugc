/**
 * A small, deterministic coverage map for one new 200-item Wall plan.
 *
 * These are deliberately not audience facts, situation cards from earlier
 * plans, or output templates. A focus is a different question for the
 * planner to explore while it is writing one parent brief. It prevents each
 * compact ten-item request from returning to the most obvious scene for the
 * business description, without sending prior plan ideas back to the model.
 */
export const WALL_TEXT_BRIEF_SITUATION_FOCUSES = [
  { key: "first_signal", direction: "the first small sign that a routine needs attention" },
  { key: "earlier_preparation", direction: "what can happen before the familiar pressure point arrives" },
  { key: "small_commitment", direction: "the small choice that has to happen before the larger task can begin" },
  { key: "time_window", direction: "how a limited window changes an ordinary decision" },
  { key: "limited_attention", direction: "what the reader notices when attention or energy is already stretched" },
  { key: "plausible_options", direction: "weighing more than one realistic option" },
  { key: "seeking_clarity", direction: "looking for enough clarity to take the next step" },
  { key: "resources_to_action", direction: "having what is needed but not yet seeing a workable next action" },
  { key: "familiar_default", direction: "returning to a familiar default because changing course feels harder" },
  { key: "hesitation_to_change", direction: "the hesitation behind trying a different approach" },
  { key: "interrupted_routine", direction: "returning to a routine after something else has interrupted it" },
  { key: "changed_conditions", direction: "adapting when real conditions no longer match the intended plan" },
  { key: "competing_priority", direction: "an ordinary task competing with another genuine priority" },
  { key: "practical_adjustment", direction: "making a modest adjustment instead of abandoning the whole effort" },
  { key: "simpler_path", direction: "choosing a simpler workable path over an ideal but burdensome one" },
  { key: "planning_resistance", direction: "when the preparation itself starts to feel like extra work" },
  { key: "cost_of_waiting", direction: "the small cost of putting an ordinary choice off" },
  { key: "second_guessing", direction: "the moment an apparently simple choice turns into unnecessary second-guessing" },
  { key: "afterward_reflection", direction: "what the reader notices after a routine choice has already played out" },
  { key: "relief_from_clarity", direction: "the grounded relief of having a clear enough next step, without promising an outcome" },
  { key: "private_emotional_cost", direction: "the quiet emotional cost behind a recurring everyday situation" },
  { key: "confidence_gap", direction: "the gap between wanting to feel prepared and the reality of the moment" },
  { key: "good_enough", direction: "deciding what is good enough when an ideal answer is not realistic" },
  { key: "common_question", direction: "the recurring question a reader asks when they do not know how to proceed" },
  { key: "small_move", direction: "one modest, factual move that reduces immediate friction" },
  { key: "false_shortcut", direction: "a shortcut or assumption that seems helpful but adds pressure" },
  { key: "realistic_tradeoff", direction: "the trade-off between what is available now and what would be ideal" },
  { key: "preserving_capacity", direction: "protecting limited time, energy, or attention for what matters next" },
  { key: "repeat_pattern", direction: "a repeated pattern that becomes visible only over time" },
  { key: "repeatable_process", direction: "why a simple repeatable process can feel more usable than a perfect one" },
  { key: "small_structure", direction: "using a small amount of structure without turning life into a rigid system" },
  { key: "plan_reality_gap", direction: "the ordinary gap between an intended plan and real life" },
  { key: "options_not_answers", direction: "when having many options does not yet feel like having an answer" },
  { key: "learning_from_pattern", direction: "noticing what a familiar pattern reveals about the real constraint" },
  { key: "intentional_default", direction: "making an ordinary default a more intentional choice" },
  { key: "decision_before_action", direction: "separating the decision that creates friction from the action that follows" },
  { key: "clearing_confusion", direction: "turning a scattered moment into one clearer next step" },
  { key: "late_start", direction: "what changes when a routine starts later than intended" },
  { key: "ordinary_progress", direction: "recognising a small realistic improvement without making a result claim" },
  { key: "routine_reflection", direction: "a reflective observation about how an ordinary routine fits into real life" },
] as const;

export function getWallTextBriefSituationFocuses(
  briefIndexStart: number,
  briefCount: number,
) {
  if (!Number.isInteger(briefIndexStart) || briefIndexStart < 1) {
    throw new Error("Wall-of-Text situation-focus start index must be positive.");
  }
  if (!Number.isInteger(briefCount) || briefCount < 1) {
    throw new Error("Wall-of-Text situation-focus count must be positive.");
  }

  return Array.from({ length: briefCount }, (_, briefSlotIndex) => {
    const globalBriefIndex = briefIndexStart + briefSlotIndex;
    const focus = WALL_TEXT_BRIEF_SITUATION_FOCUSES[
      (globalBriefIndex - 1) % WALL_TEXT_BRIEF_SITUATION_FOCUSES.length
    ]!;
    return { briefSlotIndex, ...focus };
  });
}
