import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "How to Make UGC Ads for SaaS: Scripts, Avatars & UI Cutaways";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "How to make UGC ads for SaaS.",
    subtitle: "Scripts, avatars, and software UI cutaways that convert.",
  });
}
