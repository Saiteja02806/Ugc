import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "How to create UGC videos with an AI video creator";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot guide",
    title: "Create a UGC video with AI.",
    subtitle: "Brief, generate, review, and download the file you approve.",
  });
}
