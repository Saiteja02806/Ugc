"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const endpoint = "https://mcp.getugcpilot.com/mcp";
const firstPrompt = "Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.";
const clients = [
  {
    name: "Codex", label: "Desktop and CLI",
    steps: [
      "Open Settings → MCP servers → Add server. Name it ugc-pilot, choose Streamable HTTP, and paste the connection URL below.",
      "Save and restart the connection. Select Authenticate, sign into your UGC Pilot account, and approve the requested permissions.",
      "Start a new chat if the tools have not appeared, then try the connection-check prompt below. Install the beta plugin through your trusted plugin source to add its workflow skills.",
    ],
    docs: "https://learn.chatgpt.com/docs/extend/mcp",
    command: "codex mcp add ugc-pilot --url https://mcp.getugcpilot.com/mcp\ncodex mcp login ugc-pilot --scopes account:read,brand:read,assets:read,assets:write,generation:write,jobs:read",
  },
  {
    name: "ChatGPT", label: "Web and desktop",
    steps: [
      "If you received a private UGC Pilot plugin link, open it and install the plugin. A public directory listing is not available yet.",
      "Connect when prompted, sign into your UGC Pilot account, and approve access. Start a new conversation and select UGC Pilot.",
      "For eligible developer accounts, enable Developer mode under Settings → Security and login, then use Plugins → plus to add the connection URL below. Workspace policies may limit access.",
    ],
    docs: "https://developers.openai.com/plugins/quickstart", command: null,
  },
  {
    name: "Claude", label: "Web and desktop",
    steps: [
      "Open Customize → Connectors → Add custom connector. Enter UGC Pilot and paste the connection URL below.",
      "Follow the detected OAuth setup, sign into your UGC Pilot account, and approve access. Your organization may require an administrator to add the connector first.",
      "Enable the connector in your conversation and try the connection-check prompt below. You can connect to the hosted server without downloading the bundle.",
    ],
    docs: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp", command: null,
  },
  {
    name: "Claude Code", label: "Desktop and CLI",
    steps: [
      "Download and extract the plugin bundle. Load the ugc-pilot folder with Claude Code’s --plugin-dir option, or install it from a trusted plugin marketplace.",
      "Open /mcp, sign into your UGC Pilot account, and approve the OAuth permissions. Each person connects their own account.",
      "Try the connection-check prompt below. If you use the direct command instead of the plugin, it connects the MCP without installing the bundled workflow skills.",
    ],
    docs: "https://code.claude.com/docs/en/plugins",
    command: "claude mcp add --transport http ugc-pilot https://mcp.getugcpilot.com/mcp",
  },
];

function CopyBlock({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied");
    } catch {
      setStatus("Copy is unavailable. Select the text below and copy it manually.");
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          {status === "Copied" ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}Copy
        </button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-all rounded-xl border border-border bg-card-muted p-4 font-mono text-xs leading-6 sm:text-sm">{value}</pre>
      <p role="status" className="mt-1 min-h-5 text-xs text-muted">{status}</p>
    </div>
  );
}

export function ConnectAiPanel() {
  const [selected, setSelected] = useState(0);
  const client = clients[selected];
  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-card">
      <div className="grid grid-cols-2 gap-2 border-b border-border bg-card-muted p-3 sm:grid-cols-4" aria-label="Choose your AI app">
        {clients.map((item, index) => (
          <button key={item.name} type="button" aria-pressed={selected === index} aria-controls="client-instructions" onClick={() => setSelected(index)} className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${selected === index ? "border-primary bg-card shadow-sm" : "border-transparent hover:bg-card"}`}>
            <span className={`block text-sm font-semibold ${selected === index ? "text-primary" : "text-foreground"}`}>{item.name}</span>
            <span className="mt-1 block text-xs text-muted">{item.label}</span>
          </button>
        ))}
      </div>
      <div id="client-instructions" className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_0.95fr]">
        <div>
          <h3 className="text-lg font-semibold">Connect with {client.name}</h3>
          <ol className="mt-5 space-y-5">
            {client.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-6"><span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><span>{step}</span></li>
            ))}
          </ol>
          <a href={client.docs} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Official {client.name} setup guide ↗</a>
          <p className="mt-4 text-xs leading-5 text-muted">Sign in on the UGC Pilot consent page. Never paste passwords or access tokens into the chat.</p>
        </div>
        <div key={client.name} className="space-y-4">
          <CopyBlock label="Connection URL" value={endpoint} />
          <CopyBlock label="First prompt" value={firstPrompt} />
          {client.command && <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">CLI alternative</summary><div className="mt-3"><CopyBlock label="Setup commands" value={client.command} /></div></details>}
        </div>
      </div>
    </div>
  );
}
