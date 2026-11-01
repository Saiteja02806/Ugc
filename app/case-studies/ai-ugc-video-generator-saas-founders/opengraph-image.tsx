import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC video generator for SaaS founders";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake case study",
    title: "Founder videos made with Vidmake.",
    subtitle: "Two public videos from the Teja Chundu YouTube channel.",
  });
}
