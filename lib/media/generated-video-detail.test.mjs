import assert from "node:assert/strict";
import { mock, test, beforeEach } from "node:test";
let signedIn = true, exists = true, jobType = "generate_hook_video", reads = 0;
class AuthError extends Error { constructor() { super("Sign in"); this.status=401; } }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError:AuthError, requireFirebaseUser:async()=>{if(!signedIn)throw new AuthError();return {uid:"owner"};} } });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getBackgroundJobForUser:async params=>{
  assert.deepEqual(params,{jobId:"original-job",userId:"owner"});reads++;return {jobType,input:{hookIdea:"Exact original animation prompt",model:"google_omni",resolution:"720p"}};
} } });
mock.module("@/lib/media/media-storage", { namedExports: {
  getMediaAssetForOwner:async params=>{assert.deepEqual(params,{assetId:"video",userId:"owner"});return exists?{source_record_id:"original-job",source_type:"generated_video"}:null;},
  serializeMediaAsset:()=>({id:"video",metadata:{existing:true}}),
  softDeleteMediaAsset:()=>assert.fail(),updateMediaAssetForOwner:()=>assert.fail(),
} });
const {GET}=await import("../../app/api/media/[assetId]/route.ts");
const request=(details=false)=>GET(new Request(`https://www.getugcpilot.com/api/media/video${details?"?generationDetails=1":""}`),{params:Promise.resolve({assetId:"video"})});
beforeEach(()=>{signedIn=true;exists=true;jobType="generate_hook_video";reads=0;});
test("ordinary video reads retain their fast path without a generation-job lookup",async()=>{
  const result=await (await request()).json();assert.deepEqual(result.asset.metadata,{existing:true});assert.equal(reads,0);
});
test("explicit result details recover the original owned prompt without exposing raw job input",async()=>{
  const result=await (await request(true)).json();assert.equal(result.asset.metadata.prompt,"Exact original animation prompt");assert.equal(result.asset.metadata.model,"google_omni");assert.equal(reads,1);assert.equal(result.asset.metadata.input,undefined);
});
test("authentication and asset ownership are required before reading a saved prompt",async()=>{
  signedIn=false;assert.equal((await request(true)).status,401);assert.equal(reads,0);
  signedIn=true;exists=false;assert.equal((await request(true)).status,404);assert.equal(reads,0);
});
test("an unrelated job cannot supply generated-video prompt metadata",async()=>{
  jobType="generate_image";const result=await (await request(true)).json();assert.deepEqual(result.asset.metadata,{existing:true});
});
