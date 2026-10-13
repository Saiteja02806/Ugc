import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
function harness({owner='owner-a',state='completed',count=2,edit=null,slides}={}) {
 const exports={},original=slides??[1,2].map(n=>({id:id(n),carouselGenerationId:id(100),slideNumber:n,status:'ready',headline:'Original',subtext:'Original body',renderedUrl:`https://trusted.test/original-${n}`,renderedS3Key:`original/${n}`}));
 const imports={'server-only':{},'@/lib/carousel/db':{getCarouselGenerationStatus:async()=>({generation:{id:id(100),userId:owner,status:state,slideCount:count,selectedAngle:'Ready Carousel'},slides:original})},
   '@/lib/trending/creative-edit-service':{loadSavedTrendingCreativeEditForDownstream:async args=>{assert.equal(args.userId,'owner-a');assert.equal(args.format,'carousel');return edit;}},
   '@/lib/storage/storage':{isTrustedStorageUrl:url=>url.startsWith('https://trusted.test/')}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/library/save-source.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.ok(name in imports,name);return imports[name];}});
 return()=>exports.prepareGeneratedCarouselLibrarySaveForOwner('owner-a',id(100));
}
const readyEdit=()=>({id:id(400),revision:4,renderState:'ready',content:{format:'carousel',slides:[1,2].map(n=>({slideId:id(n),slideNumber:n,headline:`Edited ${n}`,subtext:'Exact edited body',ctaText:'CTA',textPosition:{x:.2,y:.6}}))},renderOutput:{format:'carousel',slides:[1,2].map(n=>({slideNumber:n,renderedUrl:`https://trusted.test/edit-${n}`,renderedS3Key:`edits/4/${n}`}))}});
test('shared website/MCP owner resolver rejects foreign, processing or incomplete generations',async()=>{
 for(const options of [{owner:'owner-b'},{state:'processing'},{count:3}])await assert.rejects(harness(options)(),error=>error.status===(options.owner?404:409));
});
test('shared ready edit preserves exact copy/output/storage keys and normalized placement',async()=>{
 const result=await harness({edit:readyEdit()})();assert.equal(result.edit.revision,4);assert.deepEqual(JSON.parse(JSON.stringify(result.edit.slides[0].textPosition)),{x:.2,y:.6});
 assert.equal(result.slides[0].headline,'Edited 1');assert.equal(result.slides[0].renderedUrl,'https://trusted.test/edit-1');assert.equal(result.slides[0].renderedS3Key,'edits/4/1');
 assert.equal(result.slides[1].subtext,'Exact edited body');
});
test('latest queued/failed/mismatched or unsafe edits never fall back to original slides',async()=>{
 for(const renderState of ['queued','rendering','draft','failed'])await assert.rejects(harness({edit:{...readyEdit(),renderState}})(),error=>error.status===409);
 for(const modify of [e=>e.renderOutput.slides.pop(),e=>e.content.slides[0].slideId=id(99),e=>e.renderOutput.slides[0].renderedUrl='https://attacker.test/image']){const edit=readyEdit();modify(edit);await assert.rejects(harness({edit})(),error=>error.status===409);}
});
test('an unedited owned completed generation retains the original ready ordered slides',async()=>{
 const result=await harness()();assert.equal(result.edit,null);assert.equal(result.slides[0].headline,'Original');assert.equal(result.title,'Ready Carousel');
});
