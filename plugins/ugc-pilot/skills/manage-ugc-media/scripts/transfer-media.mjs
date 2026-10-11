// Local byte transfer only. OAuth and account operations stay in the host MCP.
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { open, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';
import { Transform } from 'node:stream';

const run = promisify(execFile);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DOWNLOAD = 1024 * 1024 * 1024;
const types = new Set(['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']);

export class TransferError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function check(condition, code, message) {
  if (!condition) throw new TransferError(code, message);
}
function mimeFromBytes(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.toString('ascii', 4, 8) === 'ftyp') {
    return bytes.toString('ascii', 8, 12) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) && bytes.includes(Buffer.from('webm'))) return 'video/webm';
  throw new TransferError('UNSUPPORTED_MEDIA_TYPE', 'Use a PNG, JPEG, WebP, MP4, MOV or WebM file with a supported container header.');
}
async function inspectHandle(handle, filePath, collection, ffprobe) {
  check(['image', 'video', 'influencer'].includes(collection), 'INVALID_INPUT', 'Choose image, video or influencer.');
  const before = await handle.stat();
  const limit = (collection === 'image' ? 25 : 250) * 1024 * 1024;
  check(before.isFile() && before.size > 0 && before.size <= limit, 'INVALID_FILE', 'The media must be a nonempty regular file within the collection size limit.');
  const header = Buffer.alloc(Math.min(4096, before.size));
  await handle.read(header, 0, header.length, 0);
  const mime = mimeFromBytes(header);
  check(mime.startsWith(collection === 'image' ? 'image/' : 'video/'), 'UNSUPPORTED_MEDIA_TYPE', 'The file type does not match this collection.');
  let probe;
  try {
    const { stdout } = await run(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file', '-show_entries',
      'stream=codec_type,width,height:format=duration,format_name', '-of', 'json', path.resolve(filePath)],
    { timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true });
    probe = JSON.parse(stdout);
  } catch { throw new TransferError('PROBE_FAILED', 'Could not measure this file. Supply a working ffprobe executable; do not invent dimensions or duration.'); }
  const stream = probe.streams?.find(item => item.codec_type === 'video');
  check(Number.isSafeInteger(stream?.width) && stream.width > 0 && Number.isSafeInteger(stream?.height) && stream.height > 0,
    'INVALID_MEDIA', 'No valid visual media stream was found.');
  const duration = Number(probe.format?.duration);
  check(collection === 'image' || (Number.isFinite(duration) && duration > 0), 'INVALID_MEDIA', 'The video duration could not be measured.');
  const hash = createHash('sha256');
  for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) hash.update(chunk);
  const after = await handle.stat();
  check(before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs,
    'FILE_CHANGED', 'The file changed during inspection. Inspect it again before reserving an upload.');
  const name = path.basename(filePath);
  check(name.length <= 255 && !/[/\\\0]/.test(name), 'INVALID_FILE', 'The display file name is invalid.');
  return {
    sha256: hash.digest('hex'),
    create_upload: { collection, file_name: name, mime_type: mime, file_size_bytes: before.size },
    media: { width: stream.width, height: stream.height, ...(collection === 'image' ? {} : { duration_seconds: duration }) },
  };
}
export async function inspectFile(filePath, { collection = 'video', ffprobe = 'ffprobe' } = {}) {
  const handle = await open(filePath, 'r');
  try { return await inspectHandle(handle, filePath, collection, ffprobe); } finally { await handle.close(); }
}
export async function prepareUpload(filePath, { receiptPath, collection = 'video', ffprobe = 'ffprobe', title } = {}) {
  check(receiptPath, 'INVALID_INPUT', 'Provide a new local intent receipt path before reserving an upload.');
  const inspection = await inspectFile(filePath, { collection, ffprobe });
  check(title === undefined || (typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 140), 'INVALID_INPUT', 'The upload title must be 1 to 140 characters.');
  const requestId = randomUUID();
  const createInput = { ...inspection.create_upload, ...(title === undefined ? {} : { title: title.trim() }), request_id: requestId };
  let record;
  try { record = await open(receiptPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new TransferError('RECEIPT_EXISTS', 'The intent receipt exists. Recover its request ID instead of creating another intent.');
    throw error;
  }
  try { await writeReceipt(record, { version: 2, request_id: requestId, inspection, create_upload: createInput }); }
  finally { await record.close(); }
  return { inspection, create_upload: createInput, intent_receipt_path: path.resolve(receiptPath) };
}
function storageUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new TransferError('INVALID_DESTINATION', 'The media URL is invalid.'); }
  check(url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.port,
    'INVALID_DESTINATION', 'Media transfer requires a credential-free HTTPS destination.');
  return url;
}
function uploadDestination(reservation, inspection) {
  check(UUID.test(reservation?.upload_id), 'INVALID_RESERVATION', 'A real create_upload reservation is required.');
  const url = storageUrl(reservation.upload_url);
  const { collection, mime_type: mime, file_size_bytes: size } = inspection.create_upload;
  const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm' }[mime];
  const escapedId = reservation.upload_id.replaceAll('-', '\\-');
  check(url.hostname === 'storage.googleapis.com' && new RegExp(`^/ugcsaas-media/media/[^/]+/${collection}/${escapedId}\\${extension}$`).test(url.pathname),
    'INVALID_DESTINATION', 'The signed destination does not match the reserved UGC Pilot asset.');
  check(Date.parse(reservation.expires_at) > Date.now(), 'UPLOAD_EXPIRED', 'The upload link expired. Preserve the ID; resolve the transfer and renew_upload for the same reservation when supported.');
  const headers = reservation.required_headers;
  check(headers && Object.keys(headers).length === 3 && headers['Content-Type'] === mime &&
    headers['x-goog-content-length-range'] === `1,${size}` && headers['x-goog-if-generation-match'] === '0',
  'INVALID_RESERVATION', 'The signed headers do not match the inspected file.');
  return url;
}
async function writeReceipt(handle, receipt) {
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  await handle.writeFile(bytes); // Called once before any network request.
  await handle.sync();
}
export async function uploadFile(filePath, { reservation, inspection, receiptPath, ffprobe = 'ffprobe', fetchImpl = fetch }) {
  check(inspection?.create_upload && receiptPath, 'INVALID_INPUT', 'Provide the inspection, reservation and a new local receipt path.');
  const handle = await open(filePath, 'r');
  let record;
  try {
    const measured = await inspectHandle(handle, filePath, inspection.create_upload.collection, ffprobe);
    check(isDeepStrictEqual(measured, inspection), 'FILE_CHANGED', 'The file or inspection changed after reservation. Do not transfer different bytes.');
    const destination = uploadDestination(reservation, measured);
    const receipt = { version: 1, upload_id: reservation.upload_id, sha256: measured.sha256,
      file_size_bytes: measured.create_upload.file_size_bytes, confirm_upload: { upload_id: reservation.upload_id, ...measured.media },
      recovery: 'This receipt was saved before PUT. Confirm this same upload ID to determine whether transfer committed. Do not repeat PUT or reserve another upload automatically.' };
    try { record = await open(receiptPath, 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') throw new TransferError('RECEIPT_EXISTS', 'A receipt already exists. Recover its upload ID with confirm_upload instead of repeating PUT.');
      throw error;
    }
    await writeReceipt(record, receipt);
    let response;
    const streamedHash = createHash('sha256');
    let streamedSize = 0;
    let transferVerified = false;
    const verified = new Transform({
      transform(chunk, _encoding, callback) {
        streamedSize += chunk.length;
        streamedHash.update(chunk);
        callback(null, chunk);
      },
      flush(callback) {
        transferVerified = streamedSize === measured.create_upload.file_size_bytes && streamedHash.digest('hex') === measured.sha256;
        callback(transferVerified ? null : new TransferError('FILE_CHANGED', 'The file changed during transfer. Preserve the upload receipt.'));
      },
    });
    const source = handle.createReadStream({ start: 0, autoClose: false });
    source.on('error', error => verified.destroy(error));
    source.pipe(verified);
    try {
      response = await fetchImpl(destination, { method: 'PUT', redirect: 'error',
        headers: { ...reservation.required_headers, 'Content-Length': String(measured.create_upload.file_size_bytes) },
        body: verified, duplex: 'half', signal: AbortSignal.timeout(10 * 60 * 1000) });
      await response.body?.cancel();
    } catch { throw new TransferError('UPLOAD_UNCONFIRMED', 'The transfer response was interrupted. Read the saved receipt and confirm the same upload ID; do not repeat PUT automatically.'); }
    finally { source.destroy(); verified.destroy(); }
    check(response.ok, 'UPLOAD_UNCONFIRMED', `Storage returned HTTP ${response.status}. Confirm the saved upload ID before deciding whether another reservation is needed.`);
    check(transferVerified, 'UPLOAD_UNCONFIRMED', 'The response arrived before the complete file was verified. Confirm the saved upload ID before retrying.');
    return { uploaded: true, receipt_path: path.resolve(receiptPath), confirm_upload: receipt.confirm_upload, sha256: receipt.sha256 };
  } finally { await record?.close(); await handle.close(); }
}
export async function recoverUpload(receiptPath) {
  const handle = await open(receiptPath, 'r');
  try {
    check((await handle.stat()).size <= 16_384, 'INVALID_RECEIPT', 'The local upload receipt is invalid.');
    let receipt;
    try { receipt = JSON.parse(await handle.readFile('utf8')); } catch { throw new TransferError('INVALID_RECEIPT', 'The local upload receipt is invalid.'); }
    if (receipt?.version === 2) {
      const inspection = receipt.inspection, fields = inspection?.create_upload, media = inspection?.media;
      check(UUID.test(receipt.request_id) && /^[a-f0-9]{64}$/.test(inspection?.sha256 ?? '') &&
        ['image', 'video', 'influencer'].includes(fields?.collection) && types.has(fields?.mime_type) &&
        typeof fields.file_name === 'string' && fields.file_name.length > 0 && fields.file_name.length <= 255 && !/[/\\\0]/.test(fields.file_name) &&
        Number.isSafeInteger(fields.file_size_bytes) && fields.file_size_bytes > 0 && fields.file_size_bytes <= (fields.collection === 'image' ? 25 : 250) * 1024 * 1024 &&
        Number.isSafeInteger(media?.width) && media.width > 0 && Number.isSafeInteger(media?.height) && media.height > 0 &&
        (fields.collection === 'image' ? media.duration_seconds === undefined : Number.isFinite(media.duration_seconds) && media.duration_seconds > 0),
      'INVALID_RECEIPT', 'The saved upload intent is invalid.');
      const input = receipt.create_upload;
      const cleanInspection = { sha256: inspection.sha256, create_upload: {
        collection: fields.collection, file_name: fields.file_name, mime_type: fields.mime_type, file_size_bytes: fields.file_size_bytes },
        media: { width: media.width, height: media.height, ...(fields.collection === 'image' ? {} : { duration_seconds: media.duration_seconds }) } };
      check(isDeepStrictEqual(cleanInspection, inspection) && input?.request_id === receipt.request_id &&
        (input.title === undefined || (typeof input.title === 'string' && input.title === input.title.trim() && input.title.length > 0 && input.title.length <= 140)),
      'INVALID_RECEIPT', 'The saved upload intent is invalid.');
      const cleanInput = { ...cleanInspection.create_upload, ...(input.title === undefined ? {} : { title: input.title }), request_id: receipt.request_id };
      check(isDeepStrictEqual(cleanInput, input), 'INVALID_RECEIPT', 'The saved reservation inputs are invalid.');
      return { get_upload: { request_id: receipt.request_id }, create_upload: cleanInput, inspection: cleanInspection };
    }
    const input = receipt?.confirm_upload;
    check(receipt?.version === 1 && UUID.test(receipt.upload_id) && input?.upload_id === receipt.upload_id &&
      Number.isSafeInteger(input.width) && input.width > 0 && Number.isSafeInteger(input.height) && input.height > 0 &&
      (input.duration_seconds === undefined || (Number.isFinite(input.duration_seconds) && input.duration_seconds > 0)),
    'INVALID_RECEIPT', 'The local upload receipt is invalid.');
    return { confirm_upload: { upload_id: input.upload_id, width: input.width, height: input.height,
      ...(input.duration_seconds === undefined ? {} : { duration_seconds: input.duration_seconds }) } };
  } finally { await handle.close(); }
}
function downloadDestination(asset) {
  check(UUID.test(asset?.id) && types.has(asset.mime_type), 'INVALID_ASSET', 'Use a supported owned asset returned by get_asset.');
  const url = storageUrl(asset.url);
  const gcs = url.hostname === 'storage.googleapis.com' && url.pathname.startsWith('/ugcsaas-media/') && url.pathname.length > '/ugcsaas-media/'.length;
  const delivery = ['getugcpilot.com', 'www.getugcpilot.com'].includes(url.hostname) && url.pathname === `/api/media/delivery/${asset.id}` &&
    Number(url.searchParams.get('expires')) * 1000 > Date.now() && /^[a-f0-9]{64}$/i.test(url.searchParams.get('signature') ?? '') && !url.searchParams.has('variant');
  check(gcs || delivery, 'INVALID_DESTINATION', 'Use the original UGC Pilot asset URL; renew an expired private link through get_asset.');
  check(asset.file_size_bytes == null || (Number.isSafeInteger(asset.file_size_bytes) && asset.file_size_bytes > 0 && asset.file_size_bytes <= MAX_DOWNLOAD),
    'INVALID_ASSET', 'The asset size is invalid or exceeds the 1 GB transfer limit.');
  return url;
}
export async function downloadAsset(outputPath, { asset, fetchImpl = fetch }) {
  const destination = downloadDestination(asset);
  const output = path.resolve(outputPath);
  const temporary = path.join(path.dirname(output), `.ugc-download-${randomUUID()}.partial`);
  let handle;
  let temporaryOwned = false;
  try {
    const response = await fetchImpl(destination, { redirect: 'error', signal: AbortSignal.timeout(10 * 60 * 1000) });
    check(response.ok && response.body, 'DOWNLOAD_FAILED', `Media download returned HTTP ${response.status}; renew the asset URL if needed.`);
    const mime = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    const rawLength = response.headers.get('content-length');
    const expected = rawLength === null ? null : Number(rawLength);
    if (mime !== asset.mime_type || (expected !== null && (!Number.isSafeInteger(expected) || expected <= 0 || expected > MAX_DOWNLOAD ||
      (asset.file_size_bytes != null && expected !== asset.file_size_bytes)))) {
      await response.body.cancel();
      throw new TransferError('DOWNLOAD_MISMATCH', 'The download type or length differs from the asset metadata.');
    }
    handle = await open(temporary, 'wx', 0o600);
    temporaryOwned = true;
    const hash = createHash('sha256');
    let size = 0;
    let header = Buffer.alloc(0);
    for await (const value of response.body) {
      const bytes = Buffer.from(value);
      size += bytes.length;
      check(size <= MAX_DOWNLOAD && (asset.file_size_bytes == null || size <= asset.file_size_bytes), 'DOWNLOAD_MISMATCH', 'The download exceeds the allowed asset length.');
      if (header.length < 4096) header = Buffer.concat([header, bytes.subarray(0, 4096 - header.length)]);
      hash.update(bytes);
      await handle.writeFile(bytes);
    }
    check(size > 0 && (expected === null || size === expected) && (asset.file_size_bytes == null || size === asset.file_size_bytes) &&
      mimeFromBytes(header) === asset.mime_type, 'DOWNLOAD_MISMATCH', 'The downloaded bytes do not match the asset.');
    await handle.sync();
    await handle.close(); handle = undefined;
    // Exclusive publication preserves any existing user file, including symlinks.
    await link(temporary, output);
    return { downloaded: true, asset_id: asset.id, path: output, file_size_bytes: size, sha256: hash.digest('hex') };
  } finally { await handle?.close(); if (temporaryOwned) await unlink(temporary); }
}
async function stdinJson() {
  const chunks = [];
  let size = 0;
  for await (const bytes of process.stdin) {
    size += bytes.length;
    check(size <= 65_536, 'INVALID_INPUT', 'The transfer input is too large.');
    chunks.push(bytes);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new TransferError('INVALID_INPUT', 'Pass the reservation/inspection or asset as JSON on stdin.'); }
}
async function main() {
  check(Number(process.versions.node.split('.')[0]) >= 22, 'RUNTIME_REQUIRED', 'Use Node.js 22 or newer.');
  const [command, filePath, ...options] = process.argv.slice(2);
  check(['inspect', 'prepare', 'upload', 'recover', 'download'].includes(command) && filePath && options.length % 2 === 0,
    'INVALID_INPUT', 'Usage: transfer-media.mjs inspect|prepare|upload|recover|download FILE [--collection GROUP] [--ffprobe EXECUTABLE] [--receipt FILE]');
  const parsed = {};
  for (let i = 0; i < options.length; i += 2) {
    const key = { '--collection': 'collection', '--ffprobe': 'ffprobe', '--receipt': 'receiptPath', '--title': 'title' }[options[i]];
    check(key && !Object.hasOwn(parsed, key), 'INVALID_INPUT', 'Unknown or duplicate transfer option.');
    parsed[key] = options[i + 1];
  }
  let result;
  if (command === 'inspect') result = await inspectFile(filePath, parsed);
  else if (command === 'prepare') result = await prepareUpload(filePath, parsed);
  else if (command === 'recover') result = await recoverUpload(filePath);
  else {
    const input = await stdinJson();
    result = command === 'upload'
      ? await uploadFile(filePath, { reservation: input.reservation, inspection: input.inspection, ...parsed })
      : await downloadAsset(filePath, { asset: input.asset });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const safe = error instanceof TransferError ? { code: error.code, message: error.message }
      : { code: error.code === 'EEXIST' ? 'FILE_EXISTS' : 'TRANSFER_FAILED', message: error.code === 'EEXIST'
        ? 'The destination already exists. Choose a new path; no existing file was overwritten.' : 'Transfer failed. Preserve any saved upload receipt; inspect it before retrying.' };
    process.stderr.write(`${JSON.stringify(safe)}\n`);
    process.exitCode = 1;
  });
}
