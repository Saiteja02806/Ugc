import {readFile,open,lstat,realpath} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import {basename,resolve} from "node:path";
import {pathToFileURL} from "node:url";

function check(condition,code,message){if(!condition)throw Object.assign(new Error(message),{code});}
function sniff(bytes){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
 if(bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "image/webp";
 throw Object.assign(new Error("Choose a PNG, JPEG or WebP business logo."),{code:"INVALID_LOGO"});
}
export async function inspectLogo(file){
 const source=resolve(file),stat=await lstat(source);check(stat.isFile()&&!stat.isSymbolicLink(),"INVALID_FILE","Choose a regular local logo file.");
 check(stat.size>0&&stat.size<=2097152,"INVALID_LOGO","Choose a logo of at most 2 MB.");
 const path=await realpath(source),bytes=await readFile(path),after=await lstat(source);
 check(bytes.length===stat.size&&after.size===stat.size&&after.mtimeMs===stat.mtimeMs,"FILE_CHANGED","The logo changed during inspection. Inspect it again.");
 const name=basename(path);check(name.length>0&&name.length<=255&&!/[\\/\0]/.test(name),"INVALID_FILE","Choose a filename without folder paths.");
 return {path,bytes,mime_type:sniff(bytes),file_name:name,file_size_bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
}
async function durableNew(path,value){const handle=await open(path,"wx",0o600);try{await handle.writeFile(JSON.stringify(value,null,2)+"\n");await handle.sync();}finally{await handle.close();}}
export async function prepareLogo(file,receiptPath){
 const image=await inspectLogo(file),request_id=randomUUID(),input={request_id,file_name:image.file_name,mime_type:image.mime_type,file_size_bytes:image.file_size_bytes,sha256:image.sha256};
 const receipt={version:1,kind:"business_logo",file:image.path,input,upload_id:null};
 await durableNew(resolve(receiptPath),receipt);
 return {request_id,create_business_logo_upload:input,receipt_path:resolve(receiptPath),confirmation_required:true};
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function transferLogo(receiptPath,response,fetcher=globalThis.fetch){
 const path=resolve(receiptPath),stat=await lstat(path);check(stat.isFile()&&!stat.isSymbolicLink(),"INVALID_RECEIPT","Choose the saved local logo receipt.");
 const saved=JSON.parse(await readFile(path,"utf8")),upload=response?.upload,lease=response?.lease;
 check(saved.version===1&&saved.kind==="business_logo"&&uuid.test(saved.input?.request_id??""),"INVALID_RECEIPT","This is not a saved business logo intent.");
 check(upload&&upload.request_id===saved.input.request_id&&uuid.test(upload.upload_id??"")&&lease?.upload_id===upload.upload_id,"UPLOAD_MISMATCH","Recover the same logo reservation and its current link.");
 for(const key of ["file_name","mime_type","file_size_bytes","sha256"])check(upload[key]===saved.input[key],"UPLOAD_MISMATCH","The reservation differs from the saved logo intent.");
 check(!saved.upload_id||saved.upload_id===upload.upload_id,"UPLOAD_MISMATCH","The receipt is bound to another logo reservation.");
 check(upload.status==="uploading","ALREADY_VERIFIED","Recover the verified logo instead of transferring again.");
 const image=await inspectLogo(saved.file);check(image.sha256===saved.input.sha256&&image.file_size_bytes===saved.input.file_size_bytes&&image.mime_type===saved.input.mime_type,"FILE_CHANGED","The local logo differs from its saved intent. Recover this reservation before choosing another file.");
 const url=new URL(lease.upload_url),headers=lease.required_headers;
 check(url.protocol==="https:"&&url.hostname==="storage.googleapis.com"&&!url.username&&!url.password&&!url.hash&&(!url.port||url.port==="443")&&/^\/[^/]+\/business-profile-logos\/[a-f0-9]{64}\/[a-f0-9-]+\.(png|jpg|webp)$/.test(url.pathname),"INVALID_DESTINATION","Use the create-only UGC Pilot logo link from the connected tool.");
 check(url.searchParams.get("X-Goog-Algorithm")==="GOOG4-RSA-SHA256"&&!!url.searchParams.get("X-Goog-Signature"),"INVALID_DESTINATION","Use the current signed GCS logo link.");
 check(headers&&Object.keys(headers).sort().join(",")==="Content-Type,x-goog-content-length-range,x-goog-if-generation-match"&&headers["Content-Type"]===saved.input.mime_type&&headers["x-goog-content-length-range"]===`1,${saved.input.file_size_bytes}`&&headers["x-goog-if-generation-match"]==="0","INVALID_DESTINATION","Preserve the logo link's exact create-only MIME and byte-limit headers.");
 const expiry=Date.parse(lease.expires_at);check(Number.isFinite(expiry)&&expiry>Date.now()&&expiry<=Date.now()+601000,"LINK_EXPIRED","Renew the same reservation's logo link.");
 // Bind durable identity before transfer; URLs and signatures never enter disk.
 const bindingPath=path+".transfer.json",binding={version:1,kind:"business_logo_transfer",upload_id:upload.upload_id,request_id:saved.input.request_id,sha256:saved.input.sha256};
 try{await durableNew(bindingPath,binding);}catch(error){
  if(error.code!=="EEXIST")throw error;
  const record=await lstat(bindingPath);check(record.isFile()&&!record.isSymbolicLink(),"INVALID_RECEIPT","Choose the existing regular logo transfer receipt.");
  const previous=JSON.parse(await readFile(bindingPath,"utf8"));check(previous.version===binding.version&&previous.kind===binding.kind&&previous.upload_id===binding.upload_id&&previous.request_id===binding.request_id&&previous.sha256===binding.sha256,"UPLOAD_MISMATCH","The saved transfer receipt belongs to another reservation.");
 }
 let result;try{result=await fetcher(url.href,{method:"PUT",headers,body:image.bytes,redirect:"error",signal:AbortSignal.timeout(60000)});}
 catch{throw Object.assign(new Error("The transfer acknowledgement is uncertain. Confirm the same logo upload ID before any transfer retry."),{code:"TRANSFER_UNCONFIRMED",upload_id:upload.upload_id});}
 check(result.ok||result.status===412,"TRANSFER_UNCONFIRMED","Transfer was not confirmed. Recover and confirm this same upload ID before retrying.");
 return {upload_id:upload.upload_id,transfer:result.status===412?"bytes_already_present":"sent",confirmation_required:true,confirm_business_logo_upload:{upload_id:upload.upload_id}};
}
async function stdin(){let body="";for await(const chunk of process.stdin){body+=chunk;check(body.length<=32768,"INVALID_INPUT","Upload response is too large.");}return JSON.parse(body);}
async function main(){
 const [command,...args]=process.argv.slice(2),values={};for(let n=0;n<args.length;n+=2){check(args[n]?.startsWith("--")&&args[n+1],"INVALID_INPUT","Use named file/receipt options.");values[args[n].slice(2)]=args[n+1];}
 if(command==="prepare"){check(values.file&&values.receipt,"INVALID_INPUT","Use prepare --file PATH --receipt NEW_RECEIPT.");return prepareLogo(values.file,values.receipt);}
 if(command==="upload"){check(values.receipt,"INVALID_INPUT","Use upload --receipt SAVED_RECEIPT and send upload/lease JSON through stdin.");return transferLogo(values.receipt,await stdin());}
 throw Object.assign(new Error("Use prepare --file PATH --receipt NEW_RECEIPT, then upload --receipt SAVED_RECEIPT with tool JSON on stdin."),{code:"INVALID_INPUT"});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){main().then(output=>process.stdout.write(JSON.stringify(output)+"\n")).catch(error=>{process.stderr.write(JSON.stringify({code:error.code??"TRANSFER_UNCONFIRMED",message:error.code?error.message:"Could not complete the logo transfer. Preserve its saved receipt.",...(error.upload_id?{upload_id:error.upload_id}:{})})+"\n");process.exitCode=1;});}
