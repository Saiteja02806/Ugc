import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import type { HookMotionPlan } from "./hook-keyframe-motion.ts";
import { getPublicMiddleFrameMotionEntry, sourceMotionPlan } from "./hook-middle-frame-motion.ts";

// Adapted preparation directions, not evidence of a successful generated video.
// Legacy entries begin after the chosen source-frame gesture. Hook 100 is routed
// through the full-recreation pilot before this table is read.
const performances: Record<number, readonly [string, string, string]> = {
  12: ["Seated behind the laptop, holding the lowered cup with eyes widened.", "Set the cup down gently; lift the brows and open the mouth in surprise.", "Hold the surprised look with a small blink, keeping hands near the cup and laptop."],
  14: ["Seated with eyes open and both hands raised in a hesitant gesture.", "Make a small uncertain head movement and rotate the raised palms slightly outward.", "Lower the hands a little and settle into a questioning expression."],
  18: ["Seated in an airplane cabin, face visible, headphones around the neck and one arm extended.", "Smile naturally, glance toward the nearby window, then return the gaze toward the camera.", "Hold the relaxed smile with a small head tilt; keep the cabin view continuous."],
  19: ["Both hands beside the head, eyes open and mouth open in disbelief.", "Let the brows rise and move the hands slightly outward while the head makes a small startled movement.", "Hold the open-mouth reaction and let the hands settle near the head."],
  25: ["Eyes visible, sunglasses lifted off the eyes and held nearby.", "Lower the sunglasses hand naturally while the eyebrows lift and the mouth opens with disbelief.", "Hold a questioning wide-eyed look. Keep the sunglasses off the eyes."],
  29: ["Eyes widened, mouth open and the hand resting below the mouth near the chin.", "Deepen the startled reaction with a small head movement and a blink; let the hand move lightly along the chin.", "Hold the open-mouth look without raising the hand across the eyes."],
  34: ["Watery-eyed close-up with hand beside the cheek and mouth visible.", "Blink slowly and lightly dab the cheek beneath the eye while maintaining the emotional expression.", "Let the hand settle beside the cheek with a small unsteady breath-like chest movement."],
  38: ["Eyes visible, mouth open and sunglasses held below the face.", "Lower the sunglasses hand a little and lift the eyebrows, keeping the eyes directed toward the camera.", "Hold the incredulous expression with a brief blink; keep sunglasses away from the eyes."],
  46: ["Close-up with the mouth uncovered and hand lowered.", "Form a restrained tight smile, blink and make a small sideways glance.", "Return the gaze toward the camera and hold the subtle smile."],
  47: ["Clear glasses already on the nose, fingertips touching the outer corner, eyes open and mouth rounded.", "Make a small adjustment at the glasses corner, knit the brows and maintain an incredulous look.", "Keep the glasses on and hand near their corner, with a brief blink and small head movement."],
  50: ["Face turned toward the camera with finger near the lower lip and mouth open.", "Shift the gaze slightly sideways, lift the brows and make a small head turn while keeping finger contact gentle.", "Bring the gaze back near the camera and sustain the surprised expression."],
  52: ["Eyes open with both hands near the temples and an uncertain smile.", "Lift the brows, then bring the hands inward gradually toward the lower face as the expression becomes overwhelmed.", "Hold the reaction with a small blink, keeping fingers anatomically natural."],
  64: ["Seated in a café, face clearly visible and arm extended near the camera.", "Withdraw the reaching arm toward the laptop and widen the eyes with an open-mouth reaction.", "Settle into the seated pose, keeping the café and nearby table continuous."],
  71: ["Reclining close-up, hand lowered from the mouth and distressed expression visible.", "Make small brow and lip movements with a brief blink as the head shifts slightly on the pillow.", "Hold the emotional expression without introducing a new camera angle."],
  85: ["Face visible with hand resting beside the cheek and eyes open.", "Glance upward briefly, then return the gaze toward the camera while moving the hand gently along the cheek.", "Settle into a surprised questioning expression with mouth visible."],
  93: ["Seated with a broad smile and hand lowered from the lips.", "Let the smile broaden, glance toward the camera and lift the hand gradually toward the forehead.", "Rest the hand lightly at the forehead with a pleased incredulous expression."],
  94: ["Seated at the keyboard with glasses lifted away from the face in the raised hand.", "Lower the glasses hand naturally while the gaze moves slightly upward and the lips purse in disbelief.", "Hold the questioning look and keep the keyboard and desk stable."],
  96: ["Seated behind the keyboard with joined hands lowered near the chest, mouth open and gaze raised.", "Hold the surprised gaze, blink and loosen the joined fingers slightly while keeping hands near the chest.", "Maintain the reaction with subtle shoulder movement and no abrupt pose reset."],
  100: ["Low-angle close selfie facing the camera, eyes open, brows slightly knit and mouth parted. The glasses are already off and the hands are below the face.", "Hold the questioning expression, then make a small glance to one side with a subtle brow lift and natural mouth movement.", "Settle into the same incredulous look with a small blink. Keep the glasses off and the hands below the face."],
  101: ["Face visible toward the camera in a nighttime street selfie.", "Smile, glance to one side and back, then raise one hand gently toward the lower face in amused disbelief.", "Hold the smile with a small handheld camera movement, retaining the street setting."],
  104: ["Seated in the purple-lit room, holding a phone with eyes open and mouth open in surprise.", "Look from the phone toward the camera, lift the brows and raise the free hand gradually toward the mouth.", "Hold the startled reaction while keeping the phone in the same hand and position."],
};
export function getCuratedHookMotionPlan(referenceId: string, sourceSha256: string, index: number): HookMotionPlan | undefined {
  const entry = getPublicMiddleFrameMotionEntry(referenceId, sourceSha256, index);
  return entry ? sourceMotionPlan(entry) : getLegacyCuratedHookMotionPlan(referenceId, sourceSha256, index);
}

/** Frozen older generated images retain their selected-pose continuation. */
export function getLegacyCuratedHookMotionPlan(referenceId: string, sourceSha256: string, index: number): HookMotionPlan | undefined {
  const frame = getCuratedHookFrame(referenceId, sourceSha256);
  if (!frame || frame.index !== index) return undefined;
  const p = performances[frame.number];
  if (!p) return undefined;
  return { openingState: p[0] + " Begin from the actual pose in the approved image; do not snap to a different pose.",
    beats: [{ phase: "middle", action: p[1] }, { phase: "ending", action: p[2] }],
    camera: "Keep the approved image's framing, viewpoint, lighting and background. Use only small natural movement.",
    endingState: p[2], constraints: ["Maintain continuous hands, fingers and held objects. Do not repeat a gesture that has already finished at the opening."] };
}
