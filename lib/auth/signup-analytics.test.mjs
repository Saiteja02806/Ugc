import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
let events, newUser, failInfo, redirectResult, httpStatus;
const user = { uid: "private-uid", email: "private@example.com", emailVerified: false, displayName: null, photoURL: null, metadata: {}, providerData: [{providerId:"google.com"}] };
const auth = {currentUser:null};
mock.module("../firebase/client.ts", {namedExports:{auth, googleProvider:{}}});
mock.module("../analytics/site-analytics.ts", {namedExports:{trackAccountCreated:(...args)=>events.push(args)}});
mock.module("firebase/auth", {namedExports:{
  getAdditionalUserInfo:()=>{if(failInfo) throw Error("optional analytics failed"); return {isNewUser:newUser};},
  getRedirectResult:async()=>redirectResult,
  signInWithPopup:async()=>({user}), signInWithRedirect:async()=>{}, signOut:async()=>{},
  createUserWithEmailAndPassword:async()=>({user}),
  signInWithEmailAndPassword:async()=>({user}), getIdToken:async()=>"token", reload:async()=>{},
  linkWithCredential:async()=>({user}), EmailAuthProvider:{credential:()=>({})}, onAuthStateChanged:()=>()=>{},
}});
const api = await import("../firebase/auth.ts");
beforeEach(()=>{
  events=[];newUser=false;failInfo=false;redirectResult=null;httpStatus=200;auth.currentUser=null;
  globalThis.fetch=async()=>Response.json({}, {status:httpStatus});
});
test("existing Google and email sign-ins produce no signup conversion",async()=>{
  await api.signInWithGoogle(); await api.signInWithEmail("private@example.com","pw"); assert.equal(events.length,0);
});
test("new Google popup and redirect accounts produce signup events",async()=>{
  newUser=true; await api.signInWithGoogle(); assert.deepEqual(events,[["Google","private-uid"]]);
  events=[];redirectResult={user};await api.trackGoogleRedirectAccountCreated(); assert.deepEqual(events,[["Google","private-uid"]]);
});
test("optional Google metadata failure does not break successful sign-in",async()=>{
  failInfo=true;assert.equal((await api.signInWithGoogle()).uid,"private-uid");assert.equal(events.length,0);
});
test("email counts the created account even when verification delivery fails; credential linking does not count",async()=>{
  httpStatus=503;await assert.rejects(api.signUpWithEmail("private@example.com","pw"));assert.deepEqual(events,[["Email","private-uid"]]);
  events=[];httpStatus=200;auth.currentUser=user;await api.signUpWithEmail("private@example.com","pw");assert.equal(events.length,0);
});
