// Navigation for the local design review. Model choices stay unchanged.
export function parseWorkflowDuration(value?: string | string[]) {
  const duration = typeof value === "string" ? Number(value) : 5;
  return Number.isInteger(duration) && duration >= 4 && duration <= 10 ? duration : 5;
}

export const EXPLORE_QUICK_STARTS = [
  { id: "studio", title: "AI Studio", description: "Create images and videos", target: "AI Studio", destination: "/ai-studio" },
  { id: "video", title: "Video generation", description: "Create a video from a prompt", target: "AI Studio Videos", destination: "/ai-studio?mode=videos" },
  { id: "image", title: "Image generation", description: "Create an image from a prompt", target: "AI Studio Images", destination: "/ai-studio?mode=images" },
  { id: "audio", title: "Audio generation", description: "Generate speech and explore voices", target: "Audio generation", destination: "/audio-generation" },
] as const;

export function getQuickStartPreviewHref(shortcut: (typeof EXPLORE_QUICK_STARTS)[number]) {
  const [pathname, search = ""] = shortcut.destination.split("?");
  const query = new URLSearchParams(search);
  query.set("preview", "1");
  return `${pathname}?${query.toString()}`;
}
