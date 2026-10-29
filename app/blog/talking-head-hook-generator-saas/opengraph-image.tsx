import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Talking Head Hook Generator for SaaS: Stop the Scroll in 3 Seconds";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Talking head hook generator for SaaS.",
    subtitle: "Stop the scroll on TikTok and Reels in under three seconds.",
  });
}
