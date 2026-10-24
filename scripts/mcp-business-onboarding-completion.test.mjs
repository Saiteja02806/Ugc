import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {test,mock} from "node:test";
let profile=null,prebuilds=[],fail=false;
mock.module("../lib/business-profiles/db.ts",{namedExports:{getBusinessProfileForUser:async owner=>{assert.equal(owner,"owner-a");return profile;},isBusinessProfileOnboardingComplete:p=>p.onboardingStatus==="completed"&&p.onboardingVersion===3}});
mock.module("../lib/trending/hook-video-feature.ts",{namedExports:{areTrendingHookVideosEnabled:()=>false}});
mock.module("../lib/trending/onboarding-prebuild.ts",{namedExports:{prebuildTrendingAfterOnboarding:async input=>{prebuilds.push(input);return [{format:"daily_feed",status:fail?"failed":"scheduled"}];}}});
const {finalizeLegacyOnboardingPreparation}=await import("../lib/business-profiles/onboarding-completion.ts");
const input={profileId:randomUUID(),profileVersion:3,timezone:"Asia/Calcutta"};
test("durable legacy completion prepares current owned profile with accepted timezone",async()=>{
 profile={id:input.profileId,profileVersion:3,onboardingStatus:"completed",onboardingVersion:3,userId:"owner-a"};prebuilds=[];
 const result=await finalizeLegacyOnboardingPreparation("owner-a",input);assert.equal(result.profileId,input.profileId);assert.deepEqual(prebuilds,[{profile,timezone:"Asia/Calcutta",includeHookVideos:false}]);
});
test("missing, changed or incomplete profile cannot prepare content",async()=>{
 for(const candidate of [null,{id:randomUUID(),profileVersion:3},{id:input.profileId,profileVersion:4}]){profile=candidate;prebuilds=[];assert.equal((await finalizeLegacyOnboardingPreparation("owner-a",input)).skipped,"superseded");assert.equal(prebuilds.length,0);}
 profile={id:input.profileId,profileVersion:3,onboardingStatus:"incomplete",onboardingVersion:0};prebuilds=[];await assert.rejects(finalizeLegacyOnboardingPreparation("owner-a",input),/unavailable/);assert.equal(prebuilds.length,0);
});
test("failed Trending preparation remains a failed durable job eligible for existing recovery policy",async()=>{
 profile={id:input.profileId,profileVersion:3,onboardingStatus:"completed",onboardingVersion:3};fail=true;
 try{await assert.rejects(finalizeLegacyOnboardingPreparation("owner-a",input),/needs a retry/);}finally{fail=false;}
});
