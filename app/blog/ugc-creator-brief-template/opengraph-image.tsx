import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Creator Brief Template: The 8 Fields That Prevent a Bad Video";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "The eight-field UGC brief.",
    subtitle: "A copyable template for a video that is actually usable.",
  });
}
