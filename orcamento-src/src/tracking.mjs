// Mensuração do funil dentro do /orcamento/. Ponte entre a jornada e o adaptador neutro (assets/js/analytics.mjs).
//
// Nada aqui lê texto livre, contato, fotos ou valores digitados: os parâmetros saem só de
// (a) chaves de rota/nó da própria jornada e (b) códigos de serviço derivados pelo motor.
// O adaptador ainda revalida tudo contra o contrato fechado. Cada função usa uma chave de
// deduplicação, então re-renderizações, StrictMode e "Voltar/Avançar" não geram evento duplicado.
import {track as defaultTrack,trackPageView as defaultPageView} from '../../assets/js/analytics.mjs';
import {derivePricingInputs} from './payload_v2.mjs';
import {resultKind,evaluateQualifiedLead,LEAD_STAGE} from './funnel.mjs';
import {architectureAnalytics} from './architecture.mjs';

// Hash local (FNV-1a 32 bits) só para decidir "é o mesmo resultado?"; o valor NUNCA é enviado a ninguém.
export function fingerprint(value){
 let h=0x811c9dc5;
 const text=JSON.stringify(value,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(x=>[x,v[x]])):v);
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(16);
}

// Disciplinas do caso, como códigos controlados: 0 -> none, 1 -> o código, 2+ -> multiple.
export function serviceParams(answers){
 const codes=[...new Set(derivePricingInputs(answers).services)].map(s=>s.toLowerCase());
 return {service:codes.length===0?'none':codes.length===1?codes[0]:'multiple',service_count:codes.length};
}

const statusOf=kind=>kind==='calculated'?'calculated':kind==='held'?'safety_hold':'needs_review';

export function createTracking({track=defaultTrack,pageView=defaultPageView}={}){
 return {
  pageView:()=>pageView(),
  // Entrada na jornada: só quando a rota já está escolhida e o primeiro nó dela é exibido.
  situation({route,entry,service,step}){
   const fp=`${route}|${entry}|${service??''}`;
   track('estimate_started',{route,entry,step},{dedupeKey:'once'});
   return track('situation_selected',{route,entry,...(service?{service}:{}),step},{dedupeKey:fp});
  },
  // Resultado entregue ANTES de qualquer contato. Calculado = estimativa; senão = enquadramento.
  result(answers,resultId,mode='preview'){
   const kind=resultKind(answers,mode);
   const params={route:answers.route,...serviceParams(answers),result_status:statusOf(kind),step:resultId};
   // Fora da identidade do resultado: fotos, contato, escolha pós-resultado e a dúvida escrita (texto livre nunca participa da deduplicação).
   const { photos:_p, contact:_c, request_intent:_r, estimate_state:_e, lead_stage:_l, scope_question:_s, ...data }=answers;
   const fp=fingerprint(data);
   const out=track(kind==='calculated'?'estimate_completed':'framing_delivered',params,{dedupeKey:fp});
   // Arquitetura: eventos estruturados (faixas/enums), sem valores exatos e sem texto livre.
   const arq=architectureAnalytics(answers);
   if(arq){
    const pick=(...keys)=>Object.fromEntries(keys.map(k=>[k,arq[k]]));
    if(arq.area_source==='USER_DECLARED')track('architecture_area_known',pick('area_source','area_band','estimation_version'),{dedupeKey:fp});
    else{
     track('architecture_area_unknown',pick('area_source','estimation_version'),{dedupeKey:fp});
     track('architecture_estimator_started',pick('lot_area_band','program_size_band','estimation_version'),{dedupeKey:fp});
     const by={NEEDS_PROGRAM_ESTIMATE:['architecture_estimated_by_program',['area_source','area_band','program_size_band','estimation_version']],LOT_ONLY_ESTIMATE:['architecture_estimated_by_lot',['area_source','area_band','lot_area_band','estimation_version']],PROGRAM_AND_LOT_ESTIMATE:['architecture_estimated_by_program_and_lot',['area_source','area_band','lot_area_band','program_size_band','estimation_version']],HUMAN_REVIEW_REQUIRED:['architecture_estimator_human_review',['area_source','lot_area_band','program_size_band','estimation_version']]}[arq.area_source];
     if(by)track(by[0],pick(...by[1]),{dedupeKey:fp});
     if(arq.area_source!=='HUMAN_REVIEW_REQUIRED')track('architecture_estimate_presented',pick('area_source','area_band','estimation_version'),{dedupeKey:fp});
    }
   }
   return out;
  },
  // CRM aceitou o envio (HTTP 202). Só então o pedido existe; a chave é o id idempotente devolvido pelo Worker.
  submissionAccepted({answers,sendResult,contactValid,mode='preview'}){
   if(!sendResult||sendResult.ok!==true)return [];
   const intent=answers.request_intent;
   const eventName={proposal:'proposal_requested',scope_question:'scope_question_requested',evaluation_only:'evaluation_requested'}[intent];
   if(!eventName)return [];
   const base={route:answers.route,...serviceParams(answers)};
   const key=String(sendResult.submission_id??fingerprint({answers:Object.keys(answers).filter(k=>k!=='scope_question').sort(),intent}));
   const out=[track(eventName,{...base,request_intent:intent,step:'X4'},{dedupeKey:key})];
   if(evaluateQualifiedLead({accepted:true,answers,contactValid,mode}))out.push(track('qualified_lead',{...base,rule:'R1'},{dedupeKey:key}));
   return out;
  },
 };
}

export const tracking=createTracking();
export {LEAD_STAGE};
