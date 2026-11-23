import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "TikTok Slideshow Maker for Apps: A Swipe Deck That Shows the Product";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Slideshows for apps.",
    subtitle: "One feature. Real screenshots. A swipe.",
  });
}
