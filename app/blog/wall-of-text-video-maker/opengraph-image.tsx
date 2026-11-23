import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Wall-of-Text Video Maker: Text on Screen That People Can Finish";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Text people can finish.",
    subtitle: "One situation. Editable type. A quiet background.",
  });
}
