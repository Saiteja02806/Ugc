import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC video MCP server for Claude";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Claude connector",
    title: "UGC video MCP server for Claude.",
    subtitle: "Add the custom connector, approve OAuth, and create from the conversation.",
  });
}
