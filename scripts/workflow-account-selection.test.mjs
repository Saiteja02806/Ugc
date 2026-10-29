import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWorkflowAccount, toggleWorkflowPlatform, workflowSelectedAccountIds, workflowScheduleTargets, workflowAccountSelectionError } from '../lib/explore/workflow-scheduling-draft.ts';
import { formatScheduleDraftKey, readFormatScheduleDraft, serializeFormatScheduleDraft } from '../lib/explore/format-schedule-draft.ts';
import { readScheduleReceipt, verifySavedSchedule } from '../lib/explore/workflow-schedule-client.ts';
import { prepareSimpleWorkflowSchedule } from '../lib/explore/simple-workflow-schedule.ts';
import { loadWorkflowConnectedAccounts } from '../lib/explore/workflow-connected-accounts.ts';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const blank = { platform: 'instagram', platforms: ['instagram','tiktok'], caption: 'My exact caption', date: '2099-12-01', time: '21:30', timezone: 'Asia/Kolkata', connectionIds: {} };
const selected = () => [['instagram',1],['instagram',2],['tiktok',3],['tiktok',4]].reduce((draft,[platform,n])=>selectWorkflowAccount(draft,platform,id(n)),blank);
const key = formatScheduleDraftKey({ environment: 'live', owner: 'owner', format: 'hook', output: { kind: 'media_asset', id: id(50) } });

