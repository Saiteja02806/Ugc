import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Product Hunt Launch Day: The Short-Form Video Pre-Launch Playbook";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "Product Hunt launch video strategy.",
    subtitle: "Build pre-launch waitlists and drive launch day momentum with short-form video.",
  });
}
