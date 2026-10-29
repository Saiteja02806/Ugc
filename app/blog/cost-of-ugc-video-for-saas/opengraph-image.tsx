import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Cost of UGC Video for SaaS in 2026: Creators vs Agencies vs AI";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Cost of UGC video for SaaS.",
    subtitle: "Creators vs agencies vs AI software unit economics.",
  });
}
