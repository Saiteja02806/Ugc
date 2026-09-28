import assert from "node:assert/strict";

// Explicit production acceptance helper. No credentials are loaded from disk.
const origin = "https://mcp.getugcpilot.com";
const resource = `${origin}/mcp`;
const flags = new Set(process.argv.slice(2));
const token = process.env.MCP_ACCESS_TOKEN?.trim();
let requestId = 0;
let protocolVersion = "2025-06-18";
let sessionId;

async function request(url, options = {}) {
  return fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(45_000) });
}

async function preflight() {
  const health = await request(`${resource}/health`);
  assert(health.status === 200 && (await health.json()).status === "ready", "MCP database health is not ready.");
  const discovery = await request(`${origin}/.well-known/oauth-protected-resource/mcp`);
  assert(discovery.ok, "Protected resource discovery failed.");
  const metadata = await discovery.json();
  assert(metadata.resource === resource && metadata.authorization_servers?.includes(origin), "Resource or issuer discovery does not match production.");
  const issuer = await request(`${origin}/.well-known/oauth-authorization-server`);
  assert(issuer.ok && (await issuer.json()).issuer === origin, "OAuth issuer discovery failed.");
  const unauthenticated = await request(resource);
  assert(unauthenticated.status === 401 && unauthenticated.headers.get("www-authenticate")?.includes("resource_metadata"), "Unauthenticated MCP request did not receive its OAuth challenge.");
  for (const path of ["/", "/api/jobs"]) {
    assert((await request(`${origin}${path}`)).status === 404, "MCP host exposed a website route.");
  }
  console.log("Public production preflight passed (database health, discovery, auth challenge, route isolation).");
}

function decodeResponse(raw, id) {
  // Streamable HTTP may return JSON or SSE. Match the response to this call.
  const messages = raw.trimStart().startsWith("{")
    ? [JSON.parse(raw)]
    : raw.split(/\r?\n\r?\n/).flatMap((event) => {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart()).join("\n");
      return data ? [JSON.parse(data)] : [];
    });
  const message = messages.find((item) => item.id === id);
  assert(message, "No matching MCP response received.");
  assert(!message.error, `MCP protocol error (${Number.isInteger(message.error?.code) ? message.error.code : "unknown"}).`);
  assert(message.result && typeof message.result === "object", "MCP response has no result.");
  return message.result;
}

async function rpc(method, params, notification = false) {
  const id = ++requestId;
  const headers = {
    authorization: `Bearer ${token}`, "content-type": "application/json",
    accept: "application/json, text/event-stream", "mcp-protocol-version": protocolVersion,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await request(resource, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id }), method, params }),
  });
  assert(response.ok, `MCP ${method} returned HTTP ${response.status}.`);
  if (method === "initialize") sessionId = response.headers.get("mcp-session-id") ?? undefined;
  if (notification) { await response.body?.cancel(); return; }
  return decodeResponse(await response.text(), id);
}

async function tool(name, args = {}) {
  const result = await rpc("tools/call", { name, arguments: args });
  const text = result.content?.find((part) => part.type === "text")?.text;
  let output = result.structuredContent;
  if (!output && text) {
    try { output = JSON.parse(text); } catch { /* Report a safe error below. */ }
  }
  const code = typeof output?.code === "string" && /^[A-Z_]+$/.test(output.code) ? output.code : "UNKNOWN";
  assert(!result.isError, `${name} failed (${code}).`);
  assert(output && typeof output === "object", `${name} has no structured output.`);
  return output;
}

