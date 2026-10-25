import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Hooks That Stop the Scroll: 20 Real Examples by Type";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "UGC hooks that stop the scroll.",
    subtitle: "Twenty real examples by type, ready to turn into a video.",
  });
}
