export type ExploreWorkflow = {
  id: string;
  title: string;
  description: string;
  destination: string | null;
  status: "available" | "coming_soon";
  coverVideo: string | null;
  coverPoster?: string | null;
};

export const EXPLORE_WORKFLOWS: readonly ExploreWorkflow[] = [
  {
    id: "talking-head-demo", title: "Talking Head + Demo", description: "Create a talking-head video and add your demo.",
    destination: "/explore/create-hook", status: "available", coverVideo: "/explore/covers/create-hook-v6.mp4", coverPoster: "/explore/covers/create-hook-v6.webp",
  },
  {
    id: "hook-video", title: "Hook video", description: "Choose a hook reference and create your own video.",
    destination: "/explore/hook-video", status: "available", coverVideo: "/explore/covers/hook-video-v2.mp4", coverPoster: "/explore/covers/hook-video-v2.webp",
  },
  { id: "wall-of-text", title: "Wall of text", description: "Create a video background and add your message.", destination: "/explore/wall-of-text", status: "available", coverVideo: "/explore/covers/wall-of-text-v3.mp4", coverPoster: "/explore/covers/wall-of-text-v3.webp" },
  { id: "slideshows", title: "Slideshows", description: "Recreate a slideshow, one image at a time.", destination: "/explore/slideshows", status: "available", coverVideo: "/explore/covers/slideshows-v2.mp4", coverPoster: "/explore/covers/slideshows-v2.webp" },
];

// Creator Shows App on Phone remains hidden, including in development review.
export const LOCAL_PREVIEW_WORKFLOWS: readonly ExploreWorkflow[] = [
];

export const LOCAL_PREVIEW_WORKFLOW_ORDER: readonly string[] = ["talking-head-demo", "hook-video", "wall-of-text", "slideshows"];

// Former cover overrides are retained as an empty compatibility export.
export const LOCAL_PREVIEW_WORKFLOW_COVERS: Readonly<Record<string, Pick<ExploreWorkflow, "coverVideo" | "coverPoster">>> = {
};
