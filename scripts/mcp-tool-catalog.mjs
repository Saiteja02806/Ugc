import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseRegisteredTools } from "./mcp-tool-source.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(root, "lib/marketing/mcp-tool-catalog.json");

const groupMeta = {
  registeredReadMcpTools: {
    id: "account-and-media",
    title: "Account, plan, brand, and media",
    summary: "Identify the connected account, read the plan and credits, load the business profile, and retrieve owned images and videos.",
  },
  registeredMutationMcpTools: {
    id: "uploads",
    title: "Upload media",
    summary: "Reserve an upload, confirm the finished file, and delete an owned asset.",
  },
  registeredGenerationMcpTools: {
    id: "generation",
    title: "Generate images and video",
    summary: "Queue image and short-video jobs against the account plan, then read job status.",
  },
  registeredFinishingMcpTools: {
    id: "finishing",
    title: "Finish a video",
    summary: "Compose hook text, trims, volume, framing, a demo clip, and optional subtitles on owned footage.",
  },
  registeredDemoMcpTools: {
    id: "demos",
    title: "Demo clips",
    summary: "Register, list, read, and delete owned product-demo clips.",
  },
  registeredUploadRecoveryMcpTools: {
    id: "upload-recovery",
    title: "Recover uploads",
    summary: "Find an interrupted upload, list recent reservations, and renew one that is still valid.",
  },
  registeredOperationMcpTools: {
    id: "operations",
    title: "Operations",
    summary: "List owned work, read one operation, and cancel or retry it when the contract allows.",
  },
  registeredEditDraftMcpTools: {
    id: "edit-drafts",
    title: "Edit drafts",
    summary: "Open, list, read, and save the same video edit draft used in the studio.",
  },
  registeredEditExportMcpTools: {
    id: "edit-export",
    title: "Export edits",
    summary: "Check export support, export one saved revision, and read that export.",
  },
  registeredAudioMcpTools: {
    id: "audio",
    title: "Speech and audio",
    summary: "Read audio readiness, list voices, generate speech, and manage private recordings.",
  },
  registeredAudioVideoImportMcpTools: {
    id: "audio-import",
    title: "Attach audio to video",
    summary: "Import an eligible recording onto a video edit and read that import.",
  },
  registeredReferenceMcpTools: {
    id: "references",
    title: "References and remix",
    summary: "Browse reviewed references and remix their text into a new draft.",
  },
  registeredCreativeGroupMcpTools: {
    id: "groups",
    title: "Creative asset groups",
    summary: "Browse owned image and video groups and change membership when the write gate is open.",
  },
  registeredLibraryContentMcpTools: {
    id: "library",
    title: "Library",
    summary: "Read saved carousel and slideshow library items, and save or archive them when writes are enabled.",
  },
  registeredAccountSettingsMcpTools: {
    id: "account-settings",
    title: "Account defaults",
    summary: "Read account defaults and recover settings receipts. Default updates use a separate account:write consent.",
  },
  registeredBusinessContextMcpTools: {
    id: "business-context", title: "Business context",
    summary: "Read the business profile and recover context receipts. Draft and profile writes require their consent and rollout gate.",
  },
  registeredBusinessOnboardingMcpTools: {
    id: "business-onboarding", title: "Business onboarding",
    summary: "Read saved onboarding progress and receipts. Requested onboarding changes require their consent and rollout gate.",
  },
  registeredBusinessLogoMcpTools: {
    id: "business-logo", title: "Business logos",
    summary: "Read logo upload readiness and reservations. Upload and verification require their consent and rollout gate.",
  },
  registeredSchedulingMcpTools: {
    id: "scheduling", title: "Scheduling",
    summary: "Read owned connections and schedules. Schedule creation requires explicit confirmation, consent and its rollout gate.",
  },
  registeredAnalyticsMcpTools: {
    id: "analytics", title: "Saved social analytics",
    summary: "Read owner-scoped saved analytics snapshots with the required consent and verified identity. Reads do not refresh providers.",
  },
};

