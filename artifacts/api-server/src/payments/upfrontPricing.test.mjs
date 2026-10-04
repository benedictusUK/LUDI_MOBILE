import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../../../..");
const temp = await mkdtemp(join(tmpdir(), "ludi-upfront-"));
const mock = `
const state = () => globalThis.__ludiFinance;
export const col = (table, field) => ({table, field});
const table = name => new Proxy({table:name}, {get:(obj,key)=>key==='table'?name:col(name,key)});
export const events=table('events'),eventPayments=table('players'),paymentRefunds=table('refunds'),
  users=table('users'),payments=table('payments'),paymentOperations=table('operations');
export {calculatePlayerPrice,residualRefundMinor} from ${JSON.stringify(join(root,"lib/db/src/schema/paymentPricing.ts"))};
export {effectivePaymentPolicy,paymentWindow,eventEndAt} from ${JSON.stringify(join(root,"lib/db/src/schema/eventPaymentPolicy.ts"))};
export const eq=(a,b)=>({op:'eq',a,b}),inArray=(a,b)=>({op:'in',a,b}),and=(...v)=>({op:'and',v});
export const sql=(strings,...values)=>({op:'sql',text:strings.join(''),values,mapWith(){return this}});
const match=(row,c)=>!c?true:c.op==='and'?c.v.every(x=>match(row,x)):c.op==='eq'?row[c.a.field]===c.b:
  c.op==='in'?c.b.includes(row[c.a.field]):c.text.includes("<> 'flexible_residual'")?row.reason!=='flexible_residual':true;
const rows = t => t.table==='events'?[state().event]:state()[t.table] || [];
function builder(kind,t,fields) {
  let filter,vals,patch,done,result;
  const q={from(v){t=v;return q},where(v){filter=v;return q},for(){return q},limit(){return q},
    values(v){vals=v;return q},set(v){patch=v;return q},onConflictDoNothing(){return q},
    returning(){return q},then(resolve,reject){try{
      if(!done){
        let selected=rows(t).filter(r=>match(r,filter));
        if(kind==='select') result=fields?.paid?[{paid:state().players.filter(p=>p.status==='captured').length}]:selected;
        else if(kind==='insert') {
          const r={id:'row-'+(++state().seq),refundedAmountMinor:0,...vals};
          const arr=rows(t);
          if(!arr.some(old=>r.requestKey && old.requestKey===r.requestKey || t.table==='players' && old.userId===r.userId)) arr.push(r);
          result=[r];
        } else {
          if(t.table==='refunds' && patch.stripeRefundId && state().failPersistence) { state().failPersistence=false;globalThis.__ludiPersistenceFailed=true;throw Error('Simulated commit failure'); }
          selected.forEach(r=>Object.assign(r,patch)); result=selected;
        }
        done=true;
      }
      return Promise.resolve(result).then(resolve,reject);
    }catch(e){return Promise.reject(e).then(resolve,reject)}}
  };return q;
}
export const db={select:fields=>builder('select',null,fields),insert:t=>builder('insert',t),
  update:t=>builder('update',t),execute:async()=>({rows:[{ok:1}]}),
  async transaction(fn){const before=structuredClone(state());try{return await fn(db)}catch(e){
    globalThis.__ludiFinance=before;if(globalThis.__ludiPersistenceFailed)globalThis.__ludiFinance.failPersistence=false;throw e;
  }}};
export const storage={getEventAttendance:async()=>state().attendance,getEventPayment:async(_e,id)=>state().players.find(p=>p.userId===id),
  getUserById:async id=>id==='organiser'?{id,stripeAccountId:'acct_fixture',payoutsEnabled:true}:{id,stripeCustomerId:'cus_fixture'},
  updateEventPaymentStatus:async(_id,status)=>{state().event.paymentStatus=status},
  getNotificationById:async()=>null};
const provider=()=>globalThis.__ludiProvider;
export const platformFeeBasisPoints=500;
export const stripe={paymentIntents:{
  async create(args,options){provider().intents.push({args,options});return{id:'pi_fixture',status:'requires_payment_method',...args}},
  async retrieve(){return provider().intent},
},charges:{async retrieve(){return{id:'ch_fixture',created:1577836800,amount_refunded:provider().refunded}}},
refunds:{
  async retrieve(id){return provider().refunds.find(r=>r.id===id)},
  list(){return{async autoPagingEach(fn){for(const r of [...provider().refunds].reverse()){if(fn(r)===false)break}}}},
  async create(args,options){
    provider().calls.push({args,options});
    if(provider().failCreate){provider().failCreate=false;throw Error('Simulated provider failure')}
    const found=provider().refunds.find(r=>r.key===options.idempotencyKey);if(found)return found;
    const r={id:'re_'+(provider().refunds.length+1),status:'succeeded',currency:'gbp',key:options.idempotencyKey,...args};
    provider().refunds.push(r);provider().refunded+=r.amount;return r;
  }
}};
`;
const built = await build({
  stdin: { contents: `
    export * from ${JSON.stringify(join(root,"lib/db/src/schema/paymentPricing.ts"))};
    export * from ${JSON.stringify(join(root,"artifacts/api-server/src/payments/policyService.ts"))};
    export * from ${JSON.stringify(join(root,"artifacts/api-server/src/payments/flexibleRefunds.ts"))};
    export {calculateTotalAmount as webPrice} from ${JSON.stringify(join(root,"artifacts/ludi-web/src/lib/payment-utils.ts"))};
    export {calculateTotalAmount as mobilePrice} from ${JSON.stringify(join(root,"artifacts/ludi-mobile/lib/paymentUtils.js"))};
  `, resolveDir: root, sourcefile: "finance-tests-entry.ts", loader: "ts" },
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{name:"isolated-finance",setup(b){
    b.onResolve({filter:/^(?:@workspace\/db|drizzle-orm|\.\.\/db|\.\.\/storage|\.\/stripeClient)$/},()=>({path:"finance-mocks",namespace:"finance-mock"}));
    b.onLoad({filter:/.*/,namespace:"finance-mock"},()=>({contents:mock,loader:"js",resolveDir:root}));
  }}],
});
const modulePath=join(temp,"finance.mjs");
await writeFile(modulePath,built.outputFiles[0].text);
const api=await import(pathToFileURL(modulePath));
const fees={platformBasisPoints:500,stripeBasisPoints:299,stripeFixedMinor:0,revision:1};
function seed({future=false}={}) {
  const event={id:'event',name:'Fixture',paymentRequired:true,paymentPolicy:'flexible_post_event',currency:'gbp',
    maxPlayerPayment:'10.00',createdById:'organiser',venueOrganiserId:'organiser',feeConfiguration:{...fees},
    startDate:future?'2099-01-02':'2020-01-02',endDate:future?'2099-01-03':'2020-01-03',
    startTime:'12:00',endTime:'14:00',authorizationOpensAt:'2019-01-01T00:00:00Z',
    paymentDeadlineAt:future?'2099-01-02T12:00:00Z':'2020-01-02T12:00:00Z',
    completionDueAt:future?'2099-01-04T00:00:00Z':'2020-01-04T00:00:00Z',
    paymentCollectionInitiated:false,paymentStatus:'none'};
  globalThis.__ludiFinance={event,players:future?[]:[{id:'player-row',userId:'player',eventId:'event',status:'captured',
    stripeCustomerId:'cus_fixture',paymentIntentId:'pi_fixture',agreedAmountMinor:1082,capturedAmountMinor:1082,refundedAmountMinor:0,currency:'gbp',settledBaseAmountMinor:null}],
    attendance:[{userId:'player',status:'attending'}],refunds:[],users:[],payments:[],operations:[],seq:0};
  globalThis.__ludiProvider={calls:[],refunds:[],refunded:0,intents:[],intent:{id:'pi_fixture',amount:1082,amount_received:1082,application_fee_amount:82,
    currency:'gbp',status:'succeeded',capture_method:'automatic',customer:'cus_fixture',latest_charge:'ch_fixture',
    transfer_data:{destination:'acct_fixture'},metadata:{ludiEventId:'event',ludiParticipantId:'player',ludiOrganiserId:'organiser',
      ludiPaymentPolicy:'flexible_post_event',ludiPaymentFlow:'upfront_refund'}}};
  globalThis.__ludiPersistenceFailed=false;
  return event;
}
test("user example and fixed fee amounts after residual refund",()=>{
  const p=api.calculatePlayerPrice(1000,fees);
  assert.deepEqual(p,{baseAmountMinor:1000,platformFeeMinor:50,processingFeeMinor:32,totalAmountMinor:1082});
  assert.equal(api.residualRefundMinor(1000,800),200);
  assert.equal(p.totalAmountMinor-200,882);
});
test("web/mobile integer-penny previews agree with server across rates and amounts",()=>{
  for(const fixed of [0,30])for(const stripeRate of [0,290,299,10000])for(const base of [50,51,99,100,1000,1001,10000,12345]){
    const config={...fees,stripeBasisPoints:stripeRate,stripeFixedMinor:fixed};
    const expected=api.calculatePlayerPrice(base,config).totalAmountMinor;
    assert.equal(Math.round(api.webPrice(base/100,[],config).total*100),expected);
    assert.equal(Math.round(api.mobilePrice(base/100,[],config).total*100),expected);
  }
});
test("upfront checkout creates automatic gross charge with fees retained by platform",async()=>{
  const event=seed({future:true});
  const {intent}=await api.getOrCreateEventIntent(event,'player');
  assert.equal(intent.amount,1082);assert.equal(intent.capture_method,'automatic');assert.equal(intent.application_fee_amount,82);
  assert.equal(intent.metadata.ludiPaymentFlow,'upfront_refund');
  assert.equal(globalThis.__ludiFinance.players[0].agreedAmountMinor,1082);
});
test("legacy event keeps its original base-only manual authorisation",async()=>{
  const event=seed({future:true});event.feeConfiguration=null;
  const {intent}=await api.getOrCreateEventIntent(event,'player');
  assert.equal(intent.amount,1000);assert.equal(intent.capture_method,'manual');assert.equal(intent.application_fee_amount,50);
});
test("residual refund reverses only venue funds and never refunds the original fees",async()=>{
  const event=seed();
  const result=await api.settleFlexibleEvent(event,'organiser','8.00');
  assert.equal(result.settlementComplete,true);assert.equal(result.totalRefunded,'2.00');
  const request=globalThis.__ludiProvider.calls[0];
  assert.equal(request.args.amount,200);assert.equal(request.args.reverse_transfer,true);assert.equal(request.args.refund_application_fee,false);
  assert.equal(globalThis.__ludiFinance.players[0].organiserAmountMinor,800);
  assert.equal(await api.hasValidEventPayment(event,'player'),true);
  await api.settleFlexibleEvent(event,'organiser','8.00');
  assert.equal(globalThis.__ludiProvider.calls.length,1);
});
test("final cost above maximum is rejected before any refund or extra charge",async()=>{
  const event=seed();
  await assert.rejects(()=>api.settleFlexibleEvent(event,'organiser','10.01'),/exceeds/);
  assert.equal(globalThis.__ludiProvider.calls.length,0);
  assert.equal(globalThis.__ludiFinance.event.paymentCollectionInitiated,false);
});
test("provider failure leaves a durable plan and retries the same residual",async()=>{
  const event=seed();globalThis.__ludiProvider.failCreate=true;
  const first=await api.settleFlexibleEvent(event,'organiser','8.00');
  assert.equal(first.settlementComplete,false);assert.equal(first.failedRefunds,1);
  assert.equal(globalThis.__ludiFinance.refunds[0].amountMinor,200);
  assert.equal(globalThis.__ludiFinance.event.paymentCollectionInitiated,true);
  await assert.rejects(()=>api.settleFlexibleEvent(event,'organiser','7.00'),/frozen/);
  const second=await api.settleFlexibleEvent(event,'organiser','8.00');
  assert.equal(second.settlementComplete,true);assert.equal(globalThis.__ludiProvider.refunds.length,1);
});
test("unknown outcome after provider success is recovered by metadata, not paid twice",async()=>{
  const event=seed();globalThis.__ludiFinance.failPersistence=true;
  const first=await api.settleFlexibleEvent(event,'organiser','8.00');
  assert.equal(first.failedRefunds,1);assert.equal(globalThis.__ludiProvider.refunds.length,1);
  assert.equal(globalThis.__ludiFinance.refunds[0].stripeRefundId,undefined);
  const second=await api.settleFlexibleEvent(event,'organiser','8.00');
  assert.equal(second.settlementComplete,true);assert.equal(globalThis.__ludiProvider.calls.length,1);
});
test("zero residual does not call Stripe refunds",async()=>{
  const event=seed();const result=await api.settleFlexibleEvent(event,'organiser','10.00');
  assert.equal(result.settlementComplete,true);assert.equal(globalThis.__ludiProvider.calls.length,0);
});
test("webhook winner is reconciled without overwriting cumulative refunds",async()=>{
  const event=seed();globalThis.__ludiProvider.failCreate=true;
  await api.settleFlexibleEvent(event,'organiser','8.00');
  globalThis.__ludiFinance.refunds[0].status='succeeded';
  globalThis.__ludiFinance.players[0].refundedAmountMinor=200;
  globalThis.__ludiFinance.players[0].organiserAmountMinor=1000;
  const result=await api.retryFlexibleResiduals(event);
  assert.equal(result.settlementComplete,true);
  assert.equal(globalThis.__ludiFinance.players[0].finalAmount,'8.82');
  assert.equal(globalThis.__ludiFinance.players[0].organiserAmountMinor,800);
  assert.equal(globalThis.__ludiFinance.players[0].refundedAmountMinor,200);
});
test("zero final venue cost refunds the full base while retaining both original fees",async()=>{
  const event=seed();const result=await api.settleFlexibleEvent(event,'organiser','0.00');
  assert.equal(result.totalRefunded,'10.00');
  assert.equal(globalThis.__ludiFinance.players[0].finalAmount,'0.82');
  assert.equal(globalThis.__ludiFinance.players[0].organiserAmountMinor,0);
});
test.after(async()=>{await rm(temp,{recursive:true,force:true});delete globalThis.__ludiFinance;delete globalThis.__ludiProvider;});