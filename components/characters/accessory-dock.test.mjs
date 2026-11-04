import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as registry from '../../lib/characters/influencer-registry.ts';
import * as compiler from '../../lib/characters/master-prompt-compiler.ts';
import * as catalog from '../../lib/characters/studio-catalog.ts';

function harness(){
 const values=[],exported={};let cursor=0,selection={...registry.DEFAULT_INFLUENCER_SELECTION},disabled=false;
 const jsx=(type,props)=>({type,props});
 const modules={react:{Fragment:'Fragment',useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],v=>values[i]=typeof v==='function'?v(values[i]):v]},useCallback:fn=>fn,useMemo:fn=>fn()},'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},'next/image':{default:'Image'},'lucide-react':new Proxy({},{get:(_,name)=>name}),'@/lib/characters/influencer-registry':registry,'@/lib/characters/master-prompt-compiler':compiler,'@/lib/characters/studio-catalog':catalog,'./influencer-studio.module.css':{default:new Proxy({},{get:(_,name)=>name})}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./influencer-customizer-dock.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exported,require:name=>{assert(name in modules,name);return modules[name]},Set,Math,Array,URL});
 const render=()=>{cursor=0;return exported.InfluencerCustomizerDock({selection,onSelectionChange:patch=>selection={...selection,...patch},onResetAll:()=>selection={...registry.DEFAULT_INFLUENCER_SELECTION},onRandomize(){},batchSize:1,onBatchSizeChange(){},isGenerating:false,onGenerate(){},disabled})};
 const all=(node)=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(all)];
 const button=title=>all(render()).find(n=>n.type==='button'&&n.props.title===title);
 all(render()).find(n=>n.type==='button'&&n.props.onClick&&JSON.stringify(n.props.children).includes('Accessories')).props.onClick();
 return{button,state:()=>selection,setDisabled:()=>disabled=true,render,all};
}
test('actual dock selects none by default, supports multiple accessories and clearing, and respects busy lock',()=>{
 const h=harness();assert.match(h.button('No accessories').props.className,/traitCardSelected/);
 h.button('Matte Black Headphones').props.onClick();assert.deepEqual(h.state().accessoryIds,['accessory_headphones']);
 assert.doesNotMatch(h.button('No accessories').props.className,/traitCardSelected/);
 h.button('No accessories').props.onClick();assert.equal(h.state().accessoryIds.length,0);
 h.button('Matte Black Headphones').props.onClick();h.button('Matte Black Headphones').props.onClick();assert.match(h.button('No accessories').props.className,/traitCardSelected/);
 h.setDisabled();h.button('Matte Black Headphones').props.onClick();assert.equal(h.state().accessoryIds.length,0);
});

test('layers overlay reveals only two patch variants without selecting the parent; collapse retains selection',()=>{
 const h=harness();assert.equal(h.button('Clear Hydrogel Patches'),undefined);assert.equal(h.button('Rose Pink Patches'),undefined);
 assert(h.button('Gold Hydrogel Patches'));assert(h.button('Smudged Noir Under-Eye'));assert(h.button('Pink Star Patches'));
 const before=h.state().accessoryIds;const show=h.button('Show patch variations');assert.equal(show.props['aria-expanded'],false);
 show.props.onClick();assert.deepEqual(h.state().accessoryIds,before);assert(h.button('Clear Hydrogel Patches'));assert(h.button('Rose Pink Patches'));
 h.button('Clear Hydrogel Patches').props.onClick();assert.deepEqual(h.state().accessoryIds,['accessory_clear_patches']);
 h.button('Hide patch variations').props.onClick();assert.equal(h.button('Clear Hydrogel Patches'),undefined);assert.deepEqual(h.state().accessoryIds,['accessory_clear_patches']);
 assert.match(h.button('Show patch variations').props.className,/variantOverlaySelected/);
 h.setDisabled();h.button('Show patch variations').props.onClick();assert.equal(h.button('Clear Hydrogel Patches'),undefined);
});
