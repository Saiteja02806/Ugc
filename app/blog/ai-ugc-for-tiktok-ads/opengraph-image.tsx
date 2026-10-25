import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC for TikTok Ads: A Practical Guide for Small Teams";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "AI UGC for TikTok ads.",
    subtitle: "Briefs, hooks, captions, and a way to test variants.",
  });
}
