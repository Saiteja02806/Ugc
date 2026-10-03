
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

test("scheduler execute creates missing job with initialized authentication",()=>{
  const dir=mkdtempSync(path.join(tmpdir(),"dodo-scheduler-test-"));
  try {
    const loader=path.join(dir,"mock.mjs");
    const google=pathToFileURL(path.resolve("node_modules/google-auth-library/build/src/index.js")).href;
    writeFileSync(loader,`
import {mock} from 'node:test';
mock.module(${JSON.stringify(google)}, {namedExports:{GoogleAuth:class{async getRequestHeaders(){return new Headers({authorization:'Bearer fixture'});}}}});
let methods=[];
globalThis.fetch=async(url,init={})=>{
 if(new URL(url).hostname!=='cloudscheduler.googleapis.com')throw new Error('Real network forbidden');
 methods.push(init.method||'GET');
 if((init.method||'GET')==='GET')return new Response('{}',{status:404});
 if(init.method==='POST'){
 const body=JSON.parse(init.body);
 if(body.httpTarget.oidcToken.serviceAccountEmail!=='fixture@project.iam.gserviceaccount.com')throw new Error('Wrong service account');
 console.log('MOCK_METHODS='+methods.join(','));
 return Response.json({name:body.name});
 }
 throw new Error('Unexpected method');
};
`);
    const r=spawnSync(process.execPath,["--experimental-test-module-mocks","--experimental-strip-types","--import",pathToFileURL(loader).href,"scripts/configure-billing-usage-scheduler.mjs","--execute","--yes","--project-id","fixture-project","--service-account-email","fixture@project.iam.gserviceaccount.com"],{encoding:"utf8",timeout:15000});
    assert.equal(r.status,0,r.stderr+r.stdout);
    assert.match(r.stdout,/MOCK_METHODS=GET,POST/);
    assert.match(r.stdout,/Created Cloud Scheduler job/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
