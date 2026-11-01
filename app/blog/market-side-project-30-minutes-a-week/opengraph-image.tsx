import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "How to Market a Side Project in 30 Minutes a Week: The Indie Video Routine";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "Market a side project in 30 minutes a week.",
    subtitle: "The ultra-lean video routine for busy engineers and solo builders.",
  });
}
