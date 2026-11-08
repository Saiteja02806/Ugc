import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI Talking Head Video Generator for SaaS: A Practical Quality Checklist";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Talking heads that hold up.",
    subtitle: "A quality checklist before you publish.",
  });
}
