const agents = ["Claude", "Codex", "ChatGPT"];

export function LandingPlatformBadge() {
  return (
    <a
      href="/mcp"
      className="mb-6 inline-flex max-w-full flex-col items-center gap-2 rounded-[20px] border border-border bg-card px-4 py-2.5 text-xs font-medium shadow-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-row sm:gap-4 sm:rounded-full sm:py-2"
    >
      <span className="font-semibold text-primary">MCP server</span>
      <span className="hidden h-4 w-px bg-border-strong sm:block" aria-hidden="true" />
      <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-foreground-strong">
        {agents.map((agent) => (
          <span key={agent}>{agent}</span>
        ))}
      </span>
    </a>
  );
}
