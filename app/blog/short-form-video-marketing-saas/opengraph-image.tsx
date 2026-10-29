import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Short-Form Video Marketing for SaaS: TikTok, Reels & Shorts Playbook";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Short-form video marketing for SaaS.",
    subtitle: "The 2026 playbook for TikTok, Reels, and YouTube Shorts.",
  });
}
