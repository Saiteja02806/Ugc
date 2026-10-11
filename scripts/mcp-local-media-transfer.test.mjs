import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inspectFile, prepareUpload, uploadFile, recoverUpload, downloadAsset } from '../plugins/ugc-pilot/skills/manage-ugc-media/scripts/transfer-media.mjs';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const ffprobe = require('ffprobe-static').path;
const ffmpeg = require('ffmpeg-static');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'plugins/ugc-pilot/skills/manage-ugc-media/scripts/transfer-media.mjs');
const id = 'b1ca2b04-231b-4d5a-9e61-6748a795318a';
let dir, video, inspection, bytes;
before(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  dir = await mkdtemp(path.join(root, '.tmp', 'mcp-transfer-'));
  video = path.join(dir, 'hook with spaces.mp4');
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=128x256:r=10',
    '-t', '1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video], { windowsHide: true });
  bytes = await readFile(video);
  inspection = await inspectFile(video, { collection: 'influencer', ffprobe });
});
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

function reservation() {
  return { upload_id: id, upload_url: `https://storage.googleapis.com/ugcsaas-media/media/fixture-owner/influencer/${id}.mp4?X-Goog-Signature=fixture-secret`,
    expires_at: new Date(Date.now() + 600_000).toISOString(), required_headers: {
      'Content-Type': 'video/mp4', 'x-goog-content-length-range': `1,${bytes.length}`, 'x-goog-if-generation-match': '0',
    } };
}
function asset(overrides = {}) {
  return { id, mime_type: 'video/mp4', file_size_bytes: bytes.length,
    url: `https://storage.googleapis.com/ugcsaas-media/media/fixture-owner/video/${id}.mp4`, ...overrides };
}
async function fixture(handler, action) {
  const server = createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch(() => { response.destroy(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const proxy = (url, options) => fetch(new URL(new URL(url).pathname, origin), options);
  try { return await action(proxy); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const receiptPath = name => path.join(dir, `${name}.json`);
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('real video inspection measures bytes, dimensions, duration and hash without reserving anything', async () => {
  assert.deepEqual(inspection.create_upload, { collection: 'influencer', file_name: 'hook with spaces.mp4', mime_type: 'video/mp4', file_size_bytes: bytes.length });
  assert.equal(inspection.media.width, 128);
  assert.equal(inspection.media.height, 256);
  assert.equal(inspection.media.duration_seconds, 1.5);
  assert.equal(inspection.sha256, createHash('sha256').update(bytes).digest('hex'));
  const { stdout } = await run(process.execPath, [script, 'inspect', video, '--collection', 'influencer', '--ffprobe', ffprobe]);
  assert.deepEqual(JSON.parse(stdout), inspection);
});
test('image inspection omits duration and unsupported or mismatched inputs fail before transfer', async () => {
  const png = path.join(dir, 'image.png');
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=8x8', '-frames:v', '1', png], { windowsHide: true });
  const result = await inspectFile(png, { collection: 'image', ffprobe });
  assert.deepEqual(result.media, { width: 8, height: 8 });
  await rejects(inspectFile(png, { collection: 'video', ffprobe }), 'UNSUPPORTED_MEDIA_TYPE');
  await rejects(inspectFile(video, { collection: 'image', ffprobe }), 'UNSUPPORTED_MEDIA_TYPE');
  await rejects(inspectFile(video, { collection: 'audio', ffprobe }), 'INVALID_INPUT');
  await rejects(inspectFile(video, { ffprobe: path.join(dir, 'absent-probe') }), 'PROBE_FAILED');
});
test('upload streams actual file bytes with exact signed headers and saves a secret-free receipt before PUT', async () => {
  const receipt = receiptPath('successful-upload');
  let calls = 0;
  await fixture(async (request, response) => {
    calls++;
    assert.equal(request.method, 'PUT');
    assert.equal(request.headers['content-length'], String(bytes.length));
    assert.equal(request.headers['content-type'], 'video/mp4');
    assert.equal(request.headers['x-goog-if-generation-match'], '0');
    const record = await readFile(receipt, 'utf8');
    assert.equal(JSON.parse(record).upload_id, id);
    assert(!/fixture-secret|upload_url|storage.googleapis.com/.test(record));
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), bytes);
    response.writeHead(200); response.end();
  }, async fetchImpl => {
    const output = await uploadFile(video, { reservation: reservation(), inspection, receiptPath: receipt, ffprobe, fetchImpl });
    assert.equal(output.uploaded, true);
    assert.deepEqual(output.confirm_upload, { upload_id: id, ...inspection.media });
    await rejects(uploadFile(video, { reservation: reservation(), inspection, receiptPath: receipt, ffprobe, fetchImpl }), 'RECEIPT_EXISTS');
  });
  assert.equal(calls, 1);
  assert.deepEqual(await recoverUpload(receipt), { confirm_upload: { upload_id: id, ...inspection.media } });
});
test('an interrupted response preserves confirmation recovery and prevents a second PUT', async () => {
  const receipt = receiptPath('interrupted');
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls++;
    for await (const _chunk of options.body) { /* Consume real bytes, then lose acknowledgement. */ }
    throw new Error('signed-url-and-provider-secret-must-not-be-reported');
  };
  await rejects(uploadFile(video, { reservation: reservation(), inspection, receiptPath: receipt, ffprobe, fetchImpl }), 'UPLOAD_UNCONFIRMED');
  assert.equal((await recoverUpload(receipt)).confirm_upload.upload_id, id);
  await rejects(uploadFile(video, { reservation: reservation(), inspection, receiptPath: receipt, ffprobe, fetchImpl }), 'RECEIPT_EXISTS');
  assert.equal(calls, 1);
});
test('expiry, alternate hosts, mismatched IDs/headers and changed inspection make no network request', async () => {
  const changes = [
    value => { value.expires_at = new Date(0).toISOString(); },
    value => { value.upload_url = value.upload_url.replace('storage.googleapis.com', 'example.com'); },
    value => { value.upload_url = value.upload_url.replace(id, 'f1ca2b04-231b-4d5a-9e61-6748a795318a'); },
    value => { value.required_headers['x-goog-if-generation-match'] = '1'; },
    value => { value.required_headers.Authorization = 'unexpected'; },
  ];
  let requests = 0;
  for (let index = 0; index < changes.length; index++) {
    const value = reservation(); changes[index](value);
    await assert.rejects(uploadFile(video, { reservation: value, inspection, receiptPath: receiptPath(`invalid-${index}`), ffprobe,
      fetchImpl: () => { requests++; throw new Error('unreachable'); } }));
  }
  await rejects(uploadFile(video, { reservation: reservation(), inspection: { ...inspection, sha256: 'different' },
    receiptPath: receiptPath('changed'), ffprobe, fetchImpl: () => { requests++; } }), 'FILE_CHANGED');
  assert.equal(requests, 0);
  assert(!(await readdir(dir)).some(name => name.startsWith('invalid-') || name === 'changed.json'));
});
test('HTTP storage errors retain the original reservation rather than claiming success', async () => {
  const receipt = receiptPath('http-error');
  await fixture(async (request, response) => {
    for await (const _chunk of request) { /* Receive file. */ }
    response.writeHead(412); response.end();
  }, fetchImpl => rejects(uploadFile(video, { reservation: reservation(), inspection, receiptPath: receipt, ffprobe, fetchImpl }), 'UPLOAD_UNCONFIRMED'));
  assert.equal((await recoverUpload(receipt)).confirm_upload.upload_id, id);
});
test('an early response cannot claim upload success before the file stream is verified', async () => {
  const receipt = receiptPath('early-response');
  await rejects(uploadFile(video, { reservation: reservation(), inspection, receiptPath: receipt, ffprobe,
    fetchImpl: async () => new Response(null, { status: 200 }) }), 'UPLOAD_UNCONFIRMED');
  assert.equal((await recoverUpload(receipt)).confirm_upload.upload_id, id);
});
test('download saves exact binary output and verified hash without overwriting an existing file', async () => {
  const output = path.join(dir, 'finished video.mp4');
  await fixture((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length }); response.end(bytes);
  }, async fetchImpl => {
    const result = await downloadAsset(output, { asset: asset(), fetchImpl });
    assert.equal(result.downloaded, true);
    assert.equal(result.sha256, inspection.sha256);
    assert.deepEqual(await readFile(output), bytes);
    await assert.rejects(downloadAsset(output, { asset: asset(), fetchImpl }), { code: 'EEXIST' });
    assert.deepEqual(await readFile(output), bytes);
  });
  assert(!(await readdir(dir)).some(name => name.endsWith('.partial')));
});
test('download rejects HTML, wrong lengths, invalid containers, interrupted bodies and redirects with no final file', async () => {
  const cases = [
    response => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<html>login</html>'); },
    response => { response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length + 1 }); response.end(bytes); },
    response => { response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length }); response.end(Buffer.alloc(bytes.length)); },
    response => { response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length }); response.write(bytes.subarray(0, 20)); response.destroy(); },
    response => { response.writeHead(302, { Location: 'https://example.com/secret' }); response.end(); },
  ];
  for (let index = 0; index < cases.length; index++) {
    const output = path.join(dir, `invalid-download-${index}.mp4`);
    await fixture((_request, response) => cases[index](response), fetchImpl => assert.rejects(downloadAsset(output, { asset: asset(), fetchImpl })));
    await assert.rejects(readFile(output), { code: 'ENOENT' });
  }
  assert(!(await readdir(dir)).some(name => name.endsWith('.partial')));
});
test('download without Content-Length still validates the final bytes', async () => {
  const output = path.join(dir, 'chunked.mp4');
  await fixture((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'video/mp4' });
    response.write(bytes.subarray(0, 200)); response.end(bytes.subarray(200));
  }, async fetchImpl => { assert.equal((await downloadAsset(output, { asset: asset({ file_size_bytes: null }), fetchImpl })).file_size_bytes, bytes.length); });
});
test('private download accepts only an unexpired original delivery URL for the supplied asset', async () => {
  const url = `https://www.getugcpilot.com/api/media/delivery/${id}?expires=${Math.floor(Date.now() / 1000) + 300}&signature=${'a'.repeat(64)}`;
  await fixture((_request, response) => { response.writeHead(200, { 'Content-Type': 'video/mp4' }); response.end(bytes); },
    async fetchImpl => { assert((await downloadAsset(path.join(dir, 'private.mp4'), { asset: asset({ url }), fetchImpl })).downloaded); });
  const invalid = [url.replace(id, 'f1ca2b04-231b-4d5a-9e61-6748a795318a'), `${url}&variant=thumbnail`, url.replace(/expires=\d+/, 'expires=1'),
    url.replace('www.getugcpilot.com', 'attacker.example'), 'http://127.0.0.1/file', 'https://storage.googleapis.com/other-bucket/file'];
  let calls = 0;
  for (const value of invalid) await rejects(downloadAsset(path.join(dir, 'untrusted.mp4'), { asset: asset({ url: value }), fetchImpl: () => { calls++; } }), 'INVALID_DESTINATION');
  assert.equal(calls, 0);
});
test('CLI errors never print signed URLs, provider errors or credentials', async () => {
  let error;
  try { await run(process.execPath, [script, 'inspect', video, '--ffprobe', 'missing-executable-with-private-secret']); }
  catch (caught) { error = caught; }
  assert.equal(JSON.parse(error.stderr).code, 'PROBE_FAILED');
  assert(!error.stderr.includes('private-secret'));
  const invalid = receiptPath('invalid-recovery'); await writeFile(invalid, JSON.stringify({ upload_url: 'provider-secret' }));
  await rejects(recoverUpload(invalid), 'INVALID_RECEIPT');
});

test('pre-reservation intent saves a stable request ID and exact metadata before any MCP request', async () => {
  const intent = path.join(dir, 'intent-only.json');
  const prepared = await prepareUpload(video, { receiptPath: intent, collection: 'influencer', ffprobe, title: '  Hook  ' });
  assert.equal(prepared.create_upload.title, 'Hook');
  assert.match(prepared.create_upload.request_id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(prepared.inspection, inspection);
  const saved = JSON.parse(await readFile(intent, 'utf8'));
  assert.doesNotMatch(JSON.stringify(saved), /signature|upload_url|storage.googleapis|[A-Za-z]:\\/);
  const recovered = await recoverUpload(intent);
  assert.deepEqual(recovered.get_upload, { request_id: prepared.create_upload.request_id });
  assert.deepEqual(recovered.create_upload, prepared.create_upload);
  assert.deepEqual(recovered.inspection, inspection);
  await rejects(prepareUpload(video, { receiptPath: intent, collection: 'influencer', ffprobe }), 'RECEIPT_EXISTS');
  saved.create_upload.upload_url = 'https://untrusted.example.test';
  await writeFile(intent, JSON.stringify(saved));
  await rejects(recoverUpload(intent), 'INVALID_RECEIPT');
});
