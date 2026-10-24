import assert from "node:assert/strict";
import test from "node:test";
import { createWorkflowSession, serializeWorkflowSession, workflowSessionStorageKey } from "./workflow-session.ts";
import { createWorkflowDraft, draftEntryIntent, listWorkflowDrafts, markWorkflowDraftScheduled, workflowDraftState, workflowDraftStorage, workflowDraftRequestStorage, workflowRequestDraft } from "./workflow-draft-lifecycle.ts";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function store() { const values = new Map(); return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; }

test("entry intent uses navigation and explicit choice, never elapsed time", () => {
  const base={id:id(1),explicitResume:false,navigationType:"navigate",discarded:false,activeId:id(1)};
  assert.equal(draftEntryIntent({...base,id:null}),"new");
  assert.equal(draftEntryIntent({...base,id:"invalid"}),"new");
  assert.equal(draftEntryIntent(base),"ask","Reopening a closed tab URL cannot silently resume");
  assert.equal(draftEntryIntent({...base,navigationType:"reload"}),"reload");
  assert.equal(draftEntryIntent({...base,navigationType:"reload",activeId:null}),"ask","A copied tab has no automatic authority");
  assert.equal(draftEntryIntent({...base,navigationType:"reload",discarded:true}),"ask","Discarded/crashed page needs a choice");
  assert.equal(draftEntryIntent({...base,navigationType:"back_forward"}),"ask");
  assert.equal(draftEntryIntent({...base,explicitResume:true}),"resume");
});
test("independent work IDs retain exact drafts without importing the owner's last workflow", () => {
  const storage=store(), key=workflowSessionStorageKey("owner-a");
  const first={...createWorkflowSession("owner-a"),section:"edit",generatedAssetId:id(11),demoAssetId:id(12),instructions:"First task"};
  createWorkflowDraft(storage,"owner-a",id(1),first);
  assert.equal(workflowDraftStorage(storage,id(2)).getItem(key),null);
  const second={...createWorkflowSession("owner-a"),instructions:"Second task"};
  createWorkflowDraft(storage,"owner-a",id(2),second);
  assert.equal(workflowDraftStorage(storage,id(1)).getItem(key),serializeWorkflowSession(first));
  assert.equal(workflowDraftStorage(storage,id(1)).getItem(workflowSessionStorageKey("owner-b")),null);
  assert.deepEqual(listWorkflowDrafts(storage,"owner-a").map(d=>d.id).sort(),[id(1),id(2)]);
  assert.deepEqual(listWorkflowDrafts(storage,"owner-b"),[]);
});
test("scheduling marks only its own draft and later snapshot updates retain completion", () => {
  const storage=store(), first={...createWorkflowSession("owner-a"),instructions:"Ready"};
  createWorkflowDraft(storage,"owner-a",id(1),first);createWorkflowDraft(storage,"owner-a",id(2),first);
  markWorkflowDraftScheduled(storage,"owner-a",id(1));
  createWorkflowDraft(storage,"owner-a",id(1),{...first,section:"schedule"});
  assert.equal(workflowDraftState(storage,"owner-a",id(1)),"scheduled");
  assert.equal(workflowDraftState(storage,"owner-a",id(2)),"editing");
  assert.equal(workflowDraftState(storage,"owner-b",id(1)),null);
});
test("corrupt snapshots do not hide other drafts or substitute an unrelated video", () => {
  const storage=store();createWorkflowDraft(storage,"owner-a",id(1),{...createWorkflowSession("owner-a"),instructions:"Good"});
  const key=[...storage.values.keys()][0];storage.setItem(key.replace(id(1),id(2)),"{");
  assert.throws(()=>workflowDraftStorage(storage,id(2)).getItem(workflowSessionStorageKey("owner-a")));
  assert.equal(listWorkflowDrafts(storage,"owner-a").length,1);
  assert.throws(()=>workflowDraftStorage(storage,"../bad").setItem("a","b"));
});
test("paid-request origin is persisted before submission and remains after receipt resolution", () => {
  const storage=store(), key="owner-a:pending-generation", requestKey=id(8);
  const requestStorage=workflowDraftRequestStorage(storage,key,id(1));
  requestStorage.setItem(key,JSON.stringify({requestKey}));
  assert.equal(workflowRequestDraft(storage,key,requestKey),id(1));
  requestStorage.removeItem(key);
  assert.equal(storage.getItem(key),null);assert.equal(workflowRequestDraft(storage,key,requestKey),id(1));
  assert.equal(workflowRequestDraft(storage,"owner-b:pending-generation",requestKey),null);
  const failing={...storage,setItem(key,value){if(key.includes(":draft:"))throw Error("full");storage.setItem(key,value);}};
  assert.throws(()=>workflowDraftRequestStorage(failing,key,id(2)).setItem(key,JSON.stringify({requestKey:id(9)})),/full/);
  assert.equal(storage.getItem(key),null,"Cannot start a request without recording which work it belongs to");
});
