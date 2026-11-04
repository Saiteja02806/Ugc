import assert from 'node:assert/strict';
import test from 'node:test';
import {DEFAULT_INFLUENCER_SELECTION as defaults,ACCESSORIES,toggleInfluencerAccessory as toggle,isInfluencerAccessorySelected as selected} from './influencer-registry.ts';
import {compileInfluencerPrompt} from './master-prompt-compiler.ts';
import {orderedStudioReferences} from './studio-references.ts';

test('No accessories is the default/reset representation with no image reference or positive accessory instruction',()=>{
 assert.deepEqual(defaults.accessoryIds,[]);assert.equal(ACCESSORIES[0].id,'accessory_none');assert.equal(ACCESSORIES[0].isDefault,true);
 assert(selected(defaults.accessoryIds,'accessory_none'));assert(!selected(defaults.accessoryIds,'accessory_headphones'));
 const compiled=compileInfluencerPrompt(defaults);assert.match(compiled.prompt,/No accessories required/);assert(!compiled.displayPills.some(p=>p.category==='Accessory'));
 assert(!orderedStudioReferences(defaults).some(r=>r.role==='accessory'));
});
test('none clears multiple selections; selecting/removing accessories restores the correct state',()=>{
 let state=toggle([],'accessory_headphones');assert.deepEqual(state,['accessory_headphones']);assert(!selected(state,'accessory_none'));
 state=toggle(state,'accessory_glasses');assert.equal(state.length,2);
 state=toggle(state,'accessory_none');assert.deepEqual(state,[]);assert(selected(state,'accessory_none'));
 state=toggle(toggle([],'accessory_headphones'),'accessory_headphones');assert.deepEqual(state,[]);
 assert.deepEqual(toggle(['accessory_none'],'accessory_glasses'),['accessory_glasses']);
});
test('existing explicit accessory selections still supply the same instructions and references',()=>{
 const selection={...defaults,accessoryIds:['accessory_headphones']};
 const compiled=compileInfluencerPrompt(selection);assert.match(compiled.prompt,/wearing sleek minimalist matte-black over-ear headphones/);assert.doesNotMatch(compiled.prompt,/No accessories required/);
 assert(orderedStudioReferences(selection).some(r=>r.id==='accessory_headphones'));
 assert(!orderedStudioReferences({...defaults,accessoryIds:['accessory_none']}).some(r=>r.role==='accessory'));
});
