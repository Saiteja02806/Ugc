import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "SaaS Product Demo Video Generator: Hook to Software UI Cutaway";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "SaaS product demo video generator.",
    subtitle: "Turn screen recordings and creator hooks into high-converting videos.",
  });
}