test('same-platform accounts toggle independently, including clear/reselect and reload', () => {
  let draft = selected();
  assert.equal(workflowScheduleTargets(draft).length,4);
  draft = selectWorkflowAccount(draft,'instagram',id(1));
  assert.deepEqual(workflowSelectedAccountIds(draft),{ instagram:[id(2)],tiktok:[id(3),id(4)] });
  draft = selectWorkflowAccount(draft,'instagram',id(2));
  assert.deepEqual(draft.accountIds.instagram,[]);assert.match(workflowAccountSelectionError(draft),/at least one/);
  const restored = readFormatScheduleDraft(serializeFormatScheduleDraft(key,draft),key);
  assert.deepEqual(restored.accountIds.instagram,[]);assert.equal(restored.connectionIds.instagram,'');
  draft = selectWorkflowAccount(restored,'instagram',id(2));
  assert.equal(workflowScheduleTargets(draft).length,3);
  for(const field of ['caption','date','time','timezone']) assert.equal(draft[field],blank[field]);
  const removed = toggleWorkflowPlatform(draft,'tiktok');assert.deepEqual(removed.accountIds,{instagram:[id(2)]});
  assert.equal(readFormatScheduleDraft(serializeFormatScheduleDraft(key,draft),key+':other-owner'),null);
});
test('legacy selections remain readable and deliberate blank choices are preserved', () => {
  const legacy={...blank,connectionIds:{instagram:id(1),tiktok:id(3)}};
  const cleared=selectWorkflowAccount(legacy,'instagram',id(1));assert.deepEqual(cleared.accountIds.instagram,[]);
  const legacyBlank={...legacy,connectionIds:{instagram:'',tiktok:id(3)}};
  assert.equal(readFormatScheduleDraft(serializeFormatScheduleDraft(key,legacyBlank),key).connectionIds.instagram,'');
  assert.equal(workflowScheduleTargets(legacy).length,2);assert.equal(legacy.accountIds,undefined);
});
test('five-account server limit is explicit and deselection immediately restores readiness', () => {
  let draft=selectWorkflowAccount(selected(),'instagram',id(5));assert.equal(workflowScheduleTargets(draft).length,5);
  draft=selectWorkflowAccount(draft,'tiktok',id(6));assert.match(workflowAccountSelectionError(draft),/up to 5/);
  assert.equal(workflowScheduleTargets(draft).length,0);assert.equal(draft.accountIds.tiktok.length,3);
  draft=selectWorkflowAccount(draft,'tiktok',id(6));assert.equal(workflowScheduleTargets(draft).length,5);
  assert.equal(workflowScheduleTargets({...draft,accountIds:{instagram:[id(1)],tiktok:[id(1)]}}).length,0);
  const raw=JSON.stringify({version:1,key,draft:{...draft,accountIds:{instagram:'wrong'}}});assert.equal(readFormatScheduleDraft(raw,key),null);
});
test('direct scheduling receipts retain five distinct accounts including repeated platforms', () => {
  const targets=workflowScheduleTargets(selectWorkflowAccount(selected(),'instagram',id(5)));
  const saved={version:1,owner:'owner',kind:'hook',input:{source:{kind:'media_asset',id:id(50)},targets,caption:'Exact',timezone:'Asia/Kolkata',scheduledFor:'2099-12-01T16:00:00Z',idempotencyKey:`explore:${id(99)}`}};
  assert.deepEqual(readScheduleReceipt(JSON.stringify(saved),'owner','hook'),saved);
  const schedule={id:id(60),mediaAssetId:id(50),idempotencyKey:saved.input.idempotencyKey,status:'scheduled',targets:targets.map((target,i)=>({id:id(70+i),socialConnectionId:target.connectionId,platform:target.platform}))};
  assert.equal(verifySavedSchedule({ok:true,schedule},saved).targets.length,5);
  assert.throws(()=>verifySavedSchedule({ok:true,schedule:{...schedule,targets:schedule.targets.slice(1)}},saved),/could not be verified/);
  assert.throws(()=>readScheduleReceipt(JSON.stringify({...saved,input:{...saved.input,targets:[targets[0],targets[0]]}}),'owner','hook'),/could not be verified/);
  assert.throws(()=>readScheduleReceipt(JSON.stringify(saved),'other-owner','hook'),/could not be verified/);
});
test('four selected accounts get individual capability checks, exact targets and one timezone conversion', async () => {
  const calls=[],draft=selected();
  const accounts=workflowScheduleTargets(draft).map(target=>({id:target.connectionId,platform:target.platform,status:'connected',platformAccountName:'Account',platformAccountUsername:null,supportsBackgroundRefresh:true,scopes:[target.platform==='instagram'?'instagram_business_content_publish':'video.publish']}));
  let failAccount=false;
  const load=async url=>{calls.push(url);if(url.includes('configOnly'))return {minimumScheduleLeadMinutes:5};if(url==='/api/social/connections')return {ok:true,connections:accounts.map(account=>failAccount&&account.id===id(4)?{...account,status:'expired'}:account)};if(url.includes('publishing-preferences'))return {preferences:{containsSyntheticMedia:false,youtubePrivacyStatus:'private',youtubeMadeForKids:false,youtubeNotifySubscribers:false,tiktokPrivacyLevel:'SELF_ONLY',tiktokAllowComments:true}};return {capabilities:{privacyLevels:['SELF_ONLY'],directPostAudited:false}};};
  const params={draft,timezone:'Asia/Kolkata',source:{kind:'media_asset',id:id(50)},title:'Finished',load};
  const result=await prepareSimpleWorkflowSchedule(params);
  assert.equal(result.targets.length,4);assert.deepEqual(result.targets.map(target=>target.connectionId),[id(1),id(2),id(3),id(4)]);
  assert.equal(result.scheduledFor,'2099-12-01T16:00:00.000Z');assert.equal(result.scheduledTime,'21:30');
  assert.ok(calls.includes(`/api/social/connections/${id(3)}/publish-settings`));assert.ok(calls.includes(`/api/social/connections/${id(4)}/publish-settings`));
  failAccount=true;await assert.rejects(prepareSimpleWorkflowSchedule(params),/expired/);
});
test('account refresh times out during authentication and a late token cannot fetch', async t => {
  const controller=new AbortController();t.mock.method(AbortSignal,'timeout',()=>controller.signal);
  let resolveToken,calls=0;
  const pending=loadWorkflowConnectedAccounts({getOwnerToken:()=>new Promise(resolve=>{resolveToken=resolve}),fetch:async()=>{calls++;throw Error('unexpected')},assertActive(){}});
  const rejected=assert.rejects(pending,/Loading took too long/);controller.abort();await rejected;
  resolveToken('fixture');await new Promise(setImmediate);assert.equal(calls,0);
});
