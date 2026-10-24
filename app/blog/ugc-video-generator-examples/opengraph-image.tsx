import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC video generator examples from real brand videos";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot examples",
    title: "Real UGC video generator examples.",
    subtitle: "YouTube, Instagram reels, and Clara TikTok videos.",
  });
}
