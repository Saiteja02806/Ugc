import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "TikTok Slideshow Maker: Build a Carousel People Swipe Through";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Slideshows people finish.",
    subtitle: "Slide count, structure and a review step.",
  });
}
