import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Free TikTok hook line generator";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return marketingOgImage({ kicker: "Free tool", title: "TikTok hook line generator", subtitle: "Three opening lines from a real app task. No signup." });
}
