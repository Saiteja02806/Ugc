import { notFound } from "next/navigation";
import { TrendingFeedPreview } from "./preview";

export default function TrendingFeedPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TrendingFeedPreview />;
}
