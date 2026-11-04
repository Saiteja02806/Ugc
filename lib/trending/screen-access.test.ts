import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {canViewTrendingScreen} from "./screen-access.ts";
import {isAutomaticCarouselGenerationPaused} from "../carousel/generation-hold.ts";

test("only the exact verified account can see Trending",()=>{
  for(const email of ["vtu19403@veltech.edu.in"," VTU19403@VELTECH.EDU.IN "])
    assert.equal(canViewTrendingScreen({email,emailVerified:true}),true);
  for(const email of ["another@veltech.edu.in","vtu19403@veltech.edu.in.evil.test","vtu19403+test@veltech.edu.in","",null,undefined])
    assert.equal(canViewTrendingScreen({email,emailVerified:true}),false);
  for(const emailVerified of [false,null,undefined])
    assert.equal(canViewTrendingScreen({email:"vtu19403@veltech.edu.in",emailVerified}),false);
  assert.equal(canViewTrendingScreen(null),false);assert.equal(canViewTrendingScreen(undefined),false);
});
test("sidebar and dashboard use the same rollout; denied/loading users never mount Trending",()=>{
  const read=(file:string)=>readFileSync(new URL(file,import.meta.url),"utf8");
  const sidebar=read("../../components/layout/app-sidebar.tsx"),gate=read("../../components/trending/trending-screen-access.tsx");
  assert.match(sidebar,/canViewTrendingScreen\(user\)/);
  assert.match(sidebar,/key: "trending", label: "Trending", href: "\/dashboard"/);
  assert.match(gate,/if \(!loading && !allowed\) router.replace\("\/explore"\)/);
  assert.ok(gate.indexOf("if (loading || !allowed)")<gate.indexOf("return <TrendingWorkspace />"));
  assert.match(read("../../app/dashboard/page.tsx"),/<TrendingScreenAccess \/>/);
  assert.doesNotMatch(gate,/localStorage|searchParams|fetch\(/);
});
test("screen visibility does not resume automatic Carousel generation",()=>{
  assert.equal(isAutomaticCarouselGenerationPaused("true"),true);
  assert.equal(isAutomaticCarouselGenerationPaused(""),true);
});
