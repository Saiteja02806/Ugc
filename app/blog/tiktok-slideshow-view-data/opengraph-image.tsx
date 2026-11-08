import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "TikTok Slideshow Data: What 28 Viral Posts and 234M Views Show";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake data study",
    title: "What 234M views look like.",
    subtitle: "28 verified TikTok slideshows, measured slide by slide.",
  });
}
