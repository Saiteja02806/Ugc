import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Ad Script Templates: 8 Fill-in-the-Blank Formats That Work";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "UGC ad script templates.",
    subtitle: "Eight fill-in-the-blank formats you can turn into a video.",
  });
}
