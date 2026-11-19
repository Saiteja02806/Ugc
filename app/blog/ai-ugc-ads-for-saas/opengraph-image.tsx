import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC Ads for SaaS: A Practical Testing Plan";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Test the angle, not the avatar.",
    subtitle: "A four-variant plan for SaaS UGC ads.",
  });
}
