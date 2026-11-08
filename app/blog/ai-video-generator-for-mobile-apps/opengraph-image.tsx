import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI Video Generator for Mobile Apps: Store Previews vs Social Video";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "Store preview or social video?",
    subtitle: "Two tracks for mobile app teams, not one file.",
  });
}
