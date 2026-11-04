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
    destination: "/explore/create-hook", status: "available", coverVideo: "/explore/covers/talking-head-demo-promo-a4aa6e943cf2.mp4", coverPoster: "/explore/covers/talking-head-demo-promo-opening-7c934e951780.webp",
  },
  {
    id: "hook-video", title: "Hook video", description: "Choose a hook reference and create your own video.",
    destination: "/explore/hook-video", status: "available", coverVideo: "/explore/covers/hook-video-promo-31c869823edc.mp4", coverPoster: "/explore/covers/hook-video-promo-opening-5532968569bd.webp",
  },
  { id: "wall-of-text", title: "Text on screen", description: "Create a video background and add your message.", destination: "/explore/wall-of-text", status: "available", coverVideo: "/explore/covers/wall-of-text-promo-e3d92b47d085.mp4", coverPoster: "/explore/covers/wall-of-text-promo-opening-dd074765077d.webp" },
  { id: "slideshows", title: "Slideshows", description: "Recreate a slideshow, one image at a time.", destination: "/explore/slideshows", status: "available", coverVideo: "/explore/covers/slideshow-promo-f0669968ed21.mp4", coverPoster: "/explore/covers/slideshow-promo-opening-200b809f68f2.webp" },
];

// Creator Shows App on Phone remains hidden, including in development review.
export const LOCAL_PREVIEW_WORKFLOWS: readonly ExploreWorkflow[] = [
];

export const LOCAL_PREVIEW_WORKFLOW_ORDER: readonly string[] = ["talking-head-demo", "hook-video", "wall-of-text", "slideshows"];

// Former cover overrides are retained as an empty compatibility export.
export const LOCAL_PREVIEW_WORKFLOW_COVERS: Readonly<Record<string, Pick<ExploreWorkflow, "coverVideo" | "coverPoster">>> = {
};
