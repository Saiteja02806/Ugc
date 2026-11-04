// Explicit non-build image conversion/upload. Original generation images remain unchanged.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
import {Storage} from '@google-cloud/storage';
import fingerprints from '../lib/characters/studio-image-fingerprints.json' with {type:'json'};
import {ensureCharacterCatalogCache,readCatalogImage} from './character-catalog-test-cache.mjs';
await ensureCharacterCatalogCache();
const require=createRequire(import.meta.url),sdkRequire=createRequire(require.resolve('@google-cloud/storage'));
const {OAuth2Client}=sdkRequire('google-auth-library');
const authClient=new OAuth2Client();authClient.setCredentials({access_token:execFileSync('powershell.exe',['-NoProfile','-Command','gcloud auth print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()});
const bucket=new Storage({projectId:'ugcsaas',authClient}).bucket('ugcsaas-media');
const entries=Object.entries(fingerprints),manifest={},receipts=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<entries.length){const[path,sourceHash]=entries[cursor++];
 const original=readCatalogImage(path);assert.equal(createHash('sha256').update(original).digest('hex'),sourceHash);
 const {data,info}=await sharp(original).rotate().resize({width:384,height:384,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer({resolveWithObject:true});
 const hash=createHash('sha256').update(data).digest('hex');const key=`catalog/character-studio/thumbnails/v1/${hash}.webp`;
 try{await bucket.file(key).save(data,{resumable:false,contentType:'image/webp',preconditionOpts:{ifGenerationMatch:0},metadata:{cacheControl:'public, max-age=31536000, immutable'}})}catch(e){if(e.code!==412)throw e}
 const r=await fetch('https://storage.googleapis.com/ugcsaas-media/'+key,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const downloaded=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(downloaded).digest('hex'),hash);
 manifest[path]={key,sourceSha256:sourceHash,sha256:hash,bytes:data.length,width:info.width,height:info.height};
 receipts.push({path,bytesBefore:original.length,bytesAfter:data.length});if(receipts.length%30===0)console.log('Verified thumbnails:',receipts.length);
}}));
writeFileSync(new URL('../lib/characters/studio-thumbnails.json',import.meta.url),JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()),null,2)+'\n');
mkdirSync(new URL('../.tmp/character-thumbnails/',import.meta.url),{recursive:true});
writeFileSync(new URL('../.tmp/character-thumbnails/receipt.json',import.meta.url),JSON.stringify({verifiedAt:new Date().toISOString(),entries:receipts},null,2));
console.log('All132thumbnailpathsuploadedandhashverified.');
