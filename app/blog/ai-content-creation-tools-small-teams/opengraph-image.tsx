import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI Content Creation Tools for Small Teams: What Works in 2026";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "AI content creation tools.",
    subtitle: "What actually works for small teams and founders in 2026.",
  });
}
