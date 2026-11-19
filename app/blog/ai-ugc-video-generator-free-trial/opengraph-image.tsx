import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC Video Generator: What to Test Before You Pay";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "Test a generator properly before you pay.",
    subtitle: "A five-part checklist before you pay for any AI UGC video generator.",
  });
}
