import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Arcads Alternative for SaaS: Why Software Founders Need a Dedicated Video Studio";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "Arcads alternative for SaaS.",
    subtitle: "Physical e-commerce ads vs dedicated software video workflows.",
  });
}
