import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC video generator for SaaS founders";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot case study",
    title: "Founder videos made with UGC Pilot.",
    subtitle: "Two public videos from the Teja Chundu YouTube channel.",
  });
}
