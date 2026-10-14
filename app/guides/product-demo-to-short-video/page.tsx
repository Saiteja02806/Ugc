import type { Metadata } from "next";
import { FounderGuidePage, founderGuideOpenGraphImage, getFounderGuide } from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("product-demo-to-short-video");
const title = "Turn a Product Demo into a Short Social Video";
const canonical = `/guides/${guide.slug}`;

export const metadata: Metadata = {
  title,
  description: guide.description,
  alternates: { canonical },
  openGraph: { title, description: guide.description, url: canonical, type: "article", images: [founderGuideOpenGraphImage] },
  twitter: { card: "summary_large_image", title, description: guide.description, images: [founderGuideOpenGraphImage] },
};

export default function ProductDemoGuidePage() {
  return <FounderGuidePage guide={guide} />;
}
