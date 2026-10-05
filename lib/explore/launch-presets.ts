// Navigation for the local design review. Model choices stay unchanged.
export function parseWorkflowDuration(value?: string | string[]) {
  const duration = typeof value === "string" ? Number(value) : 5;
  return Number.isInteger(duration) && duration >= 4 && duration <= 10 ? duration : 5;
}

export const EXPLORE_QUICK_STARTS = [
  { id: "seedance", title: "Seedance 2.5", description: "Talking-head videos", target: "Workflow 1", destination: "/explore/create-hook" },
  { id: "omni", title: "OmniFlash 1.1", description: "Emotion videos", target: "Workflow 2", destination: "/explore/recreate" },
  { id: "trending", title: "Trending content", description: "Your next post, ready to schedule", target: "Trending", destination: "/dashboard" },
  { id: "audio", title: "Audio generation", description: "Create a voiceover for your video", target: "Audio", destination: "/audio-generation" },
  { id: "kling", title: "Kling", description: "Create a 10-second video", target: "Workflow 1", destination: "/explore/create-hook", duration: 10 },
  { id: "app-demo", title: "Create app demo", description: "Show your app with a creator", target: "Workflow 3", destination: "/explore/creator-phone" },
] as const;

export function getQuickStartPreviewHref(shortcut: (typeof EXPLORE_QUICK_STARTS)[number]) {
  const query = new URLSearchParams({ preview: "1" });
  if ("duration" in shortcut) query.set("duration", String(shortcut.duration));
  return `${shortcut.destination}?${query.toString()}`;
}
