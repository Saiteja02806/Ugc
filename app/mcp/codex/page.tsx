import { McpMarketingPage } from "@/components/marketing/mcp-marketing-page";
import { mcpPages, publicPageMetadata } from "@/lib/marketing/mcp-public";

const page = mcpPages.codex;

export const metadata = publicPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
});

export default function McpCodexPage() {
  return <McpMarketingPage pageKey="codex" />;
}
