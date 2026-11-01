import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "From $0 to $1k MRR on TikTok: The Solo SaaS Founder Acquisition Blueprint";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "From $0 to $1k MRR on TikTok.",
    subtitle: "The solo SaaS founder playbook for acquiring your first 100 users.",
  });
}
