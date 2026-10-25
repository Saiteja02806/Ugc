import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Video Maker: How to Choose One (A 10-Point Checklist)";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "How to choose a UGC video maker.",
    subtitle: "Ten checks for quality, editing, voice, price, and limits.",
  });
}
