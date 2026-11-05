/** Reviewed original stills only; never infer a later pose or apply to changed bytes. */
import type { StartingFrameReferenceOptions } from "./starting-frame-reference-options.ts";

export function reviewedStartingFrameScene(
  referenceId?: string,
  sourceSha256?: string,
  options?: StartingFrameReferenceOptions,
) {
  if (referenceId !== "explore-paired-hook-17133540b2315e0a3a05bfbd" ||
    sourceSha256 !== "fef0dfdcf3482917368e74bea434b0918144662f5924ccc6b05c4eff86beb9fd") return "";
  if (options?.background === "photo") {
    return "REVIEWED IMAGE1 OPENING — The person is toward screen-right in a tilted close selfie, looking toward screen-left with a widely open mouth. The raised hand is on screen-left with fingertips pointing up, separated from the mouth; do not move it to screen-right or place the fingertips on the lips. Use Image2's background environment from this exact tilted selfie camera angle while keeping the selected appearance roles.";
  }
  return "REVIEWED IMAGE1 OPENING — The person is toward screen-right in a tilted close selfie, looking toward screen-left with a widely open mouth. The raised hand is on screen-left with fingertips pointing up, separated from the mouth; do not move it to screen-right or place the fingertips on the lips. Retain the visible room furniture at lower screen-left and the circular ceiling fixture near the top, with the source's muted room light. These describe the original still, not later action. Explicit selected background/outfit/hairstyle changes take precedence only for their named appearance role; they do not change camera, gaze or hand placement.";
}
