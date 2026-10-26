import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CopyTextButton } from "@/components/marketing/copy-text-button";
import { JsonLd } from "@/components/marketing/json-ld";
import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { LandingHeader } from "@/components/marketing/landing-header";
import {
  claudeCodeCommand,
  codexConfigToml,
  codexLoginCommands,
  connectionCheckPrompt,
  mcpEndpoint,
  mcpIssuer,
  mcpOptionalAccountScope,
  mcpPages,
  mcpSetupScopes,
  mcpSoftwareJsonLd,
  mcpWorkflows,
  publicMcpToolCatalog,
  publicMcpToolCount,
  type McpPageKey,
} from "@/lib/marketing/mcp-public";

const relatedLinks = [
  { href: "/mcp", title: "MCP server", description: "The hosted server, OAuth flow, and tool groups." },
  { href: "/mcp/claude", title: "Claude setup", description: "Custom connector steps for Claude on the web and desktop." },
  { href: "/mcp/codex", title: "Codex setup", description: "The ~/.codex/config.toml block and login command." },
  { href: "/connect-ai", title: "Connect your AI", description: "Choose Claude, Codex, ChatGPT, or Claude Code." },
  { href: "/docs/mcp-tools", title: "Tool reference", description: `All ${publicMcpToolCount} tools, copied from the registry.` },
  { href: "/pricing", title: "Pricing", description: "Trial credits and the Starter and Growth plans." },
  { href: "/guides", title: "Founder guides", description: "Message, format, and review routines for the product." },
];

const oauthFacts = [
  ["Server URL", mcpEndpoint],
  ["Transport", "Streamable HTTP"],
  ["Issuer", mcpIssuer],
  ["Protected resource", `${mcpIssuer}/.well-known/oauth-protected-resource`],
  ["Authorization server", `${mcpIssuer}/.well-known/oauth-authorization-server`],
  ["Consent screen", `${mcpIssuer}/oauth/authorize`],
  ["Code challenge", "S256"],
  ["Client registration", "Dynamic registration and client ID metadata documents"],
];

