import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const require = createRequire(import.meta.url);
const run = promisify(execFile);
const ffmpeg = require('ffmpeg-static');
delete process.env.FFPROBE_PATH; // Exercise the server's traced-binary default path.
const { probeStoredMcpUpload } = await import('../lib/mcp/upload-probe.ts');
const { gcsStorageProvider } = await import('../lib/storage/gcs.ts');
function harness(bytes, options={}) {
  gcsStorageProvider.getObject = async () => ({ ContentLength:bytes.length,
    Body:{ transformToWebStream:()=>new ReadableStream({start(controller){
      for(let n=0;n<bytes.length;n+=113) controller.enqueue(bytes.subarray(n,n+113));
      controller.close();
    }}) }});
  return row=>probeStoredMcpUpload({ ...row, metadata:options.private ? {storageLocation:'private_user_media'} : {} });
}
test('server probe measures actual local video and image bytes, rejects forged containers and incomplete streams', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ugc-probe-fixture-'));
  try {
    const video = join(dir,'clip.mp4'), image = join(dir,'image.png');
    await run(ffmpeg, ['-v','error','-f','lavfi','-i','color=c=blue:s=96x160:r=10','-t','1','-an','-c:v','libx264',video], { windowsHide:true });
    await run(ffmpeg, ['-v','error','-f','lavfi','-i','color=c=blue:s=64x96','-frames:v','1',image], { windowsHide:true });
    const vbytes = await readFile(video), ibytes = await readFile(image);
    const vrow = { collection:'video',mime_type:'video/mp4',file_size_bytes:vbytes.length,storage_key:'owned/key' };
    const v = await harness(vbytes)(vrow);
    assert.equal(v.width,96); assert.equal(v.height,160); assert.ok(Math.abs(v.durationSeconds-1)<0.1);
    const i = await harness(ibytes)({ ...vrow,collection:'image',mime_type:'image/png',file_size_bytes:ibytes.length });
    assert.equal(i.width,64); assert.equal(i.height,96); assert.equal(i.durationSeconds,null);
    await assert.rejects(harness(ibytes)({ ...vrow,file_size_bytes:ibytes.length }), e=>e.code==='UNSUPPORTED_MEDIA_TYPE');
    await assert.rejects(harness(vbytes)({ ...vrow,file_size_bytes:vbytes.length+1 }), e=>e.code==='UPLOAD_MISMATCH');
    await assert.rejects(harness(vbytes,{private:true})(vrow), e=>e.code==='UPLOAD_PROBE_UNAVAILABLE');
    await assert.rejects(harness(Buffer.from('#EXTM3U\nhttp://example.test/leak'))({ ...vrow,file_size_bytes:38 }), e=>['UPLOAD_MISMATCH','UNSUPPORTED_MEDIA_TYPE'].includes(e.code));

  } finally { await rm(dir,{recursive:true,force:true}); }
});
