import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Synthesia vs AI UGC for SaaS: Corporate Training vs Growth Marketing";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Synthesia vs AI UGC for SaaS.",
    subtitle: "Corporate training avatars vs high-retention growth marketing videos.",
  });
}
