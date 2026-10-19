import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source=readFileSync(new URL('../../components/trending/trending-workspace.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('workspace.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let disabledExpression,handler;
function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='reviewEditDisabled')disabledExpression=node.initializer.getText(ast);
  if(ts.isFunctionDeclaration(node)&&node.name?.text==='handleEditActiveCandidate')handler=node.getText(ast);
  ts.forEachChild(node,visit);
}
visit(ast);
const expression=ts.transpileModule(`const result=${disabledExpression}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const handlerCode=ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test('Edit reopens an existing carousel in review history but keeps transitions, foreign formats and unedited history gated',()=>{
  for(const [format,browsing,saved,transition,expected] of [
    ['carousel',true,true,null,false],['carousel',true,false,null,true],['carousel',false,false,null,false],
    ['carousel',true,true,'left',true],['hook_video',true,true,null,true],['wall_text',true,true,null,true],['reaction',true,true,null,true],
  ]){
    const candidate={format,item:{creativeId:'creative'}};
    const disabled=new Function('activeCandidate','postHistory','exitDirection','editByCreativeId','getLatestTrendingEdit',`${expression};return result`)(candidate,{browsing},transition,saved?{creative:{id:'edit'}}:{},(a,b)=>a??b);
    assert.equal(disabled,expected);
    let opened=null;
    const run=new Function('activeCandidate','reviewEditDisabled','decisionLockRef','dismissSwipeGuide','setEditorCandidate',`${handlerCode};return handleEditActiveCandidate`)(candidate,disabled,{current:false},()=>false,value=>{opened=value;});
    run();assert.equal(opened,disabled?null:candidate);
  }
  assert.match(source,/<CreativeEditAction\s+disabled=\{reviewEditDisabled\}/);
});