export async function loadRegistrySource(file, repoRoot = root, visited = new Set()) {
  assert(!visited.has(file), `Cyclic tool registry re-export: ${file}`);
  visited.add(file);
  const relative = `lib/mcp/${file}.ts`;
  const source = await fs.readFile(path.join(repoRoot, relative), "utf8");
  if (/export const registered\w+\s*=\s*\[/.test(source)) return { relative, source };
  const reexport = source.match(/export\s*\{[^}]*registered\w+[^}]*\}\s*from\s*"\.\/([^"]+)"/);
  assert(reexport, `Cannot find registered tool list in ${relative}`);
  return loadRegistrySource(reexport[1], repoRoot, visited);
}

export async function buildMcpToolCatalog(repoRoot = root) {
  const server = await fs.readFile(path.join(repoRoot, "lib/mcp/server.ts"), "utf8");
  let confirmationInstruction;
  try {
    const confirmationSource = await fs.readFile(path.join(repoRoot, "lib/mcp/confirm-token.ts"), "utf8");
    const literal = confirmationSource.match(/export const CONFIRMATION_INSTRUCTION\s*=\s*("(?:[^"\\]|\\.)*")/);
    assert(literal, "Missing static confirmation instruction");
    confirmationInstruction = JSON.parse(literal[1]);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const registryOrder = [...server.match(/export const registeredMcpTools[\s\S]*?\];/)[0].matchAll(/\.\.\.(registered\w+)/g)].map((match) => match[1]);
  const imports = new Map([...server.matchAll(/import\s*\{[^}]*\}\s*from\s*"\.\/([^"]+)"/g)].flatMap((match) => {
    const names = [...match[0].matchAll(/registered\w+/g)].map((item) => item[0]);
    return names.map((name) => [name, match[1]]);
  }));
  assert(registryOrder.length > 0 && new Set(registryOrder).size === registryOrder.length, "Empty or duplicate MCP registry groups");
  for (const registry of registryOrder) assert(groupMeta[registry], `Missing group metadata for ${registry}`);
  const groups = [];
  for (const registry of registryOrder) {
    const file = imports.get(registry);
    assert(file, `No import for ${registry}`);
    const loaded = await loadRegistrySource(file, repoRoot);
    const registrationSource = await fs.readFile(path.join(repoRoot, "lib/mcp", `${file}.ts`), "utf8");
    const listSource = loaded.source.includes(`export const ${registry}`) ? loaded.source : registrationSource;
    const parsed = parseRegisteredTools(
      listSource.includes("registerTool(") ? listSource : `${loaded.source}\n${registrationSource}`,
      file, registry, confirmationInstruction,
    );
    assert.equal(parsed.registry, registry, `${file} exports ${parsed.registry}, expected ${registry}`);
    const meta = groupMeta[registry];
    groups.push({
      id: meta.id,
      title: meta.title,
      summary: meta.summary,
      registry,
      source: `lib/mcp/${file}.ts`,
      tools: parsed.names.map((name) => ({
        name,
        description: parsed.tools.get(name).description,
        scope: parsed.tools.get(name).scope,
      })),
    });
  }
  const tools = groups.flatMap((group) => group.tools);
  assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length, "Duplicate MCP tool names");
  return { toolCount: tools.length, groups };
}

const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href && (write || check)) {
  const catalog = await buildMcpToolCatalog();
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  if (write) {
    await fs.writeFile(outputPath, serialized);
    console.log(`Wrote ${catalog.toolCount} tools to ${path.relative(root, outputPath)}`);
  }
  if (check) {
    const committed = (await fs.readFile(outputPath, "utf8")).replace(/\r\n/g, "\n");
    assert.equal(committed, serialized, "mcp-tool-catalog.json is stale. Run node scripts/mcp-tool-catalog.mjs --write");
    console.log(`MCP catalog matches the registry (${catalog.toolCount} tools).`);
  }
}
