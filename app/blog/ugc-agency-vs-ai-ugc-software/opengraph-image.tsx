import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Agency vs AI UGC Software for SaaS: The 2026 ROI Comparison";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "UGC agency vs AI UGC software for SaaS.",
    subtitle: "Retainers and production lag vs automated generative video software.",
  });
}
