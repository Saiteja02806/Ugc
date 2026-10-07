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
  { id: "create-hook", title: "Create a talking hook video", description: "Create a talking-head hook with your creator, script and optional demo.", destination: "/explore/create-hook", status: "available", coverVideo: "/explore/covers/create-hook-v6.mp4", coverPoster: "/explore/covers/create-hook-v6.webp" },
  {
    id: "recreate", title: "Recreate the viral formats", description: "Start with a reference. Make hooks, Wall of Text and slideshows your own.",
    destination: "/explore/recreate", status: "available", coverVideo: "/explore/covers/recreate-v4.mp4", coverPoster: "/explore/covers/recreate-v4.webp",
  },
  { id: "creator-phone", title: "Creator Shows App on Phone", description: "Show your app inside a creator’s phone, then add an optional demo.", destination: "/explore/creator-phone", status: "available", coverVideo: "/explore/covers/creator-phone-v7.mp4", coverPoster: "/explore/covers/creator-phone-v7.webp" },
];

// Kept for callers of the former preview catalogue; released workflows live above.
export const LOCAL_PREVIEW_WORKFLOWS: readonly ExploreWorkflow[] = [
];

export const LOCAL_PREVIEW_WORKFLOW_ORDER: readonly string[] = ["create-hook", "recreate", "creator-phone"];

// Preview callers reuse the same supplied cover media as the released catalogue.
export const LOCAL_PREVIEW_WORKFLOW_COVERS: Readonly<Record<string, Pick<ExploreWorkflow, "coverVideo" | "coverPoster">>> = {
  recreate: { coverVideo: "/explore/covers/recreate-v4.mp4", coverPoster: "/explore/covers/recreate-v4.webp" },
  "creator-phone": { coverVideo: "/explore/covers/creator-phone-v7.mp4", coverPoster: "/explore/covers/creator-phone-v7.webp" },
};
