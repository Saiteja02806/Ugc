import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Revid Alternative for SaaS: Which Video Workflow Fits Your Product?";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake comparison",
    title: "Revid vs Vidmake.",
    subtitle: "Two video workflows, compared on public facts.",
  });
}
