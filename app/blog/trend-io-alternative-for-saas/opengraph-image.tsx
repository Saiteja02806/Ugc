import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Trend.io Alternative for Software Demos: Influencer Networks vs AI UGC";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Trend.io alternative for software demos.",
    subtitle: "Influencer agency networks vs automated AI video generation.",
  });
}
