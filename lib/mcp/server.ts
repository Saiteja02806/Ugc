import "server-only";

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerGenerationMcpTools, registeredGenerationMcpTools } from "./generation-tools";
import { registerMutationMcpTools, registeredMutationMcpTools } from "./mutation-tools";
import { registerReadMcpTools, registeredReadMcpTools } from "./read-tools";
import { registerFinishingMcpTools, registeredFinishingMcpTools } from "./finishing-tools";

export const registeredMcpTools: readonly string[] = [
  ...registeredReadMcpTools, ...registeredMutationMcpTools, ...registeredGenerationMcpTools,
  ...registeredFinishingMcpTools,
];

export const mcpHandler = createMcpHandler(
  () => {
    const server = new McpServer({ name: "UGC Pilot", version: "0.1.0" });
    registerReadMcpTools(server);
    registerMutationMcpTools(server);
    registerGenerationMcpTools(server);
    registerFinishingMcpTools(server);
    return server;
  },
  {
    legacy: "stateless",
    onerror(error) {
      console.error(JSON.stringify({ event: "mcp.transport.error", name: error.name }));
    },
  },
);