export function McpMarketingPage({ pageKey }: { pageKey: McpPageKey }) {
  const page = mcpPages[pageKey];

  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd data={mcpSoftwareJsonLd(page.path, page.description, page.faqs)} />
      <a
        href="#mcp-content"
        className="sr-only rounded-control bg-card px-4 py-3 text-sm font-semibold text-foreground-strong focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:outline-2 focus:outline-focus"
      >
        Skip to content
      </a>
      <LandingHeader initialHasSession={false} />

      <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pt-36 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,rgba(255,107,69,0.14),transparent_76%)]" />
        <div className="mx-auto grid max-w-[1200px] items-start gap-10 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-16">
          <div className="min-w-0">
            <p className="inline-flex items-center rounded-full border border-primary/35 bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary">
              {page.eyebrow}
            </p>
            <h1
              id="mcp-content"
              tabIndex={-1}
              className="mt-6 max-w-3xl scroll-mt-28 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-foreground-strong sm:text-5xl lg:text-6xl"
            >
              {page.h1}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {page.lede}
            </p>
            <dl className="mt-8 grid grid-cols-3 gap-3">
              {[
                [String(publicMcpToolCount), "live tools"],
                ["OAuth", "PKCE sign-in"],
                ["HTTP", "hosted server"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-border bg-card px-3 py-3 sm:px-4">
                  <dt className="text-lg font-semibold tracking-tight text-foreground-strong sm:text-2xl">{value}</dt>
                  <dd className="mt-1 text-xs text-muted sm:text-sm">{label}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LandingAuthCta
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                initialHasSession={false}
              />
              <Link
                href="#setup"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-base font-semibold text-foreground-strong transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Copy the setup
              </Link>
            </div>
          </div>

          <div className="min-w-0 rounded-[28px] border border-border bg-card p-5 shadow-floating sm:p-7">
            <CopyTextButton label="Server URL" value={mcpEndpoint} wrap />
            <div className="mt-5">
              <CopyTextButton label="First prompt" value={connectionCheckPrompt} wrap />
            </div>
            <p className="text-xs leading-5 text-muted">
              Sign in on the UGC Pilot consent page. Generation uses the connected account&apos;s plan and credits.
            </p>
          </div>
        </div>
      </section>

      <section id="setup" className="scroll-mt-24 border-t border-border bg-card-muted/40 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm font-semibold text-primary">Copy-paste setup</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
            {pageKey === "claude"
              ? "Add the custom connector in Claude"
              : pageKey === "codex"
                ? "Add the server to Codex"
                : "Choose the client, then approve access"}
          </h2>
          <div className={`mt-10 grid min-w-0 gap-6 ${pageKey === "hub" ? "lg:grid-cols-2" : ""}`}>
            {(pageKey === "hub" || pageKey === "claude") && <ClaudeSetup />}
            {(pageKey === "hub" || pageKey === "codex") && <CodexSetup />}
          </div>
          {pageKey === "hub" && (
            <div className="mt-6 rounded-[24px] border border-border bg-card p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-foreground-strong">ChatGPT and Claude Code</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Where ChatGPT custom connections are enabled, open Plugins, choose plus, and add the same server URL. A public directory listing is still in review, so use a permitted private or workspace install until that listing exists. Claude Code can load the plugin bundle or run the HTTP command below, then finish OAuth with /mcp.
              </p>
              <div className="mt-5">
                <CopyTextButton label="Claude Code command" value={claudeCodeCommand} />
              </div>
              <Link href="/connect-ai" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Open the client chooser <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section id="oauth" className="scroll-mt-24 border-t border-border px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-sm font-semibold text-primary">OAuth</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
              Each person approves their own account.
            </h2>
            <ol className="mt-6 space-y-4">
              {[
                "The client requests the Streamable HTTP server and receives the protected-resource metadata.",
                "It starts an authorization-code flow with a S256 code challenge. UGC Pilot advertises dynamic client registration and client ID metadata documents.",
                "You sign in to UGC Pilot and approve the scopes on the consent screen. The token stays in the client.",
                "Later calls use that grant. account:write is a separate consent for account-default updates and is left out of the default setup.",
              ].map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0 rounded-[24px] border border-border bg-card p-5 sm:p-6">
            <dl className="divide-y divide-border">
              {oauthFacts.map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="break-all font-mono text-xs leading-5 text-foreground-strong sm:text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Default OAuth scopes">
              {mcpSetupScopes.map((scope) => (
                <li key={scope} className="rounded-full border border-border bg-card-muted px-3 py-1 font-mono text-xs text-foreground-strong">
                  {scope}
                </li>
              ))}
              <li className="rounded-full border border-dashed border-border px-3 py-1 font-mono text-xs text-muted">
                {mcpOptionalAccountScope} optional
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="tools" className="scroll-mt-24 border-t border-border bg-card-muted/40 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">Tool groups</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
                {publicMcpToolCount} tools, grouped by the job they do.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Names come from the registered server catalog. Some writes stay behind a live capability check. Open the reference for the description and scope of every tool.
              </p>
            </div>
            <Link href="/docs/mcp-tools" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Full tool reference <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicMcpToolCatalog.groups.map((group) => (
              <Link
                key={group.id}
                href={`/docs/mcp-tools#${group.id}`}
                className="flex h-full flex-col rounded-[22px] border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-foreground-strong">{group.title}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{group.tools.length}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{group.summary}</p>
                <p className="mt-4 font-mono text-[11px] leading-5 text-foreground">
                  {group.tools.slice(0, 3).map((tool) => tool.name).join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="workflows" className="scroll-mt-24 border-t border-border px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm font-semibold text-primary">Example prompts</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
            Prompts that match the released tool contracts.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            A production read on 15 October 2026 confirmed account reads, generation capability reporting, video-finishing capabilities, and edit-export capabilities. Ask the agent to read those capabilities before a paid generation.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {mcpWorkflows.map((workflow) => (
              <article key={workflow.title} className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground-strong">{workflow.title}</h3>
                <p className="mt-3 rounded-2xl bg-primary/10 p-4 text-sm leading-6 text-foreground">“{workflow.prompt}”</p>
                <p className="mt-3 font-mono text-[11px] leading-5 text-muted">{workflow.tools.join(" · ")}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 border-t border-border bg-card-muted/40 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground-strong">Questions</h2>
          <div className="mt-6 divide-y divide-border rounded-[24px] border border-border bg-card">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="group px-5 py-4 sm:px-6" open>
                <summary className="cursor-pointer list-none text-base font-semibold text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                  {faq.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-2xl font-semibold text-foreground-strong">Keep going</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedLinks.filter((link) => link.href !== page.path).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[22px] border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <p className="font-semibold text-foreground-strong">{link.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function ClaudeSetup() {
  return (
    <article className="min-w-0 rounded-[24px] border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-foreground-strong">Claude</h3>
        <Link href="/mcp/claude" className="text-sm font-semibold text-primary">Claude page</Link>
      </div>
      <ol className="mt-5 space-y-4">
        {[
          "Open Customize → Connectors → Add custom connector.",
          "Enter UGC Pilot and paste the server URL.",
          "Finish the detected OAuth setup, sign in to your UGC Pilot account, and approve the scopes. An organization may require an admin to add the connector first.",
          "Enable the connector in the conversation and send the connection-check prompt.",
        ].map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-6">
            <span className="font-mono text-xs font-bold text-primary">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-5 text-muted">
        Official guide:{" "}
        <a className="font-semibold text-primary underline-offset-4 hover:underline" href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" rel="noopener noreferrer" target="_blank">
          Claude custom connectors
        </a>
      </p>
    </article>
  );
}

function CodexSetup() {
  return (
    <article className="min-w-0 rounded-[24px] border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-foreground-strong">Codex</h3>
        <Link href="/mcp/codex" className="text-sm font-semibold text-primary">Codex page</Link>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Put this in ~/.codex/config.toml, or in .codex/config.toml for a trusted project. Then sign in.
      </p>
      <div className="mt-4 space-y-4">
        <CopyTextButton label="~/.codex/config.toml" value={codexConfigToml.trim()} />
        <CopyTextButton label="Login commands" value={codexLoginCommands} />
      </div>
      <p className="text-xs leading-5 text-muted">
        Official guide:{" "}
        <a className="font-semibold text-primary underline-offset-4 hover:underline" href="https://developers.openai.com/codex/mcp" rel="noopener noreferrer" target="_blank">
          Codex MCP
        </a>
      </p>
    </article>
  );
}
