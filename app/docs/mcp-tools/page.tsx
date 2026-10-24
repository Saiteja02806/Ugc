import Link from "next/link";

import { JsonLd } from "@/components/marketing/json-ld";
import { LandingHeader } from "@/components/marketing/landing-header";
import {
  MCP_TOOL_COUNT,
  mcpEndpoint,
  mcpToolCatalog,
  publicOrigin,
  publicPageMetadata,
} from "@/lib/marketing/mcp-public";

const path = "/docs/mcp-tools";
const title = "MCP tool reference";
const description = `Reference for all ${MCP_TOOL_COUNT} UGC Pilot MCP tools, grouped by job and copied from the live registry, with the OAuth scope each tool requires.`;

export const metadata = publicPageMetadata({ title, description, path });

const tools = mcpToolCatalog.groups.flatMap((group) => group.tools);

export default function McpToolReferencePage() {
  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              name: "UGC Pilot MCP Server",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              url: `${publicOrigin}${path}`,
              description,
            },
            {
              "@type": "ItemList",
              name: "UGC Pilot MCP tools",
              numberOfItems: tools.length,
              itemListElement: tools.map((tool, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: tool.name,
                description: tool.description,
              })),
            },
          ],
        }}
      />
      <LandingHeader initialHasSession={false} />
      <article className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6 sm:pt-36">
        <p className="text-sm font-semibold text-primary">Registry reference</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-foreground-strong sm:text-5xl">
          UGC Pilot MCP tool reference
        </h1>
        <p className="mt-5 text-base leading-7 text-muted">
          {MCP_TOOL_COUNT} tools from the registered server catalog at {mcpEndpoint}. Descriptions and scopes are generated from the tool registry. A write tool can still be closed by a live capability check.
        </p>
        <nav aria-label="Tool groups" className="mt-8 flex flex-wrap gap-2">
          {mcpToolCatalog.groups.map((group) => (
            <a
              key={group.id}
              href={`#${group.id}`}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground-strong hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {group.title}
              <span className="ml-2 text-muted">{group.tools.length}</span>
            </a>
          ))}
        </nav>

        <div className="mt-12 space-y-12">
          {mcpToolCatalog.groups.map((group) => (
            <section key={group.id} id={group.id} className="scroll-mt-28">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground-strong">{group.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{group.summary}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">{group.source}</p>
              <div className="mt-4 divide-y divide-border rounded-[22px] border border-border bg-card">
                {group.tools.map((tool) => (
                  <div key={tool.name} id={tool.name} className="scroll-mt-28 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-mono text-sm font-semibold text-foreground-strong">{tool.name}</h3>
                      <p className="font-mono text-[11px] text-primary">{tool.scope}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">{tool.description}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <nav aria-label="Related" className="mt-12 flex flex-wrap gap-4 text-sm font-semibold">
          <Link className="text-primary" href="/mcp">MCP server</Link>
          <Link className="text-primary" href="/mcp/claude">Claude</Link>
          <Link className="text-primary" href="/mcp/codex">Codex</Link>
          <Link className="text-primary" href="/connect-ai">Connect your AI</Link>
          <Link className="text-primary" href="/pricing">Pricing</Link>
          <Link className="text-primary" href="/guides">Guides</Link>
        </nav>
      </article>
    </main>
  );
}
