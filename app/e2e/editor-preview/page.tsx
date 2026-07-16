import { notFound } from "next/navigation";

import { FocusedVideoEditor } from "@/components/edit/focused-video-editor";
import type { EditableVideo } from "@/lib/edit/video-library";

const previewVideo: EditableVideo = {
  createdAt: new Date(0).toISOString(),
  draft: {
    textOverlays: [
      {
        id: "preview-top",
        position: "top",
        style: "bubble",
        text: "Your hook lands here",
      },
      {
        id: "preview-middle",
        position: "middle",
        style: "clean",
        text: "After seeing this onboarding, i got to know how much time i wasted",
      },
    ],
    trimEndSeconds: 5,
    trimStartSeconds: 0.4,
    updatedAt: new Date(0).toISOString(),
  },
  durationSeconds: 5,
  id: "editor-visual-preview",
  projectId: "editor-preview",
  ratio: "9:16",
  renderedVideoUrl: null,
  source: "demo",
  status: "draft",
  thumbnailUrl: null,
  title: "Editor visual preview",
  videoUrl:
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
};

export default function EditorVisualPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background p-4 text-foreground lg:h-dvh lg:overflow-hidden">
      <FocusedVideoEditor video={previewVideo} />
    </main>
  );
}
