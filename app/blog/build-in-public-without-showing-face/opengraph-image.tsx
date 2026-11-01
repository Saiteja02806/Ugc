import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Building in Public on Short-Form Video Without Showing Your Face";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "Building in public without showing face.",
    subtitle: "Scale short-form video marketing anonymously using AI creator avatars.",
  });
}
