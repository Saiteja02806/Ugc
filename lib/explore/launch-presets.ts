import { AI_STUDIO_VIDEO_MODELS, type AIStudioVideoModel } from "../ai-studio/generation-settings";

// A missing/invalid URL model keeps the workflow's normal default.
export function parseWorkflowModel(value?: string | string[]): AIStudioVideoModel | undefined {
  return typeof value === "string" && AI_STUDIO_VIDEO_MODELS.includes(value as AIStudioVideoModel)
    ? value as AIStudioVideoModel
    : undefined;
}

export function parseWorkflowDuration(value?: string | string[]) {
  const duration = typeof value === "string" ? Number(value) : 5;
  return Number.isInteger(duration) && duration >= 4 && duration <= 10 ? duration : 5;
}

export const EXPLORE_QUICK_STARTS = [
  { id: "seedance", title: "Seedance 2.5", description: "Talking-head videos", target: "Workflow 1", destination: "/explore/create-hook", model: "seedance_2_5" },
  { id: "omni", title: "OmniFlash 1.1", description: "Emotion videos", target: "Workflow 2", destination: "/explore/recreate", model: "google_omni" },
  { id: "trending", title: "Trending content", description: "Your next post, ready to schedule", target: "Trending", destination: "/dashboard" },
  { id: "audio", title: "Audio generation", description: "Create a voiceover for your video", target: "Audio", destination: "/audio-generation" },
  { id: "kling", title: "Kling", description: "Create a 10-second video", target: "Workflow 1", destination: "/explore/create-hook", model: "kling_3_0", duration: 10 },
  { id: "app-demo", title: "Create app demo", description: "Show your app with a creator", target: "Workflow 3", destination: "/explore/creator-phone" },
] as const;

export function getQuickStartHref(shortcut: (typeof EXPLORE_QUICK_STARTS)[number], localPreview = false) {
  const query = new URLSearchParams();
  if (localPreview) query.set("preview", "1");
  if ("model" in shortcut) query.set("model", shortcut.model);
  if ("duration" in shortcut) query.set("duration", String(shortcut.duration));
  const search = query.toString();
  return `${shortcut.destination}${search ? `?${search}` : ""}`;
}

export function getQuickStartPreviewHref(shortcut: (typeof EXPLORE_QUICK_STARTS)[number]) {
  return getQuickStartHref(shortcut, true);
}
