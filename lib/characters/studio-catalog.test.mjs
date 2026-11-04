import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import fingerprints from './studio-image-fingerprints.json' with {type:'json'};
import thumbnails from './studio-thumbnails.json' with {type:'json'};
import {ALL_TRAITS} from './influencer-registry.ts';
import {studioCatalogUrl,studioTraitImageUrl,STUDIO_CATALOG_ORIGIN} from './studio-catalog.ts';
import {GET} from '../../app/explore/influencer-studio/[...asset]/route.ts';

test('all catalog images resolve to immutable backend objects; registered IDs stay logical',()=>{
 assert.equal(Object.keys(fingerprints).length,132);
 for(const [path,hash]of Object.entries(fingerprints))assert.equal(studioCatalogUrl(path),STUDIO_CATALOG_ORIGIN+hash+path.slice(path.lastIndexOf('.')));
 for(const trait of ALL_TRAITS)if(trait.imagePath&&!trait.isCustomUpload)assert(studioTraitImageUrl(trait).startsWith('https://storage.googleapis.com/ugcsaas-media/catalog/character-studio/thumbnails/v1/'));
 const dock=readFileSync(new URL('../../components/characters/influencer-customizer-dock.tsx',import.meta.url),'utf8');assert.match(dock,/src=\{studioTraitImageUrl\(trait\)!\}/);
});

test('every card has a version-matched small thumbnail while generation retains original URLs',()=>{
 assert.deepEqual(Object.keys(thumbnails).sort(),Object.keys(fingerprints).sort());
 for(const[path,thumb]of Object.entries(thumbnails)){
  assert.equal(thumb.sourceSha256,fingerprints[path]);assert(thumb.width<=384&&thumb.height<=384);assert(thumb.bytes<80000);
  assert.equal(thumb.key,`catalog/character-studio/thumbnails/v1/${thumb.sha256}.webp`);
  assert.notEqual(studioTraitImageUrl({imagePath:path}),studioCatalogUrl(path));
 }
 const dock=readFileSync(new URL('../../components/characters/influencer-customizer-dock.tsx',import.meta.url),'utf8');assert.match(dock,/className=\{styles.cardImage\}\s+unoptimized/);
});
test('arbitrary URLs, traversal and prototype names fail closed; personal uploads retain existing URLs',()=>{
 for(const p of ['https://evil.test/a.png','/explore/influencer-studio/../secret.png','toString','__proto__'])assert.throws(()=>studioCatalogUrl(p));
 assert.equal(studioTraitImageUrl({imagePath:'blob:my-face',isCustomUpload:true}),'blob:my-face');
 assert.equal(studioTraitImageUrl({}),undefined);
});
test('historical catalog URLs redirect to exact cloud objects; unknown paths are 404',async()=>{
 for(const path of Object.keys(fingerprints)){
  const response=await GET(new Request('https://vidmake.io'+path),{params:Promise.resolve({asset:path.replace('/explore/influencer-studio/','').split('/')})});
  assert.equal(response.status,308);assert.equal(response.headers.get('location'),studioCatalogUrl(path));
 }
 assert.equal((await GET(new Request('https://vidmake.io'),{params:Promise.resolve({asset:['unknown.png']})})).status,404);
});
test('catalog originals are absent from the website public directory',()=>{
 for(const path of Object.keys(fingerprints))assert.equal(existsSync(new URL('../../public'+path,import.meta.url)),false,path);
});
