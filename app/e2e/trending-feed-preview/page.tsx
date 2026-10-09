import { notFound } from "next/navigation";
import { TrendingFeedPreview } from "./preview";
import { AppShell } from "@/components/layout/app-shell";

export default function TrendingFeedPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AppShell activeKey="trending"><TrendingFeedPreview /></AppShell>;
}
