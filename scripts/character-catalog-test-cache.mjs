// Non-build fixture hydration. Binary originals live in backend storage and this ignored local cache only.
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import fingerprints from '../lib/characters/studio-image-fingerprints.json' with {type:'json'};
import {studioCatalogUrl} from '../lib/characters/studio-catalog.ts';
export const catalogCacheRoot=fileURLToPath(new URL('../.tmp/character-catalog/source/',import.meta.url));
export function catalogCacheFile(path){if(!Object.hasOwn(fingerprints,path))throw Error('Unknown catalog fixture');return fileURLToPath(new URL('../.tmp/character-catalog/source'+path,import.meta.url))}
export function readCatalogImage(path){return readFileSync(catalogCacheFile(path))}
export async function ensureCharacterCatalogCache(){
 const entries=Object.entries(fingerprints);let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<entries.length){const[path,hash]=entries[cursor++],file=catalogCacheFile(path);
  if(existsSync(file)&&createHash('sha256').update(readFileSync(file)).digest('hex')===hash)continue;
  const r=await fetch(studioCatalogUrl(path),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Catalog fixture unavailable: '+path);
  const bytes=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Catalog fixture hash mismatch');
  mkdirSync(dirname(file),{recursive:true});const temp=file+'.'+randomUUID();writeFileSync(temp,bytes);renameSync(temp,file);
 }}));
}