async function main() {
  assert([...flags].every((flag) => ["--public", "--generate"].includes(flag)), "Usage: node scripts/verify-mcp-live-image.mjs [--public | --generate]");
  assert(!(flags.has("--public") && flags.has("--generate")), "Select one mode.");
  const generate = flags.has("--generate");
  const prompt = process.env.MCP_IMAGE_PROMPT?.trim();
  const clientRequestId = process.env.MCP_IMAGE_CLIENT_REQUEST_ID?.trim();
  if (generate) {
    assert(token, "MCP_ACCESS_TOKEN is required; no job has been queued.");
    assert(prompt && prompt.length <= 2000, "Set MCP_IMAGE_PROMPT (1–2000 characters); no job has been queued.");
    assert(clientRequestId && clientRequestId.length <= 200, "Set a stable MCP_IMAGE_CLIENT_REQUEST_ID (1–200 characters); no job has been queued.");
  }
  await preflight();
  if (flags.has("--public")) {
    console.log("Authenticated tools and image generation NOT RUN.");
    return;
  }
  assert(token, "Set a real OAuth bearer in MCP_ACCESS_TOKEN. Authenticated validation NOT RUN; no job has been queued.");
  const initialized = await rpc("initialize", {
    protocolVersion, capabilities: {}, clientInfo: { name: "ugc-pilot-live-image-verifier", version: "1.0.0" },
  });
  assert(typeof initialized.protocolVersion === "string", "Server did not negotiate a protocol version.");
  protocolVersion = initialized.protocolVersion;
  await rpc("notifications/initialized", {}, true);
  const discovery = await rpc("tools/list", {});
  const required = ["get_profile", "get_entitlements", "get_saas_brand", "list_assets", "get_asset", "get_capabilities", "create_upload", "confirm_upload", "delete_asset", "generate_image", "get_job"];
  assert(required.every((name) => discovery.tools?.some((item) => item.name === name)), "Phase 2–5 tools are missing from discovery.");
  assert(!discovery.tools.some((item) => item.name === "cancel_job"), "Excluded cancellation tool is exposed.");
  const profile = await tool("get_profile");
  assert(typeof profile.id === "string" && profile.id.length > 0, "Account identity is missing.");
  const before = await tool("get_entitlements");
  const brand = await tool("get_saas_brand");
  assert(brand.name?.trim() && brand.context?.product_summary?.trim().length >= 20 && brand.context?.target_audience?.length > 0, "Brand context is incomplete.");
  const capabilities = await tool("get_capabilities");
  const assets = await tool("list_assets", { collection: "image", limit: 1 });
  assert(Array.isArray(assets.items), "Asset list has no items array.");
  if (assets.items.length) {
    assert((await tool("get_asset", { asset_id: assets.items[0].id })).asset?.id === assets.items[0].id, "Listed asset could not be retrieved.");
  }
  console.log("Authenticated production reads passed (identity, entitlements, brand, capabilities, asset library).");
  if (!generate) {
    console.log("Image generation NOT RUN. Use --generate with an approved test prompt and stable request ID to spend image credits.");
    return;
  }
  assert(before.active && before.features?.image_generation && capabilities.image_generation?.available, "Account cannot generate an image with its current plan and credits.");
  assert(Number.isInteger(before.image_credit_cost) && before.image_credit_cost > 0, "Image price is invalid.");
  const args = { prompt, client_request_id: clientRequestId, count: 1, aspect_ratio: "9:16" };
  console.log(`Submitting one image; credit cost ${before.image_credit_cost}; client_request_id=${clientRequestId}. Keep this ID for every retry.`);
  const receipt = await tool("generate_image", args);
  assert(receipt.partial === false && receipt.jobs?.length === 1, "Single-image request did not return one complete job receipt.");
  const jobId = receipt.jobs[0].job_id;
  console.log(`job_id=${jobId}`);
  const retry = await tool("generate_image", args);
  assert(retry.partial === false && retry.jobs?.length === 1 && retry.jobs[0].job_id === jobId, "Identical retry returned another job.");
  console.log("Identical request ID returned the same job. Database reservation audit is still required.");
  const deadline = Date.now() + 10 * 60_000;
  let previousStatus;
  let completed;
  while (Date.now() < deadline) {
    const job = await tool("get_job", { job_id: jobId });
    assert(job.id === jobId && job.type === "image_generation", "Retrieved job does not match the image request.");
    if (job.status !== previousStatus) { console.log(`Job status: ${job.status}`); previousStatus = job.status; }
    assert(!["failed", "cancelled"].includes(job.status), `Image job ended with ${job.status}; inspect its reservation before retrying.`);
    if (job.status === "completed") { completed = job; break; }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  assert(completed, "Image is still pending after 10 minutes. Keep the same request ID; do not submit a new one.");
  assert(completed.output_asset_ids?.length === 1, "Completed image job has no single output asset.");
  const assetId = completed.output_asset_ids[0];
  const { asset } = await tool("get_asset", { asset_id: assetId });
  assert(asset?.id === assetId && asset.collection === "image" && asset.source_type === "generated_image" && asset.mime_type?.startsWith("image/"), "Generated asset metadata is invalid.");
  const assetUrl = new URL(asset.url);
  assert(assetUrl.origin === "https://storage.googleapis.com" && assetUrl.pathname.startsWith("/ugcsaas-media/"), "Output URL is outside the configured media storage.");
  const object = await request(assetUrl, { method: "HEAD" });
  assert(object.ok && object.headers.get("content-type")?.startsWith("image/") && Number(object.headers.get("content-length")) > 0, "Generated image object is unavailable or empty.");
  const after = await tool("get_entitlements");
  console.log(JSON.stringify({ job_id: jobId, asset_id: assetId, credits_before: before.credits_remaining, credits_after: after.credits_remaining, reserved_before: before.credits_reserved, reserved_after: after.credits_reserved }));
  console.log("Live image tool flow passed. Verify this job's single committed reservation and queue delivery in the database before accepting Phase 5. This helper does not validate ChatGPT or Claude interoperability.");
}

try { await main(); } catch (error) {
  // Never emit bearer tokens, raw server payloads, prompts, or credential objects.
  console.error(error instanceof assert.AssertionError ? error.message : `Validation stopped (${error instanceof Error ? error.name : "UnknownError"}). Keep the same image request ID if a job was submitted.`);
  process.exitCode = 1;
}
