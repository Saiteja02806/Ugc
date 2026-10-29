import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI Video Generator for SaaS: Turn Product Briefs into Short Videos";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "AI video generator for SaaS.",
    subtitle: "Turn feature briefs and product demos into short video ads.",
  });
}
