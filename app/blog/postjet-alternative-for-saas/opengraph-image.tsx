import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Postjet Alternative for SaaS: Autopilot Posts vs a Review-First Studio";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake comparison",
    title: "Postjet vs Vidmake.",
    subtitle: "Swipe-approved batches or one reviewed asset.",
  });
}
