import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Vidmake MCP tool reference";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Tool reference",
    title: "105 MCP tools, grouped by job.",
    subtitle: "Names, descriptions, and OAuth scopes from the Vidmake registry.",
  });
}
