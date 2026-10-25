import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC Video Generator: How It Works and When to Use One";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "How an AI UGC video generator works.",
    subtitle: "When generated footage fits, and where you still need a real recording.",
  });
}
