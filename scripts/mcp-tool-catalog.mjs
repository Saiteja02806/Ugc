import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const serverPath = path.join(root, "lib/mcp/server.ts");
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
};

function readString(source, start) {
  const quote = source[start];
  if (quote !== "\"" && quote !== "'" && quote !== "`") return null;
  let value = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      const next = source[index + 1];
      value += next === "n" ? "\n" : next === "t" ? "\t" : next ?? "";
      index += 1;
      continue;
    }
    if (character === quote) return { value, end: index + 1 };
    value += character;
  }
  throw new Error("Unclosed string in MCP tool source.");
}

function skipSpace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function readScope(source, start) {
  const match = source.slice(start, start + 2500).match(/requireScopes\(\s*([^)]*)\)/);
  const scopes = match ? [...match[1].matchAll(/"([a-z:]+)"/g)].map((item) => item[1]) : [];
  return scopes.length ? scopes.join(" ") : null;
}

function readDescriptionExpression(source, start, objectDescriptions) {
  let index = skipSpace(source, start);
  let value = "";
  while (index < source.length) {
    if (source.startsWith("operation.description", index)) {
      value += objectDescriptions.get("__operation__") ?? "";
      index += "operation.description".length;
    } else if (source[index] === "\"" || source[index] === "'" || source[index] === "`") {
      const literal = readString(source, index);
      value += literal.value;
      index = literal.end;
    } else {
      break;
    }
    index = skipSpace(source, index);
    if (source[index] !== "+") break;
    index += 1;
  }
  return value.trim();
}

function objectToolDescriptions(source) {
  const descriptions = new Map();
  const pattern = /tool\s*:\s*"([A-Za-z0-9_]+)"/g;
  for (const match of source.matchAll(pattern)) {
    const window = source.slice(match.index, match.index + 1200);
    const descriptionAt = window.search(/description\s*:/);
    if (descriptionAt === -1) continue;
    const expressionAt = skipSpace(window, descriptionAt + window.slice(descriptionAt).indexOf(":") + 1);
    descriptions.set(match[1], readDescriptionExpression(window, expressionAt, descriptions));
  }
  return descriptions;
}

function parseRegisteredTools(source, filePath) {
  const declared = source.match(/export const (registered\w+)\s*=\s*\[([\s\S]*?)\]\s*as const/);
  assert(declared, `Missing registered tool list in ${filePath}`);
  const names = [...declared[2].matchAll(/"([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
  const objectDescriptions = objectToolDescriptions(source);
  const suffix = source.match(/description\s*:\s*operation\.description\s*\+\s*"((?:\\.|[^"\\])*)"/);
  if (suffix) objectDescriptions.set("__operation__", "");
  const tools = new Map();
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const at = source.indexOf("registerTool(", searchFrom);
    if (at === -1) break;
    let cursor = skipSpace(source, at + "registerTool(".length);
    let name = null;
    if (source[cursor] === "\"" || source[cursor] === "'") {
      const literal = readString(source, cursor);
      name = literal.value;
      cursor = literal.end;
    } else if (source.startsWith("operation.tool", cursor)) {
      const descriptionAt = source.indexOf("description", cursor);
      const expressionAt = skipSpace(source, source.indexOf(":", descriptionAt) + 1);
      const extra = readDescriptionExpression(source, expressionAt, new Map());
      const scope = readScope(source, cursor);
      for (const toolName of names) {
        if (!objectDescriptions.has(toolName)) continue;
        if (tools.has(toolName)) continue;
        tools.set(toolName, {
          description: `${objectDescriptions.get(toolName)} ${extra}`.replace(/\s+/g, " ").trim(),
          scope,
        });
      }
      searchFrom = at + "registerTool(".length;
      continue;
    } else {
      searchFrom = at + "registerTool(".length;
      continue;
    }
    const descriptionAt = source.indexOf("description", cursor);
    assert(descriptionAt !== -1 && descriptionAt < cursor + 500, `Missing description for ${name} in ${filePath}`);
    const expressionAt = skipSpace(source, source.indexOf(":", descriptionAt) + 1);
    const description = readDescriptionExpression(source, expressionAt, objectDescriptions).replace(/\s+/g, " ").trim();
    const scope = readScope(source, cursor);
    tools.set(name, { description, scope });
    searchFrom = at + "registerTool(".length;
  }
  for (const name of names) {
    assert(tools.has(name), `Registry name ${name} has no description in ${filePath}`);
    assert(tools.get(name).description.length > 0, `Empty description for ${name}`);
    assert(tools.get(name).scope, `Missing OAuth scope for ${name}`);
  }
  return { registry: declared[1], names, tools };
}

export async function loadRegistrySource(file) {
  const relative = `lib/mcp/${file}.ts`;
  const source = await fs.readFile(path.join(root, relative), "utf8");
  if (/export const registered\w+\s*=\s*\[/.test(source)) return { relative, source };
  const reexport = source.match(/export\s*\{[^}]*registered\w+[^}]*\}\s*from\s*"\.\/([^"]+)"/);
  assert(reexport, `Cannot find registered tool list in ${relative}`);
  return loadRegistrySource(reexport[1]);
}

async function buildMcpToolCatalog() {
  const server = await fs.readFile(serverPath, "utf8");
  const registryOrder = [...server.match(/export const registeredMcpTools[\s\S]*?\];/)[0].matchAll(/\.\.\.(registered\w+)/g)].map((match) => match[1]);
  const imports = new Map([...server.matchAll(/import\s*\{[^}]*\}\s*from\s*"\.\/([^"]+)"/g)].flatMap((match) => {
    const names = [...match[0].matchAll(/registered\w+/g)].map((item) => item[0]);
    return names.map((name) => [name, match[1]]);
  }));
  assert.deepEqual(registryOrder, Object.keys(groupMeta), "Group metadata must follow the server registry order.");
  const groups = [];
  for (const registry of registryOrder) {
    const file = imports.get(registry);
    assert(file, `No import for ${registry}`);
    const loaded = await loadRegistrySource(file);
    const registrationSource = await fs.readFile(path.join(root, "lib/mcp", `${file}.ts`), "utf8");
    const listSource = loaded.source.includes(`export const ${registry}`) ? loaded.source : registrationSource;
    const parsed = parseRegisteredTools(
      listSource.includes("registerTool(") ? listSource : `${loaded.source}\n${registrationSource}`,
      file,
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
if (write || check) {
  const catalog = await buildMcpToolCatalog();
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  if (write) {
    await fs.writeFile(outputPath, serialized);
    console.log(`Wrote ${catalog.toolCount} tools to ${path.relative(root, outputPath)}`);
  }
  if (check) {
    const committed = await fs.readFile(outputPath, "utf8");
    assert.equal(committed, serialized, "mcp-tool-catalog.json is stale. Run node scripts/mcp-tool-catalog.mjs --write");
    assert.equal(catalog.toolCount, 79, `Expected 79 registered MCP tools, found ${catalog.toolCount}`);
    console.log(`MCP catalog matches the registry (${catalog.toolCount} tools).`);
  }
}
