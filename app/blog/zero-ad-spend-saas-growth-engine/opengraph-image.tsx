import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "The $0 Ad Spend SaaS Growth Engine: Reels, Shorts & TikTok for Indie Hackers";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "The $0 ad spend SaaS growth engine.",
    subtitle: "Scale bootstrapped software to $10k MRR with organic short-form video.",
  });
}
