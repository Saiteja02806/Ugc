import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Best AI UGC Tools for SaaS Founders in 2026: An Objective Buyer's Guide";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Best AI UGC tools for SaaS founders.",
    subtitle: "The definitive 2026 buyer's guide and platform comparison.",
  });
}
