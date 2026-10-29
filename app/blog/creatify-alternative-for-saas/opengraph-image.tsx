import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Creatify Alternative for Software Startups: The 2026 Comparison";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Creatify alternative for software startups.",
    subtitle: "Automated link scrapers vs dedicated SaaS video workflows.",
  });
}
