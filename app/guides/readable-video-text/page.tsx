import type { Metadata } from "next";
import { FounderGuidePage, founderGuideOpenGraphImage, getFounderGuide } from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("readable-video-text");
const title = "Make On-Screen Video Text Readable on a Phone";
const canonical = `/guides/${guide.slug}`;

export const metadata: Metadata = {
  title,
  description: guide.description,
  alternates: { canonical },
  openGraph: { title, description: guide.description, url: canonical, type: "article", images: [founderGuideOpenGraphImage] },
  twitter: { card: "summary_large_image", title, description: guide.description, images: [founderGuideOpenGraphImage] },
};

export default function ReadableVideoTextGuidePage() {
  return <FounderGuidePage guide={guide} />;
}
