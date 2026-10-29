import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "HeyGen Alternative for Social UGC Hooks: Social Video vs Corporate Presenters";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "HeyGen alternative for social UGC hooks.",
    subtitle: "High-retention social hooks vs formal enterprise presentations.",
  });
}
