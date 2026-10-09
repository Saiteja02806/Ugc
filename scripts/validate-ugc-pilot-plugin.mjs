import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv = require("ajv");
const yaml = require("js-yaml");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, "plugins/ugc-pilot");
export const packageFiles = JSON.parse(fs.readFileSync(path.join(root, "scripts/ugc-pilot-package-files.json"), "utf8"));
assert.equal(new Set(packageFiles).size, packageFiles.length, "Duplicate package file");
for (const relative of packageFiles) {
  assert(typeof relative === "string" && relative && !relative.includes("\\") && !path.isAbsolute(relative) && !relative.split("/").some((part) => !part || part === "." || part === ".."), `Invalid package path: ${relative}`);
}
const endpoint = "https://mcp.getugcpilot.com/mcp";

export function validateOpenAiMetadata(plugin, knownTools, { submission = false } = {}) {
  const extension = plugin.extensions?.["com.openai"];
  const ui = extension?.interface;
  assert(ui, "Missing OpenAI interface metadata");
  const httpsUrl = (value, field) => {
    assert(typeof value === "string" && value.length <= 1024, `Missing or oversized ${field}`);
    const url = new URL(value);
    assert(url.protocol === "https:" && !url.username && !url.password, `Invalid HTTPS URL: ${field}`);
  };
  for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    httpsUrl(ui[field], field);
  }
  for (const [field, limit] of [["displayName", 30], ["shortDescription", 30], ["developerName", 80]]) {
    assert(typeof ui[field] === "string" && ui[field].trim() && ui[field].length <= limit && !/[\r\n\t]/.test(ui[field]), `Invalid ${field}`);
  }
  assert(Array.isArray(ui.defaultPrompt) && ui.defaultPrompt.length <= 3, "Invalid default prompts");
  const prompts = new Set();
  for (const prompt of ui.defaultPrompt) {
    assert(typeof prompt === "string" && prompt.trim() && prompt.length <= 128 && !/@|[\r\n\t]/.test(prompt), "Invalid default prompt");
    const normalized = prompt.normalize("NFKC").trim().replace(/\s+/g, " ");
    assert(!prompts.has(normalized), "Duplicate default prompt");
    prompts.add(normalized);
  }
  const onboarding = extension.onboardingSkill;
  assert(typeof onboarding === "string" && onboarding.startsWith("./") && !onboarding.includes("..") && packageFiles.includes(onboarding.slice(2)) && onboarding.endsWith("/SKILL.md"), "Invalid onboarding skill");
  const review = extension.review;
  assert(review && !Object.hasOwn(review, "test_credentials") && !Object.hasOwn(review, "reviewer_instructions"), "Reviewer credentials/instructions belong in the secure dashboard");
  for (const [kind, count] of [["positive", 5], ["negative", 3]]) {
    const cases = review.test_cases?.[kind];
    assert(Array.isArray(cases) && cases.length === count, `Expected ${count} ${kind} review cases`);
    for (const item of cases) {
      for (const field of kind === "positive" ? ["description", "prompt", "tools_triggered", "expected_behavior"] : ["description", "prompt"]) {
        assert(typeof item[field] === "string" && item[field].trim(), `Missing ${kind} case ${field}`);
      }
      assert(item.description.length <= 4000, "Oversized review description");
      if (kind === "positive") {
        for (const tool of item.tools_triggered.split(",").map((value) => value.trim())) {
          assert(knownTools.has(tool), `Unknown review tool: ${tool}`);
        }
      }
    }
  }
  if (review.demo_recording_url !== undefined || submission) {
    httpsUrl(review.demo_recording_url, "review.demo_recording_url (required before submission)");
  }
  return { submissionMaterialsComplete: Boolean(review.demo_recording_url), pending: review.demo_recording_url ? [] : ["review.demo_recording_url"] };
}

function json(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(pluginDir, relativePath), "utf8"));
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink(), `Symlink is not packageable: ${full}`);
    return entry.isDirectory() ? walk(full) : [path.relative(pluginDir, full).replaceAll("\\", "/")];
  });
}

