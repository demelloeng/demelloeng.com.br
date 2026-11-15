import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transformWithEsbuild} from 'vite';
import * as journey from '../src/journey.mjs';
import * as commercial from '../src/commercial.mjs';
import * as preview from '../src/preview.mjs';
import {packageForCRMv2} from '../src/payload_v2.mjs';
import {architectureReturn} from '../src/architecture_return.mjs';
import {brlStr} from '../src/pricing/decimal.mjs';
import {referenceEntries} from '../src/references.mjs';
import {friendlyServiceName as serviceName,NEXT_STEP} from '../src/client_summary.mjs';
import {Q_PT} from '../src/labels.mjs';

// Executes the real Result component and event handlers, with deterministic hooks.
// Worker and canvas are the only asynchronous boundaries replaced. No DOM/browser claim.
const source=await readFile(process.env.P3_SOURCE??new URL('../src/GlobalApp.jsx',import.meta.url),'utf8');
const resultSource=source.slice(source.indexOf('export function Result('),source.indexOf('export function App(')).replace('export function','function');
const {code}=await transformWithEsbuild(resultSource,'Result.jsx',{jsx:'transform',jsxFactory:'element',jsxFragment:'fragment'});
const answers={route:'build',CA1:'Construir do zero',CA_AREA:{value:'320'},property:'Casa/sobrado',location:{city:'Curitiba',uf:'PR',ibge_id:'4106902'},phase:'Só uma ideia / estudo',CA5:{value:'2'},CA6:'Alto',services:['Arquitetura','Estrutural','Hidrossanitário','Elétrica'],area_fundacao:{value:'160'},deadline:'Ainda sem prazo'};
const coupon={schema:'COUPON_V1',code:'DM-TESTE',kind:'PERCENT',value:'10',revision:1};
function record(withCoupon=true){return {schema:'PUBLIC_PREVIEW_V1',verification_code:'k3m7q9r2t5w8x4z6',issued_at:'2026-11-14T12:00:00Z',status:'ISSUED',integrity:{status:'VERIFIED'},preview:{schema_version:'PREVIEW_RECORD_V1',pricing:{status:'CALCULATED',total_demello:'12509.76',services:[]},...(withCoupon?{commercial:{base_total:'12509.76',coupon_code:'DM-TESTE',coupon_kind:'PERCENT',coupon_value:'10',discount:'1250.98',final_total:'11258.78'}}:{})}};}
const nodes=tree=>[tree,...(tree?.props?.children??[]).flat(Infinity).filter(x=>x&&typeof x==='object').flatMap(nodes)];
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):(tree?.props?.children??[]).flat(Infinity).map(text).join('');
function harness({withCoupon=true,issue=async()=>({ok:true,status:201,record:record(withCoupon)}),png=async()=>{throw Error('canvas unavailable');}}={}){
 const slots=[],effects=[],emitted=[],revoked=[],created=[],counts={worker:0,png:0};let cursor=0,tree;
 const useState=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const useRef=initial=>{const i=cursor++;return slots[i]??(slots[i]={current:initial});};
 const useEffect=(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((x,j)=>x!==slots[i].deps[j])){effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const context={...journey,...commercial,...preview,packageForCRMv2,architectureReturn,brlStr,referenceEntries,serviceName,NEXT_STEP,Q_PT,useState,useRef,useEffect,COUPON_EMPTY:{input:'',state:'idle',data:null},REFORMA:journey.REFORMA,qUnit:s=>s.q_basis==='Q_HORAS'?'h':'m²',CouponBox:()=>null,ArchitectureReturn:()=>null,DownloadSimple:()=>null,element:(type,props,...children)=>({type,props:{...props,children}}),fragment:'fragment',URL:{createObjectURL:b=>{const u=`blob:preview-${created.length+1}`;created.push(u);return u;},revokeObjectURL:u=>revoked.push(u)},issuePreview:async(...a)=>{counts.worker++;return issue(...a);},renderPreviewPng:async(...a)=>{counts.png++;return png(...a);},refreshFactorConfig:async()=>{},aboveLimit:()=>false};
 vm.createContext(context);vm.runInContext(code+';this.Result=Result;',context);
 const props={answers,isPreview:true,cupom:withCoupon?{input:coupon.code,state:'ok',data:coupon}:context.COUPON_EMPTY,onEmitted:e=>emitted.push(e),setCupom:()=>{}};
 const render=()=>{cursor=0;tree=context.Result(props);while(effects.length)effects.shift()();return tree;};
 const button=label=>nodes(tree).find(n=>n.type==='button'&&text(n)===label);
 render();return {render,button,text:()=>text(tree),nodes:()=>nodes(tree),counts,emitted,created,revoked,props,unmount:()=>slots.forEach(s=>s?.cleanup?.())};
}
for(const withCoupon of [true,false])test(`P3 confirmed preview survives PNG failure and image-only retry (${withCoupon?'coupon':'base'})`,async()=>{
 let attempts=0;const h=harness({withCoupon,png:async()=>{if(++attempts===1)throw Error('canvas');return {type:'image/png'};}});
 await h.button('Gerar prévia DEMELLO').props.onClick();h.render();
 console.log('P3 after PNG failure',JSON.stringify({counts:h.counts,emissions:h.emitted.filter(Boolean).length,visible:h.text()}));
 assert.match(h.text(),/Prévia emitida.*k3m7q9r2t5w8x4z6/,'201 record stays visible');
 assert.match(h.text(),withCoupon?/11\.258,78/:/12\.509,76/);
 assert.match(h.text(),/imagem PNG/i,'message singles out image failure');
 assert.equal(h.button('Gerar prévia DEMELLO'),undefined,'cannot issue twice after 201');
 assert.equal(h.nodes().some(n=>n.type==='a'),false,'no stale download');
 await h.button('Tentar gerar PNG novamente').props.onClick();h.render();
 assert.deepEqual(h.counts,{worker:1,png:2});assert.equal(h.emitted.filter(Boolean).length,1);
 assert.equal(h.nodes().find(n=>n.type==='a').props.href,'blob:preview-1');
 assert.equal(h.emitted[0].record.verification_code,'k3m7q9r2t5w8x4z6');
 if(withCoupon)assert.equal(commercial.attachCommercialOffer(packageForCRMv2(answers),h.emitted[0]).commercial_offer.final_total,'11258.78');
 h.unmount();assert.deepEqual(h.revoked,['blob:preview-1']);
});
test('P3 before confirmation failure keeps emission retry and never announces issued',async()=>{
 const h=harness({issue:async()=>({ok:false,status:503})});await h.button('Gerar prévia DEMELLO').props.onClick();h.render();
 assert.doesNotMatch(h.text(),/Prévia emitida/);assert.ok(h.button('Gerar prévia DEMELLO'));assert.deepEqual(h.counts,{worker:1,png:0});assert.equal(h.emitted.length,0);
});
test('P3 synchronous repeated clicks do not create parallel emissions',async()=>{
 let finish;const pending=new Promise(r=>{finish=r;});const h=harness({issue:()=>pending});const click=h.button('Gerar prévia DEMELLO').props.onClick;
 const a=click(),b=click();finish({ok:true,status:201,record:record()});await Promise.all([a,b]);h.render();assert.equal(h.counts.worker,1);assert.equal(h.emitted.filter(Boolean).length,1);
});
test('P3 invalidating coupon clears old download and unmount ignores pending PNG',async()=>{
 const h=harness({png:async()=>({type:'image/png'})});await h.button('Gerar prévia DEMELLO').props.onClick();h.render();
 h.nodes().find(n=>typeof n.type==='function'&&n.props.onChanged).props.onChanged();h.render();
 assert.equal(h.nodes().some(n=>n.type==='a'),false);assert.deepEqual(h.revoked,['blob:preview-1']);assert.equal(h.emitted.at(-1),null);
 let finish;const pending=new Promise(r=>{finish=r;});const late=harness({png:()=>pending});const action=late.button('Gerar prévia DEMELLO').props.onClick();await Promise.resolve();late.unmount();finish({type:'image/png'});await action;assert.deepEqual(late.created,[],'unmounted component creates no download URL');
});

test('P3 PNG retry is serialized and invalidated pending image never restores a link',async()=>{
 let calls=0,finish;const h=harness({png:async()=>{if(++calls===1)throw Error('canvas');return new Promise(r=>{finish=r;});}});
 await h.button('Gerar prévia DEMELLO').props.onClick();h.render();
 const retry=h.button('Tentar gerar PNG novamente').props.onClick;
 const a=retry(),b=retry();h.render();assert.match(h.text(),/Gerando imagem PNG/);
 assert.equal(h.button('Tentar gerar PNG novamente'),undefined);
 h.nodes().find(n=>typeof n.type==='function'&&n.props.onChanged).props.onChanged();h.render();
 finish({type:'image/png'});await Promise.all([a,b]);h.render();
 assert.deepEqual(h.counts,{worker:1,png:2});assert.equal(h.nodes().some(n=>n.type==='a'),false);assert.deepEqual(h.created,[]);
});
test('P3 reproduction: PNG retry never requests another emission',async()=>{
 const h=harness();await h.button('Gerar prévia DEMELLO').props.onClick();h.render();
 const retry=h.button('Tentar gerar PNG novamente')??h.button('Gerar prévia DEMELLO');
 await retry.props.onClick();h.render();
 console.log('P3 repeat counts',JSON.stringify({counts:h.counts,emissions:h.emitted.filter(Boolean).length}));
 assert.deepEqual(h.counts,{worker:1,png:2});assert.equal(h.emitted.filter(Boolean).length,1);
});
test('P3 confirmed record can be invalidated while first PNG is pending',async()=>{
 let finish;const h=harness({png:()=>new Promise(r=>{finish=r;})});const action=h.button('Gerar prévia DEMELLO').props.onClick();for(let i=0;i<6&&!h.counts.png;i++)await Promise.resolve();h.render();
 h.nodes().find(n=>typeof n.type==='function'&&n.props.onChanged).props.onChanged();h.render();
 assert.equal(h.emitted.at(-1),null,'confirmed record invalidated immediately when coupon changes');
 finish({type:'image/png'});await action;h.render();assert.equal(h.nodes().some(n=>n.type==='a'),false);assert.deepEqual(h.created,[]);
});
