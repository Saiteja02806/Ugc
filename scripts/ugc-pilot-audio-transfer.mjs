import {createHash,randomUUID} from 'node:crypto';
import {open,readFile,rename,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_UPLOAD=3*1024*1024,MAX_DOWNLOAD=12*1024*1024;
const hosts=new Set(['getugcpilot.com','www.getugcpilot.com']);
const types=new Set(['audio/mpeg','audio/wav','audio/mp4','audio/ogg','audio/webm']);
function check(value,message){if(!value)throw Error(message);}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
export function audioMime(bytes){const b=Buffer.from(bytes);return b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE'?'audio/wav':
  b.toString('ascii',0,4)==='OggS'?'audio/ogg':b.toString('ascii',4,8)==='ftyp'?'audio/mp4':
  b.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&b.includes(Buffer.from('webm'))?'audio/webm':
  b.toString('ascii',0,3)==='ID3'||b[0]===255&&(b[1]&224)===224?'audio/mpeg':null;}
async function exactFile(file){const absolute=path.resolve(file),before=await stat(absolute);check(before.isFile()&&before.size>=32&&before.size<=MAX_UPLOAD,'Choose an audio file between 32 bytes and 3 MB.');
  const bytes=await readFile(absolute),after=await stat(absolute);check(before.size===after.size&&before.mtimeMs===after.mtimeMs&&bytes.length===before.size,'Audio file changed while inspecting it.');
  const mime_type=audioMime(bytes.subarray(0,4096));check(types.has(mime_type),'Choose a self-contained MP3, WAV, M4A, OGG or WebM audio recording.');
  return {absolute,bytes,mime_type,file_size_bytes:bytes.length,sha256:sha(bytes)};}
async function saveReceipt(file,value,create=false){const destination=path.resolve(file),temporary=`${destination}.${randomUUID()}.tmp`;let handle,created=false;
  try{handle=await open(create?destination:temporary,'wx',0o600);created=true;await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();await handle.close();handle=null;if(!create)await rename(temporary,destination);}
  catch(error){await handle?.close().catch(()=>{});if(created)await unlink(create?destination:temporary).catch(()=>{});throw error;}}
function cleanInput(input){check(input&&UUID.test(input.request_id)&&typeof input.file_name==='string'&&input.file_name.length>0&&input.file_name.length<=100&&!/[/\\\0]/.test(input.file_name)&&
  types.has(input.mime_type)&&Number.isSafeInteger(input.file_size_bytes)&&input.file_size_bytes>=32&&input.file_size_bytes<=MAX_UPLOAD&&/^[a-f0-9]{64}$/.test(input.sha256)&&['exact','reference'].includes(input.purpose),'Invalid saved audio intent.');
  const clean={request_id:input.request_id,file_name:input.file_name,mime_type:input.mime_type,file_size_bytes:input.file_size_bytes,sha256:input.sha256,purpose:input.purpose};
  check(isDeepStrictEqual(clean,input),'Saved audio intent contains unexpected fields.');return clean;}
async function receipt(file){const value=JSON.parse(await readFile(path.resolve(file),'utf8'));check(value.version===1&&value.kind==='ugc-audio-transfer'&&typeof value.source_path==='string'&&path.isAbsolute(value.source_path)&&['prepared','sending','accepted'].includes(value.stage),'Use a saved audio transfer receipt.');cleanInput(value.input);return value;}
export async function prepareAudioUpload(file,receiptPath,{requestId=randomUUID(),purpose='exact'}={}){
  const inspected=await exactFile(file),input=cleanInput({request_id:requestId,file_name:path.basename(inspected.absolute),mime_type:inspected.mime_type,file_size_bytes:inspected.file_size_bytes,sha256:inspected.sha256,purpose});
  await saveReceipt(receiptPath,{version:1,kind:'ugc-audio-transfer',source_path:inspected.absolute,input,stage:'prepared'},true);
  return {request_id:requestId,receipt_path:path.resolve(receiptPath),create_audio_upload:input};}
function target(value,mode,id){const url=new URL(value);check(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&hosts.has(url.hostname)&&!url.hash,'Use the UGC Pilot application transfer URL.');
  check(url.pathname===(mode==='upload'?'/api/audio/transfer':`/api/audio/delivery/${id}`)&&[...url.searchParams.keys()].length===1&&url.searchParams.has('token'),'Unexpected audio transfer route.');
  const token=url.searchParams.get('token');check(token.length<=4096&&/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(token),'Invalid transfer capability.');
  let payload;try{payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8'));}catch{throw Error('Invalid transfer capability.');}
  const now=Math.floor(Date.now()/1000);check(payload.v===1&&payload.mode===mode&&typeof payload.owner==='string'&&payload.owner.length>0&&Number.isSafeInteger(payload.expires)&&payload.expires>now&&payload.expires<=now+600,'Audio link expired or has an unexpected purpose. Retrieve a fresh link.');
  return {url,payload};}
export async function recoverAudioUpload(receiptPath){const saved=await receipt(receiptPath);return {request_id:saved.input.request_id,get_audio_generation:{request_id:saved.input.request_id},create_audio_upload:saved.input,stage:saved.stage};}
export async function uploadAudio(receiptPath,descriptor,{fetchImpl=fetch}={}){
  const saved=await receipt(receiptPath),input=saved.input,inspected=await exactFile(saved.source_path);
  check(inspected.sha256===input.sha256&&inspected.file_size_bytes===input.file_size_bytes&&inspected.mime_type===input.mime_type,'Audio file differs from the saved intent. Do not reuse its request ID.');
  check(descriptor?.request_id===input.request_id&&descriptor.method==='POST'&&descriptor.headers?.['Content-Type']===input.mime_type&&Object.keys(descriptor.headers).length===1,'Use the upload descriptor returned for this intent.');
  const {url,payload}=target(descriptor.url,'upload');check(isDeepStrictEqual(payload.input,input)&&new Date(payload.expires*1000).toISOString()===descriptor.expires_at,'Upload capability does not match the saved intent.');
  await saveReceipt(receiptPath,{...saved,stage:'sending'});
  const response=await fetchImpl(url,{method:'POST',headers:descriptor.headers,body:inspected.bytes,redirect:'error',signal:AbortSignal.timeout(120000)});
  check(response.status===202,'Audio transfer was not confirmed. Preserve the receipt and check get_audio_generation before retrying.');
  const result=await response.json();check(result.request_id===input.request_id&&result.asset_id===input.request_id&&UUID.test(result.generation_id),'Audio acknowledgement does not match the saved intent. Recover its status.');
  await saveReceipt(receiptPath,{...saved,stage:'accepted',generation_id:result.generation_id,asset_id:result.asset_id});
  return {request_id:input.request_id,generation_id:result.generation_id,asset_id:result.asset_id,stage:'accepted'};
}
export async function downloadAudio(outputPath,result,{fetchImpl=fetch}={}){
  const asset=result?.asset,download=result?.download;check(UUID.test(asset?.id)&&asset.status==='ready'&&download&&types.has(download.mime_type)&&Number.isSafeInteger(download.file_size_bytes)&&download.file_size_bytes>=32&&download.file_size_bytes<=MAX_DOWNLOAD&&/^[a-f0-9]{64}$/.test(download.sha256),'Retrieve a ready owned audio asset and fresh download descriptor.');
  const {url,payload}=target(download.url,'download',asset.id);check(payload.asset_id===asset.id&&payload.sha256===download.sha256&&payload.size===download.file_size_bytes&&payload.mime_type===download.mime_type&&new Date(payload.expires*1000).toISOString()===download.expires_at,'Download capability does not match this audio asset.');
  const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(60000)});check(response.status===200&&response.body,'Audio download is unavailable. Retrieve a fresh link.');
  const mime=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase(),length=response.headers.get('content-length');
  if(mime!==download.mime_type||length!==null&&Number(length)!==download.file_size_bytes){await response.body.cancel();throw Error('Audio download metadata does not match.');}
  const destination=path.resolve(outputPath);let handle,created=false,total=0,head=Buffer.alloc(0);const hash=createHash('sha256'),reader=response.body.getReader();
  try{handle=await open(destination,'wx',0o600);created=true;
    while(true){const next=await reader.read();if(next.done)break;total+=next.value.length;check(total<=download.file_size_bytes&&total<=MAX_DOWNLOAD,'Audio download exceeds its approved size.');
      hash.update(next.value);if(head.length<4096)head=Buffer.concat([head,Buffer.from(next.value)]).subarray(0,4096);
      let offset=0;while(offset<next.value.length){const wrote=await handle.write(next.value,offset,next.value.length-offset);check(wrote.bytesWritten>0,'Audio file write failed.');offset+=wrote.bytesWritten;}}
    check(total===download.file_size_bytes&&hash.digest('hex')===download.sha256&&audioMime(head)===download.mime_type,'Audio download bytes failed verification.');await handle.sync();await handle.close();handle=null;
    return {asset_id:asset.id,path:destination,bytes:total,sha256:download.sha256,test_only:asset.test_only};
  }catch(error){await handle?.close().catch(()=>{});if(created)await unlink(destination).catch(()=>{});throw error;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function stdin(){let text='';for await(const part of process.stdin){text+=String(part);check(Buffer.byteLength(text)<=65536,'Transfer metadata is too large. Do not put audio bytes on stdin.');}return JSON.parse(text||'{}');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const [command,...args]=process.argv.slice(2);let result;
    if(command==='prepare'){check(args.length>=2&&args.length<=4,'prepare <audio-file> <receipt-file> [exact|reference] [request-uuid]');result=await prepareAudioUpload(args[0],args[1],{purpose:args[2]??'exact',...(args[3]?{requestId:args[3]}:{})});}
    else if(command==='recover'){check(args.length===1,'recover <receipt-file>');result=await recoverAudioUpload(args[0]);}
    else if(command==='upload'){check(args.length===1,'upload <receipt-file>, descriptor JSON on stdin');result=await uploadAudio(args[0],await stdin());}
    else if(command==='download'){check(args.length===1,'download <new-output-file>, get_audio_asset JSON on stdin');result=await downloadAudio(args[0],await stdin());}
    else throw Error('Use prepare, recover, upload or download.');process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){process.stderr.write(JSON.stringify({error:error.message})+'\n');process.exitCode=1;}
}
