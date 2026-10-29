import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "CapCut vs Dedicated SaaS UGC Generator: Timeline Editors vs Automated Studios";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "CapCut vs dedicated SaaS UGC generator.",
    subtitle: "Manual timeline editing vs automated generative video studios.",
  });
}
