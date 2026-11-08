import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI Product Demo Video Generator: What It Can and Cannot Show";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Generated opening. Real proof.",
    subtitle: "Where AI stops and the product demo starts.",
  });
}
