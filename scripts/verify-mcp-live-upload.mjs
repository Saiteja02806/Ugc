import assert from 'node:assert/strict';

// Live Phase 4 acceptance. Uploads only a generated 1x1 PNG to the signed
// Google Cloud Storage URL, then soft-deletes its own test asset.
const origin = 'https://mcp.getugcpilot.com';
const resource = `${origin}/mcp`;
const token = process.env.MCP_ACCESS_TOKEN?.trim();
const testTag = process.env.MCP_UPLOAD_TEST_TAG?.trim();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64');
let requestId = 0;
let sessionId;
let version = '2025-06-18';
let testAssetId;

function request(url, options = {}) {
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(45_000) });
}

function unpack(raw, id) {
  const messages = raw.trimStart().startsWith('{') ? [JSON.parse(raw)] : raw.split(/\r?\n\r?\n/).flatMap(event => {
    const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    return data ? [JSON.parse(data)] : [];
  });
  const message = messages.find(item => item.id === id);
  assert(message?.result && !message.error, 'MCP request failed.');
  return message.result;
}

async function rpc(method, params, notification = false) {
  const id = ++requestId;
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': version,
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const response = await request(resource, { method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method, params }),
  });
  assert(response.ok, `MCP ${method} returned HTTP ${response.status}.`);
  if (method === 'initialize') sessionId = response.headers.get('mcp-session-id') || undefined;
  if (notification) { await response.body?.cancel(); return; }
  return unpack(await response.text(), id);
}

async function tool(name, args = {}, expectedError = false) {
  const result = await rpc('tools/call', { name, arguments: args });
  const text = result.content?.find(part => part.type === 'text')?.text;
  let output = result.structuredContent;
  if (!output && text) {
    try { output = JSON.parse(text); } catch { /* Report the safe state below. */ }
  }
  if (expectedError) {
    assert(result.isError, `${name} unexpectedly succeeded.`);
    return typeof output?.code === 'string' ? output.code : 'UNKNOWN';
  }
  const code = typeof output?.code === 'string' && /^[A-Z_]+$/.test(output.code) ? output.code : 'UNKNOWN';
  assert(!result.isError, `${name} failed (${code}).`);
  assert(output && typeof output === 'object', `${name} has no structured output.`);
  return output;
}

async function main() {
  assert(process.argv.slice(2).length === 1 && process.argv[2] === '--upload', 'Usage: node scripts/verify-mcp-live-upload.mjs --upload');
  assert(token, 'A real MCP_ACCESS_TOKEN is required; no upload has been created.');
  assert(testTag && /^[A-Za-z0-9_-]{8,80}$/.test(testTag), 'Set a stable MCP_UPLOAD_TEST_TAG (8–80 letters, numbers, _ or -); no upload has been created.');
  assert(png.length > 0, 'The test PNG is empty.');
  const initialized = await rpc('initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 'ugc-pilot-live-upload-verifier', version: '1.0.0' } });
  assert(typeof initialized.protocolVersion === 'string', 'MCP initialization failed.');
  version = initialized.protocolVersion;
  await rpc('notifications/initialized', {}, true);
  const tools = await rpc('tools/list', {});
  assert(['get_profile', 'create_upload', 'confirm_upload', 'get_asset', 'delete_asset'].every(name => tools.tools?.some(item => item.name === name)), 'Required upload tools are not registered.');
  const profile = await tool('get_profile');
  assert(typeof profile.id === 'string' && profile.id.length > 0, 'Account identity is missing.');
  console.log('Authenticated upload preflight passed. The test will create and soft-delete one tiny owned PNG asset.');
  const receipt = await tool('create_upload', {
    collection: 'image', file_name: `${testTag}.png`, mime_type: 'image/png',
    file_size_bytes: png.length, title: `MCP validation ${testTag}`,
  });
  assert(typeof receipt.upload_id === 'string' && receipt.upload_id.length > 0, 'No upload ID returned.');
  testAssetId = receipt.upload_id;
  console.log(`Reserved test asset ${testAssetId}.`);
  const signed = new URL(receipt.upload_url);
  assert(signed.origin === 'https://storage.googleapis.com' && signed.pathname.startsWith('/ugcsaas-media/'), 'Signed destination is not the configured GCS bucket.');
  assert(receipt.required_headers?.['Content-Type'] === 'image/png', 'Signed upload MIME type is unexpected.');
  assert(receipt.required_headers?.['x-goog-content-length-range'] === `1,${png.length}`, 'Signed upload byte limit is missing.');
  assert(receipt.required_headers?.['x-goog-if-generation-match'] === '0', 'Signed upload create-only condition is missing.');
  assert(Date.parse(receipt.expires_at) > Date.now(), 'Signed upload link is already expired.');
  const put = await request(signed, { method: 'PUT', headers: receipt.required_headers, body: png });
  assert(put.ok, `Direct GCS PUT returned HTTP ${put.status}.`);
  console.log('Signed GCS PUT passed.');
  const first = await tool('confirm_upload', { upload_id: testAssetId, width: 1, height: 1 });
  assert(first.asset?.id === testAssetId && first.asset.collection === 'image', 'Confirmed asset does not match.');
  const repeated = await tool('confirm_upload', { upload_id: testAssetId, width: 1, height: 1 });
  assert(repeated.asset?.id === testAssetId, 'Confirmation retry returned a different asset.');
  const loaded = await tool('get_asset', { asset_id: testAssetId });
  assert(loaded.asset?.id === testAssetId, 'Ready asset could not be read.');
  const direct = new URL(loaded.asset.url);
  assert(direct.origin === 'https://storage.googleapis.com' && direct.pathname.startsWith('/ugcsaas-media/'), 'Asset URL is outside configured GCS.');
  const head = await request(direct, { method: 'HEAD' });
  assert(head.ok && Number(head.headers.get('content-length')) === png.length && head.headers.get('content-type')?.startsWith('image/png'), 'Uploaded object is missing or mismatched.');
  console.log('Confirmed owned asset, idempotent confirmation, readback, and GCS object HEAD passed.');
  const deleted = await tool('delete_asset', { asset_id: testAssetId });
  assert(deleted.asset_id === testAssetId && deleted.deleted === true, 'Test asset was not soft-deleted.');
  const missing = await tool('get_asset', { asset_id: testAssetId }, true);
  assert(missing === 'NOT_FOUND', `Deleted asset was still visible (${missing}).`);
  console.log(`Live Phase 4 upload test passed; test asset ${testAssetId} was soft-deleted. The GCS object remains because that is the product's current delete behavior.`);
  testAssetId = undefined;
}

try { await main(); } catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : `Upload verification stopped (${error instanceof Error ? error.name : 'UnknownError'}).`);
  if (testAssetId) {
    try {
      await tool('delete_asset', { asset_id: testAssetId });
      console.error(`Test asset ${testAssetId} was soft-deleted after the failure.`);
    } catch {
      console.error(`Test asset ${testAssetId} needs manual inspection/cleanup.`);
    }
  }
  process.exitCode = 1;
}
