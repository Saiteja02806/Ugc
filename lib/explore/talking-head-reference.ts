import { getAIStudioVideoDurations, type AIStudioVideoModel } from "../ai-studio/generation-settings";
import { getWorkflowVideoModels } from "./workflow-generation-settings";
import { getVideoReferencePolicy } from "../ai-studio/video-reference-policy";
import type { RecreateReference } from "./recreate-types";

export type TalkingHeadReference = RecreateReference & { durationSeconds: number; generationPrompt: string };

export function talkingHeadReferenceSettings(model: AIStudioVideoModel, duration: number, availableModels = getWorkflowVideoModels().map(item => item.value)) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("This reference has no readable duration. Choose another example.");
  if (duration > 30) throw new Error("Preview only: video references support up to 30 seconds. This original is kept at its full length.");
  const supported = [model, ...availableModels].find(candidate => {
    const policy = getVideoReferencePolicy(candidate);
    return policy.allowedKinds.includes("video") && duration <= policy.maxVideoDuration;
  });
  if (!supported) throw new Error("Video references are unavailable right now. You can still upload a talking-head video or generate from your instructions.");
  const rounded = Math.round(duration);
  const seconds = getAIStudioVideoDurations(supported).reduce((best, value) => Math.abs(value - rounded) < Math.abs(best - rounded) ? value : best);
  return { model: supported, duration: seconds };
}
