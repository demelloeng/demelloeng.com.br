import {map} from './map.js';
import {area, classify, ufs} from './flow.mjs';
export {ufs,area};
export const routes={build:'Construir ou ampliar',regularize:'Regularizar meu imóvel',problem:'Avaliar um problema',known:'Já sei o serviço'};
export const starts={build:'CA1',regularize:'REG_R1',problem:'P1',known:'S1'};
const opts=list=>list.map(x=>typeof x==='string'?{value:x,label:x}:x);
const n=(title,type,choices=[],extra={})=>({title,type,options:opts(choices),...extra});
export const properties=['Casa/sobrado','Residencial multifamiliar','Comercial','Industrial','Outro'];
export const phases=['Só uma ideia / estudo','Arquitetura em desenvolvimento','Arquitetura pronta','Obra já começou'];
export const deadlines=['Até 30 dias','1–3 meses','3–6 meses','Mais de 6 meses','Ainda sem prazo'];
// "Elétrica" foi extirpada do catálogo DEMELLO: referência de preço existir != serviço ofertável.
export const services=['Estrutural','Fundações','Hidrossanitário','Drenagem','Incêndio','Gás','Compatibilização BIM','Outro'];
const buildServices=[{value:'Estrutural',label:'Estruturas'},{value:'Hidrossanitário',label:'Água e esgoto'},'Drenagem','Incêndio','Gás','Compatibilização BIM','Não sei quais preciso'];
export const nodes={
 HOME:n('O que você precisa resolver?','entry',Object.entries(routes).map(([value,label])=>({value,label})),{key:'route'}),
 CA1:n('O que você vai fazer?','single',['Construir do zero','Ampliar um imóvel existente','Ainda estou definindo']),
 CA_AREA:n('Qual será a área aproximada?','area',[],{label:'Área total',next:'CA2'}),
 CA_EXISTING:n('Quanto existe hoje?','area',[],{label:'Área existente',next:'CA_NEW'}),
 CA_NEW:n('Quanto pretende ampliar?','area',[],{label:'Área nova',next:'CA2'}),
 CA2:n('Que tipo de empreendimento é?','single',properties,{key:'property',label:'Empreendimento',next:'CA3'}),
 CA3:n('Onde será o projeto?','location',[],{key:'location',next:'CA4'}),
 CA4:n('Em que fase está?','single',phases,{key:'phase',label:'Fase do projeto',next:'CA5'}),
 CA5:n('Quantos pavimentos?','integer',[],{label:'Pavimentos',next:'CA6'}),
 CA6:n('Qual o padrão?','single',['Econômico','Médio','Alto','Ainda não sei'],{label:'Padrão',next:'CA7'}),
 CA7:n('Quais projetos você precisa?','multi',buildServices,{key:'services',label:'Projetos selecionados',next:'CA8'}),
 CA8:n('Quando pretende precisar dos projetos?','single',deadlines,{key:'deadline',label:'Prazo',next:'X1'}),
 P1:n('O que você precisa avaliar?','single',['Apareceu algo no imóvel e quero entender o que é','Quero fazer uma alteração e saber se é possível','Quero saber se o imóvel está em boas condições','Tive um problema durante ou depois de uma obra','Preciso de uma avaliação técnica por outro motivo','Não sei bem como explicar'],{label:'O que precisa avaliar',next:'P2'}),
 P2:n('Mostre ou conte o que aconteceu','story',[],{label:'Você informou',next:'P3'}),
 P3:n('Que imóvel é?','single',['Casa/sobrado','Apartamento','Condomínio / edifício','Comercial','Industrial','Obra em andamento','Outro'],{key:'property',label:'Imóvel',next:'P4'}),
 P4:n('Onde fica?','location',[],{key:'location',next:'P5'}),
 P5:n('O que você quer conseguir?','single',['Entender o que está acontecendo','Saber se posso fazer uma alteração','Saber como corrigir','Avaliar antes de comprar/vender','Atender uma exigência','Outro'],{label:'Objetivo',next:'X1'}),
 S1:n('Qual serviço precisa?','multi',services,{key:'services',label:'Serviços selecionados',next:'S2'}),
 S2:n('Que tipo de empreendimento é?','single',properties,{key:'property',label:'Empreendimento',next:'S3'}),
 S3:n('Qual a área aproximada?','area',[],{label:'Área informada',next:'S4'}),
 S4:n('Onde será o projeto?','location',[],{key:'location',next:'S5'}),
 S5:n('Em que fase está?','single',phases,{key:'phase',label:'Fase do projeto',next:'S6'}),
 S6:n('Quando pretende precisar dos projetos?','single',deadlines,{key:'deadline',label:'Prazo',next:'X1'}),
 X1:n('Seu caso, organizado','summary'),X3A:n('Já dá para fazer uma primeira conta.','result'),X3B:n('Já conseguimos organizar seu caso.','result'),X4:n('Quer receber esta análise?','contact',[],{key:'contact'}),
 // Perguntas condicionais de área, só quando o serviço as exige (Gás -> Q_ATENDIDA; Compatibilização -> Q_ESCOPO).
 Q_GAS:n('Qual a área aproximada atendida pela instalação de gás?','area',[],{key:'area_atendida',label:'Área atendida (gás)'}),
 Q_COMPAT:n('Qual a área total de projeto a compatibilizar?','area',[],{key:'area_escopo',label:'Área do escopo (compatibilização)'})
};
// Nós condicionais inseridos logo após a seleção de serviços (CA7 / S1).
const serviceExtraNodes=a=>{const s=a.services||[];return [...(s.includes('Gás')?['Q_GAS']:[]),...(s.includes('Compatibilização BIM')?['Q_COMPAT']:[])];};
function afterServices(a,from){
 const extras=serviceExtraNodes(a),cont=a.route==='build'?'CA8':'S2';
 const idx=from==='CA7'||from==='S1'?-1:extras.indexOf(from);
 return extras[idx+1]??cont;
}
// Preserve the IT075 micro-branches under a namespace, avoiding collisions with CA/P/S.
for(const old of map.nodes.filter(x=>!['R0','G2'].includes(x.id)&&!x.id.startsWith('X'))){
 const type=old.component==='Campo numérico'?'area':old.id==='C2'?'location':old.id==='G1'?'text':old.id==='C4'?'multi':'single';
 const choices=type==='single'||type==='multi'?old.options_or_fields.split(' · ').map((label,i)=>({value:old.id==='R1'?'ABCDEFG'[i]:label,label:old.id==='R1'?label.replace(/^[A-G]\. /,''):label})):[];
 nodes['REG_'+old.id]=n(old.title,type,choices,{label:old.title,next:old.transitions[0].to==='X1'?'X1':'REG_'+old.transitions[0].to,...(old.id==='C2'?{key:'location'}:old.id==='C3'?{key:'property'}:{})});
}
const regularSituation=['A área do IPTU e da matrícula não bate','Construí ou ampliei e não regularizei','Está faltando algum documento','A prefeitura ou o cartório apontou uma pendência','O imóvel está diferente da planta/projeto','Não sei exatamente o que está irregular','Outro caso'];
nodes.REG_R1.options.forEach((o,i)=>o.label=regularSituation[i]);
nodes.REG_C1.options=opts(['Venda','Inventário / partilha','Financiamento','Exigência da prefeitura','Exigência do cartório','Quero deixar o imóvel regular','Outro']);
nodes.REG_C4.options.forEach(o=>o.label=o.label.replaceAll('/',' / '));
Object.values(nodes).forEach(node=>node.options.forEach(o=>{if(o.value==='Casa/sobrado')o.label='Casa / sobrado';}));
const detailLabels={A1:'Área no IPTU',A2:'Área na matrícula',A3:'Motivo da diferença',B1:'Alteração',B2:'Área da alteração',B3:'Projeto da alteração','C-R1':'Documento faltante','C-R2':'Falta apontada por',D1:'Pendência apontada por',D2:'Exigência disponível',D3:'Assunto da exigência',E1:'Alteração no imóvel',E2:'Área afetada',E3:'Sabe quando aconteceu',F1:'Como soube',F2:'IPTU e matrícula',F3:'Recebeu explicação',G1:'Você informou',R1:'Situação',C1:'Finalidade',C4:'Documentos disponíveis'};
for(const [id,label] of Object.entries(detailLabels))nodes['REG_'+id].label=label;
const regStarts={A:'REG_A1',B:'REG_B1',C:'REG_C-R1',D:'REG_D1',E:'REG_E1',F:'REG_F1',G:'REG_G1'};
export const keyOf=id=>nodes[id].key??id;
export const isProject=a=>['build','known'].includes(a.route);
export const titleOf=(id,a)=>id==='X1'?(isProject(a)?'Seu projeto, organizado':'Seu caso, organizado'):nodes[id].title;
export function valid(id,a){
 const node=nodes[id],v=a[keyOf(id)];
 if(['summary','result'].includes(node.type))return true;
 if(node.type==='location')return !!v?.city?.trim()&&ufs.includes(v.uf);
 if(node.type==='area')return v?.unknown===true||area(v)!==null;
 if(node.type==='integer')return v?.unknown===true||(/^\d+$/.test(v?.value??'')&&Number(v.value)>0&&Number(v.value)<=200);
 if(node.type==='story')return !!v?.trim()||!!a.photos?.length;
 if(node.type==='text')return !!v?.trim();
 if(node.type==='contact'){const p=v?.whatsapp?.replace(/\D/g,'')??'';return !!v?.name?.trim()&&!!(p||v?.email?.trim())&&(!v?.whatsapp?.trim()||/^\d{10,13}$/.test(p))&&(!v?.email?.trim()||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()));}
 if(node.type==='multi'){
   if(!Array.isArray(v)||!v.length||v.some(s=>!node.options.some(o=>o.value===s)))return false;
   if(id==='REG_C4'&&v.includes('Não sei/não tenho agora')&&v.length>1)return false;
   if(id==='CA7'&&v.includes('Não sei quais preciso'))return !!a.suggestionConfirmed&&!!a.confirmedSuggestions?.length;
   if(id==='S1'&&v.includes('Outro'))return !!a.otherService?.trim();
   return true;
 }
 return node.options.some(o=>o.value===v);
}
export function toggle(values=[],value,exclusive){if(value===exclusive)return values.includes(value)?[]:[value];const list=values.filter(v=>v!==exclusive);return list.includes(value)?list.filter(v=>v!==value):[...list,value];}
const commonKeys=['location','property','phase','deadline','contact'];
export function switchRoute(a,route,{redirect=false}={}){
 if(a.route===route)return {...a};
 const next=Object.fromEntries(commonKeys.filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
 next.route=route;
 if(redirect){next.redirectedFrom=a.route;const selected=(a.services??[]).filter(x=>x!=='Outro'&&x!=='Não sei quais preciso');if(selected.length)next.carriedServices=selected;if(a.otherService)next.originalRequest=a.otherService;}
 // Keep only property values that are actually offered by the new route.
 const propertyNode={build:'CA2',known:'S2',regularize:'REG_C3',problem:'P3'}[route];
 if(next.property&&!nodes[propertyNode].options.some(o=>o.value===next.property))delete next.property;
 return next;
}
export function updateAnswer(a,id,value){
 if(id==='HOME')return switchRoute(a,value);
 const key=keyOf(id),next={...a,[key]:value};
 if(id==='CA1'&&a.CA1!==value)for(const k of ['CA_AREA','CA_EXISTING','CA_NEW'])delete next[k];
 if((id==='REG_R1'&&a.REG_R1!==value)||(id==='REG_G1'&&a.REG_G1!==value)){
   for(const k of Object.keys(next))if(k.startsWith('REG_')&&!['REG_R1','REG_C1','REG_C4',...(id==='REG_G1'?['REG_G1']:[])].includes(k))delete next[k];
 }
 if(id==='REG_C4'){if(next.derivedD2){delete next.REG_D2;delete next.derivedD2;}if(next.derivedF2){delete next.REG_F2;delete next.derivedF2;}}
 if(id==='REG_D2')delete next.derivedD2;if(id==='REG_F2')delete next.derivedF2;
 if(['CA1','CA2','CA3','CA4','CA5','CA6','CA7'].includes(id)){delete next.suggestionConfirmed;delete next.confirmedSuggestions;}
 if(id==='S1'&&!value.includes('Outro'))delete next.otherService;
 if(id==='CA7'||id==='S1'){
   if(!Array.isArray(value)||!value.includes('Gás'))delete next.area_atendida;
   if(!Array.isArray(value)||!value.includes('Compatibilização BIM'))delete next.area_escopo;
 }
 return next;
}
export function suggestedServices(a){
 // UX-only fixture matrix, NOT a validated technical recommendation.
 const list=a.property==='Industrial'?['Estrutural','Drenagem','Incêndio']:['Estrutural','Hidrossanitário'];
 if(a.property==='Residencial multifamiliar'||Number(a.CA5?.value)>2)list.push('Incêndio');
 return [...new Set(list)];
}
const normalized=t=>(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function equivalentService(text){const t=normalized(text);const reg=/regulariza|averba|habite.se/.test(t),problem=/avaliacao|vistoria|inspecao|laudo/.test(t);return reg&&!problem?'regularize':problem&&!reg?'problem':null;}
export function safetyHold(a){
 if(a.route!=='problem')return false;
 const t=normalized(a.P2);
 return /desab|colapso|desmoron|caindo|caiu|soltando|cedendo|aumentou|aumentando|piorou|rapida|de repente/.test(t);
}
export function needsReview(a){return safetyHold(a)||(a.route==='problem'&&a.photos?.length&&!a.P2?.trim())||(a.route==='regularize'&&a.REG_R1==='G'&&!classify(a.REG_G1))||(a.route==='known'&&a.services?.includes('Outro'))||!!a.carriedServices?.length;}
export function resultFor(a,mode){return !needsReview(a)&&mode==='preview'?'X3A':'X3B';}
function direct(id,a){
 if(id==='HOME')return starts[a.route];
 if(id==='CA1')return a.CA1==='Construir do zero'?'CA_AREA':a.CA1==='Ampliar um imóvel existente'?'CA_EXISTING':'CA2';
 if(id==='REG_C4')return regStarts[a.REG_R1];
 if(id==='REG_G1')return regStarts[classify(a.REG_G1)]??'X1';
 if(id==='CA7'||id==='S1'||id==='Q_GAS'||id==='Q_COMPAT')return afterServices(a,id);
 return nodes[id]?.next;
}
export function advance(id,answers,mode='missing'){
 let a={...answers};
 if(id==='X1')return {id:resultFor(a,mode),answers:a};
 if(id==='X3A'||id==='X3B')return {id:'X4',answers:a};
 if(id==='X4')return {id:'CRM',answers:a};
 if(id==='S1'&&a.services?.includes('Outro')){const route=equivalentService(a.otherService);if(route){a=switchRoute(a,route,{redirect:true});id='HOME';}}
 let next=direct(id,a);
 for(let i=0;i<60;i++){
   if(next==='X1')return {id:next,answers:a};
   if(next==='REG_D2'&&!Object.hasOwn(a,'REG_D2')&&a.REG_C4?.includes('Exigência/notificação')){a.REG_D2='Sim';a.derivedD2=true;}
   if(next==='REG_F2'&&!Object.hasOwn(a,'REG_F2')&&a.REG_C4?.includes('IPTU')&&a.REG_C4?.includes('Matrícula')){a.REG_F2='Os dois';a.derivedF2=true;}
   if(!nodes[next])throw Error('Unknown transition: '+next);
   if(!valid(next,a))return {id:next,answers:a};
   next=direct(next,a);
 }
 throw Error('Navigation loop');
}
export function routeNodes(a){
 if(a.route==='build')return ['CA1',...(a.CA1==='Construir do zero'?['CA_AREA']:a.CA1==='Ampliar um imóvel existente'?['CA_EXISTING','CA_NEW']:[]),'CA2','CA3','CA4','CA5','CA6','CA7',...serviceExtraNodes(a),'CA8'];
 if(a.route==='known')return ['S1',...serviceExtraNodes(a),'S2','S3','S4','S5','S6'];
 if(a.route==='problem')return ['P1','P2','P3','P4','P5'];
 if(a.route==='regularize'){
   const branch=a.REG_R1==='G'?classify(a.REG_G1):a.REG_R1;
   const details={A:['REG_A1','REG_A2','REG_A3'],B:['REG_B1','REG_B2','REG_B3'],C:['REG_C-R1','REG_C-R2'],D:['REG_D1','REG_D2','REG_D3'],E:['REG_E1','REG_E2','REG_E3'],F:['REG_F1','REG_F2','REG_F3']}[branch]??[];
   return ['REG_R1','REG_C1','REG_C2','REG_C3','REG_C4',...(a.REG_R1==='G'?['REG_G1']:[]),...details];
 }return [];
}
export function summary(a){
 const rows=[];const seen=new Set();
 if(a.route)rows.push({id:'HOME',label:'Necessidade',value:routes[a.route]});
 for(const id of routeNodes(a)){
   const node=nodes[id],key=keyOf(id),v=a[key];if(v===undefined||v===''||seen.has(key))continue;seen.add(key);
   let label=node.label??node.title,value;
   if(node.type==='location'){label='Localização';value=[v.city,v.uf].filter(Boolean).join(' / ');}
   else if(['area','integer'].includes(node.type))value=v.unknown?'Não sei':v.value?`${v.value}${node.type==='area'?' m²':''}`:'';
   else if(node.type==='multi'){value=(v.includes('Não sei quais preciso')?(a.suggestionConfirmed?a.confirmedSuggestions:['A definir']):v).map(s=>node.options.find(o=>o.value===s)?.label??s).join(' · ');}
   else value=node.options.find(o=>o.value===v)?.label??v;
   if(value)rows.push({id,label,value});
 }
 if(a.route==='known'&&a.services?.includes('Outro')&&a.otherService)rows.push({id:'S1',label:'Outro serviço informado',value:a.otherService});
 if(a.route==='problem'&&a.photos?.length)rows.push({id:'P2',label:'Fotos',value:`${a.photos.length} foto(s) adicionada(s) localmente`});
 if(a.originalRequest)rows.push({id:null,label:'Pedido original',value:a.originalRequest});
 if(a.carriedServices?.length)rows.push({id:null,label:'Serviços também informados',value:a.carriedServices.join(' · ')});
 if(a.route==='regularize'&&area(a.REG_A1)!==null&&area(a.REG_A2)!==null)rows.push({id:null,label:'Diferença entre as áreas',value:`${Math.abs(area(a.REG_A1)-area(a.REG_A2)).toLocaleString('pt-BR',{maximumFractionDigits:2})} m²`});
 if(a.route==='regularize'&&a.REG_R1==='G'&&!classify(a.REG_G1)&&a.REG_G1)rows.push({id:null,label:'Encaminhamento',value:'Análise necessária'});
 return rows;
}
export function missingData(a){
 if(safetyHold(a))return [];
 const list=[];
 for(const id of routeNodes(a)){
  const node=nodes[id],v=a[keyOf(id)];
  if(['area','integer'].includes(node.type)&&(!v||v.unknown))list.push(node.label??node.title);
 }
 if(a.route==='build'&&a.CA1==='Ainda estou definindo')list.push('Definição entre construção e ampliação');
 if(a.route==='build'&&a.services?.includes('Não sei quais preciso')&&!a.suggestionConfirmed)list.push('Confirmação dos projetos a avaliar');
 if(a.route==='regularize'&&a.REG_R1==='G'&&!classify(a.REG_G1))list.push('Enquadramento do caso para avaliação');
 if(a.route==='known'&&a.services?.includes('Outro'))list.push('Definição do escopo do serviço informado');
 if(a.carriedServices?.length)list.push('Escopo dos serviços também informados');
 return [...new Set(list)];
}
// V1 LEGADO — mantido apenas para regressão. A experiência ativa emite V2 (src/payload_v2.mjs).
export function packageForCRM(a,mode){
 const {photos,contact,...data}=a;
 return {source:'IT083',prototype:true,sent_to_crm:false,route:a.route,summary:summary(a),answers:data,contact,attachments:(photos??[]).map(({name,size,type})=>({name,size,type,uploaded:false})),safety_review_required:safetyHold(a),result:resultFor(a,mode),preview:resultFor(a,mode)==='X3A'?{simulated:true,min:1500,max:2500,currency:'BRL',rule:'UX-FIXTURE-NOT-A-PRICE'}:null};
}