export function validateResourceLinks(text, relative) {
  const markdown = [...text.matchAll(/\]\(([^)]+)\)/g)].map((entry) => entry[1]);
  // Catch declared backtick resource paths as well as clickable Markdown links.
  const declared = [...text.matchAll(/`((?:references|schemas|evals|examples|tests)\/[^`\s]+\.(?:md|json|csv))`/g)].map((entry) => entry[1]);
  for (const raw of [...markdown, ...declared]) {
    const link = raw.replace(/^<|>$/g, "").split(/\s+"/)[0];
    if (/^(?:https?:|mailto:|#)/.test(link)) continue;
    assert(!/^[a-z]+:/i.test(link), `Unsupported reference URL: ${link}`);
    const target = decodeURIComponent(link.split(/[?#]/)[0]);
    const full = path.resolve(path.dirname(path.join(pluginDir, relative)), target);
    const packaged = path.relative(pluginDir, full).replaceAll("\\", "/");
    assert(!packaged.startsWith("../") && !path.isAbsolute(packaged), `Escaping reference: ${link}`);
    assert(packageFiles.includes(packaged) && fs.existsSync(full), `Missing packaged reference in ${relative}: ${link}`);
  }
}

export function validatePackage({ submission = false } = {}) {
  assert.deepEqual(walk(pluginDir).sort(), [...packageFiles].sort(), "Unexpected or missing package file");
  const plugin = json("plugin.json");
  const mcp = json("mcp.json");
  // These published schemas use only draft-07-compatible validation keywords.
  // Ajv 6 resolves their local $defs JSON pointers; remove only the meta-schema declaration.
  const ajv = new Ajv({ allErrors: true, strictKeywords: false, schemaId: "auto" });
  for (const [name, data] of [["plugin", plugin], ["mcp", mcp]]) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, `scripts/mcp-plugin-schemas/${name}.json`), "utf8"));
    delete schema.$schema;
    const validate = ajv.compile(schema);
    assert(validate(data), `${name}: ${ajv.errorsText(validate.errors)}`);
  }
  assert.equal(plugin.name, path.basename(pluginDir));
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  const ui = plugin.extensions["com.openai"].interface;
  assert(ui.shortDescription.length <= 30, "Listing subtitle exceeds 30 characters");
  assert(Array.isArray(ui.defaultPrompt) && ui.defaultPrompt.length <= 3);
  for (const field of ["logo", "composerIcon"]) {
    assert.equal(ui[field], "./assets/logo.png");
  }
  assert.deepEqual(mcp.mcpServers, { "ugc-pilot": { type: "streamable-http", url: endpoint } });
  assert.deepEqual(json(".mcp.json"), { mcpServers: { "ugc-pilot": { type: "http", url: endpoint } } });
  for (const overlay of [".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]) {
    const metadata = json(overlay);
    assert.equal(metadata.name, plugin.name);
    assert.equal(metadata.version, plugin.version);
    assert.equal(metadata.mcpServers, "./.mcp.json");
    assert(!metadata.apps && !metadata.hooks, "No app bindings or executable hooks in this beta");
  }
  const codex = json(".codex-plugin/plugin.json");
  assert.equal(codex.skills, "./skills/");
  assert.deepEqual(codex.interface.defaultPrompt, ui.defaultPrompt);
  assert.equal(codex.interface.displayName, ui.displayName);
  for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    assert.equal(codex.interface[field], ui[field], `Compatibility metadata differs: ${field}`);
  }
  const { interface: portableInterface, ...portableExtension } = plugin.extensions["com.openai"];
  assert(portableInterface);
  assert.deepEqual(codex.extensions?.["com.openai"], portableExtension, "Compatibility onboarding/review metadata differs");

  const knownTools = new Set(["read", "mutation", "generation"].flatMap((kind) => {
    const code = fs.readFileSync(path.join(root, `lib/mcp/${kind}-tools.ts`), "utf8");
    return [...code.matchAll(/registerTool\("([a-z_]+)"/g)].map((match) => match[1]);
  }));
  assert.equal(knownTools.size, 12, "Review the package contract when the MCP tool surface changes");
  const reviewReadiness = validateOpenAiMetadata(plugin, knownTools, { submission });
  const skillNames = new Set(packageFiles.filter((relative) => relative.endsWith("/SKILL.md")).map((relative) => path.basename(path.dirname(relative))));
  for (const item of json("evaluation-cases.json").cases) {
    for (const tool of item.expected_tools ?? []) assert(knownTools.has(tool), `Unknown evaluation tool: ${tool}`);
    for (const tool of item.forbidden_tools ?? []) assert(knownTools.has(tool), `Unknown forbidden tool: ${tool}`);
    for (const skill of item.expected_skills ?? []) assert(skillNames.has(skill), `Unknown evaluation skill: ${skill}`);
    assert(item.expected?.trim() && item.prompt?.trim());
  }
  for (const relative of packageFiles) {
    const data = fs.readFileSync(path.join(pluginDir, relative));
    assert(data.length <= 5 * 1024 * 1024, `Oversized file: ${relative}`);
    if (relative.endsWith(".png")) continue;
    const text = data.toString("utf8");
    assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,}|\b(?:sk_live_|sb_secret_)[0-9A-Za-z_-]{15,}|Bearer\s+[A-Za-z0-9_-]{20,}/.test(text), `Possible credential in ${relative}`);
    if (relative.endsWith("SKILL.md")) {
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      assert(match, `Missing frontmatter: ${relative}`);
      const metadata = yaml.load(match[1]);
      assert.equal(metadata.name, path.basename(path.dirname(relative)));
      assert(typeof metadata.description === "string" && metadata.description.trim() && metadata.description.length <= 1024);
      for (const key of Object.keys(metadata)) assert(["name", "description", "license", "allowed-tools", "compatibility", "metadata"].includes(key), `Unsupported frontmatter field ${key}: ${relative}`);
    }
    if (relative.endsWith(".md")) validateResourceLinks(text, relative);
    if (relative.includes("/schemas/") || relative.endsWith("references/output-schema.json")) ajv.compile(JSON.parse(text));
  }
  const icon = fs.readFileSync(path.join(pluginDir, "assets/logo.png"));
  assert.equal(icon.subarray(1, 4).toString(), "PNG");
  for (const dimension of [icon.readUInt32BE(16), icon.readUInt32BE(20)]) {
    assert(dimension >= 48 && dimension <= 4096);
  }
  const files = packageFiles.map((relative) => ({
    path: relative,
    sha256: createHash("sha256").update(fs.readFileSync(path.join(pluginDir, relative))).digest("hex"),
  }));
  return { name: plugin.name, version: plugin.version, endpoint, files, skillCount: skillNames.size, toolCount: knownTools.size, reviewReadiness };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validatePackage({ submission: process.argv.includes("--submission") });
  console.log(JSON.stringify({ status: "passed", name: result.name, version: result.version, files: result.files.length, skillCount: result.skillCount, toolCount: result.toolCount, reviewReadiness: result.reviewReadiness, platformApproval: "not-verified-by-package-validation" }));
}
