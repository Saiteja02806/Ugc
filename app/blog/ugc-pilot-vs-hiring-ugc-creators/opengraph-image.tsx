import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Vidmake vs Hiring UGC Creators: Cost, Speed and Quality";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "Vidmake vs hiring creators.",
    subtitle: "Cost, speed, and quality, including where a person still wins.",
  });
}
