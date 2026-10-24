import "server-only";

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { MCP_MAX_REQUEST_BYTES, MCP_MAX_TOOL_INPUT_ELEMENTS } from "./transport-limits";
import { registerGenerationMcpTools, registeredGenerationMcpTools } from "./generation-tools";
import { registerMutationMcpTools, registeredMutationMcpTools } from "./mutation-tools";
import { registerReadMcpTools, registeredReadMcpTools } from "./read-tools";
import { registerFinishingMcpTools, registeredFinishingMcpTools } from "./finishing-tools";

import { registerDemoMcpTools, registeredDemoMcpTools } from "./demo-tools";

import { registerUploadRecoveryMcpTools, registeredUploadRecoveryMcpTools } from "./upload-recovery-tools";

import { registerOperationMcpTools, registeredOperationMcpTools } from "./operation-tools";

import { registerEditDraftMcpTools, registeredEditDraftMcpTools } from "./edit-draft-tools";

import { registerEditExportMcpTools, registeredEditExportMcpTools } from "./edit-export-tools";

import { registerAudioMcpTools, registeredAudioMcpTools } from "./audio-tools";

import { registerAudioVideoImportMcpTools, registeredAudioVideoImportMcpTools } from "./audio-video-import-tools";

import { registerReferenceMcpTools, registeredReferenceMcpTools } from "./reference-tools";

import { registerCreativeGroupMcpTools, registeredCreativeGroupMcpTools } from "./creative-group-tools";

import { registerLibraryContentMcpTools, registeredLibraryContentMcpTools } from "./library-content-tools";

import {registerAccountSettingsMcpTools,registeredAccountSettingsMcpTools} from "./account-settings-tools";

import {registerBusinessContextMcpTools,registeredBusinessContextMcpTools} from "./business-context-tools";

import { registerBusinessOnboardingMcpTools, registeredBusinessOnboardingMcpTools } from "./business-onboarding-tools";

import {registerBusinessLogoMcpTools,registeredBusinessLogoMcpTools} from "./business-logo-tools";

export const registeredMcpTools: readonly string[] = [
  ...registeredReadMcpTools, ...registeredMutationMcpTools, ...registeredGenerationMcpTools,
  ...registeredFinishingMcpTools, ...registeredDemoMcpTools, ...registeredUploadRecoveryMcpTools, ...registeredOperationMcpTools, ...registeredEditDraftMcpTools, ...registeredEditExportMcpTools, ...registeredAudioMcpTools, ...registeredAudioVideoImportMcpTools, ...registeredReferenceMcpTools, ...registeredCreativeGroupMcpTools, ...registeredLibraryContentMcpTools, ...registeredAccountSettingsMcpTools, ...registeredBusinessContextMcpTools, ...registeredBusinessOnboardingMcpTools, ...registeredBusinessLogoMcpTools,
];

export const mcpHandler = createMcpHandler(
  () => {
    const server = new McpServer({ name: "UGC Pilot", version: "0.1.0" }, { maxToolInputElements: MCP_MAX_TOOL_INPUT_ELEMENTS });
    registerReadMcpTools(server);
    registerMutationMcpTools(server);
    registerGenerationMcpTools(server);
    registerFinishingMcpTools(server);
    registerDemoMcpTools(server);
    registerUploadRecoveryMcpTools(server);
    registerOperationMcpTools(server);
    registerEditDraftMcpTools(server);
    registerEditExportMcpTools(server);
    registerAudioMcpTools(server);
    registerAudioVideoImportMcpTools(server);
    registerReferenceMcpTools(server);
    registerCreativeGroupMcpTools(server);
    registerLibraryContentMcpTools(server);
    registerAccountSettingsMcpTools(server);
    registerBusinessContextMcpTools(server);
    registerBusinessOnboardingMcpTools(server);
    registerBusinessLogoMcpTools(server);
    return server;
  },
  {
    legacy: "stateless",
    maxRequestBodySize: MCP_MAX_REQUEST_BYTES,
    onerror(error) {
      console.error(JSON.stringify({ event: "mcp.transport.error", name: error.name }));
    },
  },
);
