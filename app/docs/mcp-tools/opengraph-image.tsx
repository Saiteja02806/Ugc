import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Pilot MCP tool reference";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Tool reference",
    title: "79 MCP tools, grouped by job.",
    subtitle: "Names, descriptions, and OAuth scopes from the UGC Pilot registry.",
  });
}
