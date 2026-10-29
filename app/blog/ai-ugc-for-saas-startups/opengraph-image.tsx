import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC for SaaS Startups: The Founder's Acquisition Playbook";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "AI UGC for SaaS startups.",
    subtitle: "How lean software founders scale video marketing in 2026.",
  });
}
