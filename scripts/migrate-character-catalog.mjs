// Explicit maintenance command. Uploads immutable originals, verifies bytes, then records the receipt.
// Does not delete local files, change cloud policy, build or deploy.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Storage} from '@google-cloud/storage';
import pathModule from 'node:path';
import fingerprints from '../lib/characters/studio-image-fingerprints.json' with {type:'json'};
const require=createRequire(import.meta.url),sdkRequire=createRequire(require.resolve('@google-cloud/storage'));
const {OAuth2Client}=sdkRequire('google-auth-library');
const authClient=new OAuth2Client();
authClient.setCredentials({access_token:execFileSync('powershell.exe',['-NoProfile','-Command','gcloud auth print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()});
const bucket=new Storage({projectId:'ugcsaas',authClient}).bucket('ugcsaas-media');
// Source root mirrors logical /explore/... paths. Defaults to the ignored maintenance/test cache.
const sourceRoot=pathModule.resolve(process.argv[2]??'.tmp/character-catalog/source');
const entries=Object.entries(fingerprints),receipt=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<entries.length){const [path,digest]=entries[cursor++];
  const source=pathModule.resolve(sourceRoot,'.'+path);
  assert(source.startsWith(sourceRoot+pathModule.sep),'Source path escapes supplied directory');
  const bytes=readFileSync(source);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,path);
  const ext=path.slice(path.lastIndexOf('.')),key=`catalog/character-studio/v1/${digest}${ext}`;
  const contentType=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';
  try{await bucket.file(key).save(bytes,{resumable:false,contentType,preconditionOpts:{ifGenerationMatch:0},metadata:{cacheControl:'public, max-age=31536000, immutable'}})}catch(error){if(error.code!==412)throw error}
  const url='https://storage.googleapis.com/ugcsaas-media/'+key;
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200,path);
  const downloaded=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(downloaded).digest('hex'),digest,path);
  assert.equal(downloaded.length,bytes.length);receipt.push({path,key,url,sha256:digest,bytes:bytes.length});
  if(receipt.length%20===0)console.log(`Verified ${receipt.length}/${entries.length}`);
 }
}));
mkdirSync(new URL('../.tmp/character-catalog/',import.meta.url),{recursive:true});
writeFileSync(new URL('../.tmp/character-catalog/upload-receipt.json',import.meta.url),JSON.stringify({verifiedAt:new Date().toISOString(),entries:receipt.sort((a,b)=>a.path.localeCompare(b.path))},null,2));
console.log(`Verified all ${receipt.length} shared catalog objects. No local files removed.`);
