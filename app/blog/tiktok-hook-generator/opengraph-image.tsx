import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "TikTok Hook Generator: Write, Test, and Film the First Three Seconds";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Hooks you can test.",
    subtitle: "Three openings. One feature. One variable.",
  });
}
