import { validateRemixOutput, type ReferenceText, type RemixOutput } from "./reference-text.ts";
export type RemixFixtureExpectation={brand?:string;required?:string[];requiredAny?:string[];forbidden?:string[];unchanged?:boolean;lineCount?:number};
export function assessHookRemixFixture(output:RemixOutput|null|undefined,source:ReferenceText,expected:RemixFixtureExpectation){
  if(!output)return {pass:false,failures:["not_delivered"]};
  const failures:string[]=[];
  try{validateRemixOutput(output,source);}catch{failures.push("structure_or_length");}
  const text=output.blocks.join("\n");
  if(expected.brand&&!text.includes(expected.brand))failures.push("expected_brand");
  for(const pattern of expected.required??[])if(!new RegExp(pattern,"iu").test(text))failures.push("missing:"+pattern);
  for(const pattern of expected.requiredAny??[])if(!new RegExp(pattern,"iu").test(text))failures.push("missing_any:"+pattern);
  for(const pattern of expected.forbidden??[])if(new RegExp(pattern,"iu").test(text))failures.push("forbidden:"+pattern);
  if(expected.unchanged&&JSON.stringify(output.blocks)!==JSON.stringify(source.blocks.map(b=>b.text)))failures.push("unnecessary_source_rewrite");
  if(expected.lineCount&&text.split("\n").length!==expected.lineCount)failures.push("line_count");
  return {pass:failures.length===0,failures};
}
