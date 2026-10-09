import { notFound } from "next/navigation";

import { VideoFailurePreview } from "./preview";

export default function VideoFailurePreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <VideoFailurePreview />;
}
