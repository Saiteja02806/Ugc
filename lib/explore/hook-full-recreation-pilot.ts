import type { HookMotionPlan } from "./hook-keyframe-motion.ts";
import { getHookFullRecreationPilot } from "../../worker/src/lib/hook-full-recreation-pilot.ts";
export * from "../../worker/src/lib/hook-full-recreation-pilot.ts";

/** Reviewed from all 112 decoded Hook 100 frames. Generated time 0 maps to
 * original source time 0; the later clarity anchor never becomes video time 0. */
export function getHookFullRecreationPilotMotionPlan(referenceId: string, sourceSha256: string, selectedFrameIndex: number): HookMotionPlan | undefined {
  const pilot = getHookFullRecreationPilot(referenceId, sourceSha256);
  if (referenceId !== "explore-paired-hook-fc44f6214b6e17413600ec13" || !pilot || selectedFrameIndex !== pilot.identityClarityAnchor.index) return undefined;
  return {
    openingState: "At generated t=0.000, begin in the low-angle, slightly tilted close selfie wearing the round eyeglasses and white earbuds. Look off screen-right with the mouth slightly open while the hand on screen-right already touches the glasses at the temple.",
    beats: [
      { phase: "opening", action: "From generated t=0.000 to about t=0.900, pull the glasses forward away from the eyes with the same hand and lower them below the face while continuing to look off screen-right." },
      { phase: "middle", action: "From about generated t=0.900 to t=2.333, turn the gaze and face toward the lens, lift the brows and keep the lips slightly parted. Reach the reviewed clear-face pose at t=2.333 without pausing or resetting the action." },
      { phase: "ending", action: "From generated t=2.333 through the end at about t=3.733, look back off screen-right with a questioning open-mouth expression, keeping the glasses lowered and the earbuds in." },
    ],
    camera: "Keep one continuous low-angle handheld selfie with the same slight tilt, close crop, pale structural beams and windows. Use only the gentle natural camera movement visible in the reviewed performance; do not add a cut or new angle.",
    endingState: "End looking off screen-right with parted lips, the glasses still off the face and lowered, the white earbuds in and the black ribbed sweater and room unchanged.",
    constraints: [
      "The approved opening image is the true opening at t=0.000. Remove the glasses exactly once; do not begin from the later clear-face anchor and do not replay or reverse the removal.",
      "Maintain continuous anatomy and contact for the glasses hand, fingers, frame and earbuds. Do not place the glasses on top of the head.",
      "Keep the selected influencer's facial identity, clothing, lighting, background and camera orientation stable. Do not add another person, text, logo or scene cut.",
    ],
  };
}
