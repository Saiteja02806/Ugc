import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports={};const jsx=(type,props)=>({type,props});
const imports={'react/jsx-runtime':{jsx,jsxs:jsx},'next/image':{default:'Image'},'lucide-react':{Bookmark:'Bookmark',Sparkles:'Sparkles'},'./image-download-button':{ImageDownloadButton:'Download'},'./influencer-studio.module.css':{default:new Proxy({},{get:(_,key)=>key})}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./influencer-canvas.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert(name in imports,name);return imports[name]}});
const flatten=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(flatten)];
const job={id:'job-owned',isTerminal:true,output:{url:'https://owned/image.png',mediaAssetId:'asset-owned'}};
function render(patch={}){const saved=[];const tree=exports.InfluencerCanvas({userId:'owner',selection:{},activeJobs:[job],isGenerating:false,onSaveCharacter:id=>saved.push(id),savingJobId:null,...patch});return{nodes:flatten(tree),saved}}
test('Save precedes Download with original owned asset and handlers',()=>{
 const h=render(),actions=h.nodes.find(n=>n.props.className==='candidateActions').props.children;
 assert.equal(actions[0].type,'button');assert.equal(actions[0].props.children[1],'Save to My Influencers');assert.equal(actions[0].props.disabled,false);
 actions[0].props.onClick();assert.deepEqual(h.saved,['job-owned']);
 assert.equal(actions[1].type,'Download');assert.equal(actions[1].props.assetId,'asset-owned');assert.equal(actions[1].props.userId,'owner');assert.equal(actions[1].props.label,'Download');
});
test('saved and saving locks remain while download remains available',()=>{
 for(const patch of[{savedCharacterIds:new Set(['asset-owned'])},{savedCharacterIds:new Set(['job-owned'])},{savingJobId:'job-owned'}]){
  const {nodes}=render(patch),actions=nodes.find(n=>n.props.className==='candidateActions').props.children;
  assert.equal(actions[0].props.disabled,true);assert.equal(actions[1].type,'Download');
 }
});
test('loading empty and error states do not expose stale result actions',()=>{
 for(const patch of[{isGenerating:true},{activeJobs:[]},{activeJobs:[{id:'failed',isTerminal:true,status:'failed',error:'Retry later'}]}])assert(!render(patch).nodes.some(n=>n.type==='Download'));
});
