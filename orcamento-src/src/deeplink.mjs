// Deep-link: /orcamento/?situacao=<route>[&servico=<disciplina>] abre a jornada já na rota escolhida.
//
//  - situacao: só aceita chaves existentes em journey.routes; qualquer outro valor cai no HOME normal.
//  - servico : só vale com situacao=known (rota "Já sei o serviço"). Lista FECHADA e explícita abaixo;
//              valor desconhecido, vazio ou com nome de protótipo (__proto__, toString…) é ignorado e a jornada
//              abre em "Já sei o serviço" SEM nenhuma seleção.
//  - PARÂMETRO REPETIDO (situacao ou servico mais de uma vez, igual ou diferente, válido ou não) é INVÁLIDO:
//              nenhum valor é usado (fail-closed), sem erro e sem registrar a query.
//  - Nada vindo da URL é gravado nas respostas: só os valores controlados desta tabela entram.
import {starts,switchRoute,routes} from './journey.mjs';

// Disciplinas com deep link. Chave = valor aceito em ?servico= (id estável, minúsculo, com hífen).
//  - services : rótulos EXATOS das opções de S1 ("Já sei o serviço"); o motor de preços os mapeia.
//               Arquitetura (Q_NOVA), Orçamento técnico (Q_ESCOPO) e Terraplenagem (Q_TERRENO) são serviços
//               NATIVOS e precificáveis da TABELA DEMELLO V2: nada de "Outro", nada de texto livre.
//  - route    : disciplina com rota exclusiva (Regularização) abre a própria rota.
export const SERVICE_DEEPLINKS = Object.freeze({
 'estrutural':Object.freeze({services:['Estrutural'],analytics:'estrutural'}),
 'hidrossanitario':Object.freeze({services:['Hidrossanitário'],analytics:'hidrossanitario'}),
 'incendio':Object.freeze({services:['Incêndio'],analytics:'incendio'}),
 'gas-glp':Object.freeze({services:['Gás'],analytics:'gas_glp'}),
 'compatibilizacao':Object.freeze({services:['Compatibilização BIM'],analytics:'compatibilizacao'}),
 'arquitetura':Object.freeze({services:['Arquitetura'],analytics:'arquitetura'}),
 'orcamento-tecnico':Object.freeze({services:['Orçamento técnico'],analytics:'orcamento'}),
 'terraplenagem':Object.freeze({services:['Terraplenagem'],analytics:'terraplenagem'}),
 'regularizacao':Object.freeze({route:'regularize',analytics:'regularizacao'}),
});

const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);

// Valor único do parâmetro; ausente, vazio ou REPETIDO => null.
const single=(search,name)=>{
 const all=new URLSearchParams(search??'').getAll(name);
 return all.length===1&&all[0]?all[0]:null;
};

export function routeFromSearch(search){
 try{const r=single(search,'situacao');return r&&own(starts,r)?r:null;}
 catch{return null;}
}

// Disciplina pedida na URL, já validada contra a tabela fechada. Só vale junto de situacao=known.
export function serviceFromSearch(search){
 try{
  if(routeFromSearch(search)!=='known')return null;
  const s=single(search,'servico');
  return s&&own(SERVICE_DEEPLINKS,s)?s:null;
 }catch{return null;}
}

// Rota efetiva: situacao=known&servico=regularizacao abre a rota exclusiva de Regularização.
export function effectiveRoute(search){
 const route=routeFromSearch(search);
 if(!route)return null;
 const service=serviceFromSearch(search);
 return service&&SERVICE_DEEPLINKS[service].route?SERVICE_DEEPLINKS[service].route:route;
}

export function initialState(search){
 const route=effectiveRoute(search);
 if(!route)return {id:'HOME',answers:{},history:[]};
 const answers=switchRoute({},route);
 const service=serviceFromSearch(search);
 const preset=service?SERVICE_DEEPLINKS[service]:null;
 if(preset&&preset.services)answers.services=[...preset.services];
 return {id:starts[route],answers,history:['HOME']};
}

// Metadados para mensuração (somente valores controlados — nunca a query bruta).
export function deeplinkInfo(search){
 const route=effectiveRoute(search);
 if(!route||!own(routes,route))return null;
 const service=serviceFromSearch(search);
 return {route,service,analyticsService:service?SERVICE_DEEPLINKS[service].analytics:null};
}
