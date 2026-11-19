import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGCPoster Alternative for SaaS: Automation vs a Product Studio";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake comparison",
    title: "UGCPoster vs Vidmake.",
    subtitle: "Do you have the clips, or do you need to make them?",
  });
}
