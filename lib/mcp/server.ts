import "server-only";

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerGenerationMcpTools, registeredGenerationMcpTools } from "./generation-tools";
import { registerMutationMcpTools, registeredMutationMcpTools } from "./mutation-tools";
import { registerReadMcpTools, registeredReadMcpTools } from "./read-tools";
import { registerFinishingMcpTools, registeredFinishingMcpTools } from "./finishing-tools";

import { registerDemoMcpTools, registeredDemoMcpTools } from "./demo-tools";

import { registerUploadRecoveryMcpTools, registeredUploadRecoveryMcpTools } from "./upload-recovery-tools";

import { registerOperationMcpTools, registeredOperationMcpTools } from "./operation-tools";

import { registerEditDraftMcpTools, registeredEditDraftMcpTools } from "./edit-draft-tools";

export const registeredMcpTools: readonly string[] = [
  ...registeredReadMcpTools, ...registeredMutationMcpTools, ...registeredGenerationMcpTools,
  ...registeredFinishingMcpTools, ...registeredDemoMcpTools, ...registeredUploadRecoveryMcpTools, ...registeredOperationMcpTools, ...registeredEditDraftMcpTools,
];

export const mcpHandler = createMcpHandler(
  () => {
    const server = new McpServer({ name: "UGC Pilot", version: "0.1.0" });
    registerReadMcpTools(server);
    registerMutationMcpTools(server);
    registerGenerationMcpTools(server);
    registerFinishingMcpTools(server);
    registerDemoMcpTools(server);
    registerUploadRecoveryMcpTools(server);
    registerOperationMcpTools(server);
    registerEditDraftMcpTools(server);
    return server;
  },
  {
    legacy: "stateless",
    onerror(error) {
      console.error(JSON.stringify({ event: "mcp.transport.error", name: error.name }));
    },
  },
);
