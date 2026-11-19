import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Ads Without Creators: What Works, What Backfires";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "UGC without hiring creators.",
    subtitle: "Three routes, and the trust rules that keep them honest.",
  });
}
