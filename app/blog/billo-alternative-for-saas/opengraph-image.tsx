import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Billo Alternative for SaaS: Human Creator Marketplaces vs AI Video Studios";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Billo alternative for SaaS.",
    subtitle: "Creator marketplaces vs automated AI video generation for software.",
  });
}
