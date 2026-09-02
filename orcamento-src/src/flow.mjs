import { map } from './map.js';

export const nodes = Object.fromEntries(map.nodes.map(n => [n.id, n]));
export const branchStarts = { A:'A1', B:'B1', C:'C-R1', D:'D1', E:'E1', F:'F1', G:'G1' };
export const common = ['R1','C1','C2','C3','C4'];
export const numeric = ['A1','A2','B2','E2'];
export const unknownDocuments = 'Não sei/não tenho agora';
export const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export function options(id) { return nodes[id].options_or_fields.split(' · ').map((label,i) => ({ value:id==='R1' ? 'ABCDEFG'[i] : label, label:id==='R1' ? label.replace(/^[A-G]\. /,'') : label })); }
export function area(answer) {
  if (!answer || answer.unknown || !/^\d+(?:[.,]\d{1,2})?$/.test(answer.value?.trim() ?? '')) return null;
  const n=Number(answer.value.replace(',','.')); return Number.isFinite(n) && n>0 ? n : null;
}
export function difference(answers) {
  const a=area(answers.A1), b=area(answers.A2);
  return a===null || b===null ? null : Math.round(Math.abs(a-b)*100)/100;
}
export function valid(id, answers) {
  const a=answers[id];
  if (['R0','X1','X3A','X3B'].includes(id)) return true;
  if (id==='C2') return !!a?.city?.trim() && ufs.includes(a?.uf);
  if (id==='C4') return Array.isArray(a) && a.length>0 && a.every(x=>options(id).some(o=>o.value===x)) && !(a.includes(unknownDocuments)&&a.length>1);
  if (numeric.includes(id)) return a?.unknown===true || area(a)!==null;
  if (id==='G1') return typeof a==='string' && !!a.trim() && a.length<=280;
  if (id==='X4') {
    const phone=a?.whatsapp?.replace(/\D/g,'') ?? '';
    return !!a?.name?.trim() && (!!phone || !!a?.email?.trim()) && (!a?.whatsapp?.trim() || /^\d{10,13}$/.test(phone)) && (!a?.email?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim()));
  }
  return options(id).some(o=>o.value===a);
}
export function setAnswer(answers,id,value) {
  const next={...answers,[id]:value};
  // A different situation invalidates only the branch details, not the common trunk.
  if (id==='R1' && value!==answers.R1) for(const key of Object.keys(next)) if(!common.includes(key) && key!=='X4') delete next[key];
  if(id==='G1' && value!==answers.G1) for(const key of Object.keys(next)) if(!common.includes(key)&&key!=='X4'&&key!=='G1') delete next[key];
  // Derived answers must not survive changed source documents.
  if(id==='C4') { if(next._derivedD2) {delete next.D2;delete next._derivedD2;} if(next._derivedF2){delete next.F2;delete next._derivedF2;} }
  if(id==='D2')delete next._derivedD2;
  if(id==='F2')delete next._derivedF2;
  return next;
}
export function toggleDocument(current,value) {
  if(value===unknownDocuments) return current.includes(value)?[]:[value];
  const list=current.filter(v=>v!==unknownDocuments);
  return list.includes(value)?list.filter(v=>v!==value):[...list,value];
}
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
// Conservative local demonstration, NOT an AI service. Ambiguity stays unclassified.
export function classify(text='') {
  const t=normalize(text); const hits=[];
  if (/(nao falta|nao esta faltando|nao recebi|nao apontou|nao esta diferente|nao ha diferenca|nao existe diferenca)/.test(t)) return null;
  if (/iptu/.test(t)&&/matricula/.test(t)&&/(nao bate|difer|diverg)/.test(t)) hits.push('A');
  if (/(construi|ampliei)/.test(t)&&/nao regularizei/.test(t)&&!/(nao construi|nao ampliei)/.test(t)) hits.push('B');
  if (/(falta|faltando) (um |algum )?documento/.test(t)) hits.push('C');
  if (/(prefeitura|cartorio)/.test(t)&&/(apontou|recebi).*(pendencia|exigencia|notificacao)/.test(t)) hits.push('D');
  if (/imovel.*diferente.*(planta|projeto)/.test(t)) hits.push('E');
  if (/nao sei (exatamente )?(o que|qual).*(irregular|problema)/.test(t)) hits.push('F');
  return hits.length===1?hits[0]:null;
}
export function effectiveBranch(a) { return a.R1==='G'?classify(a.G1):a.R1; }
export function advance(id,answers,gate='missing') {
  let a={...answers}; let next=nodes[id]?.transitions[0]?.to;
  if(id==='C4') next=branchStarts[a.R1];
  const visited=[];
  for(let guard=0;guard<40;guard++) {
    if(!next || next==='CRM') return {node:next,answers:a,internal:visited};
    if(next==='G2') {visited.push('G2');next=branchStarts[classify(a.G1)]??'X1';continue;}
    if(next==='X2') {visited.push('X2');next=gate==='preview'?'X3A':'X3B';continue;}
    if(next==='D2' && !Object.hasOwn(a,'D2') && a.C4?.includes('Exigência/notificação')) {a.D2='Sim';a._derivedD2=true;}
    if(next==='F2' && !Object.hasOwn(a,'F2') && a.C4?.includes('IPTU') && a.C4?.includes('Matrícula')) {a.F2='Os dois';a._derivedF2=true;}
    if(!next.startsWith('X') && next!=='R0' && valid(next,a)) { next=next==='C4'?branchStarts[a.R1]:nodes[next].transitions[0].to;continue; }
    return {node:next,answers:a,internal:visited};
  }
  throw new Error('IT075 transition limit exceeded');
}
export const detailsLabels={A1:'Área no IPTU',A2:'Área na matrícula',A3:'Motivo da diferença',B1:'Alteração',B2:'Área da alteração',B3:'Projeto da alteração','C-R1':'Documento faltante','C-R2':'Falta apontada por',D1:'Pendência apontada por',D2:'Exigência disponível',D3:'Assunto da exigência',E1:'Alteração no imóvel',E2:'Área afetada',E3:'Sabe quando aconteceu',F1:'Como soube',F2:'IPTU e matrícula',F3:'Recebeu explicação',G1:'Descrição informada'};
export function summary(a) {
  const out=[];
  if(a.C1)out.push({id:'C1',label:'Finalidade',value:a.C1});
  if(a.C3)out.push({id:'C3',label:'Imóvel',value:a.C3});
  if(a.C2?.city || a.C2?.uf)out.push({id:'C2',label:'Localização',value:[a.C2.city,a.C2.uf].filter(Boolean).join(' / ')});
  if(a.C4?.length)out.push({id:'C4',label:'Documentos disponíveis',value:a.C4.join(' · ')});
  if(a.R1)out.push({id:'R1',label:'Situação',value:options('R1').find(o=>o.value===a.R1)?.label});
  for(const [id,label] of Object.entries(detailsLabels)) if(Object.hasOwn(a,id))out.push({id,label,value:numeric.includes(id)?(a[id].unknown?'Não sei':area(a[id])!==null?`${a[id].value} m²`:''):a[id]});
  const diff=difference(a); if(diff!==null)out.push({id:null,label:'Diferença entre as áreas',value:`${diff.toLocaleString('pt-BR')} m²`});
  return out.filter(row=>row.value);
}
export function missingData(a) {
  const missing=[]; const branch=effectiveBranch(a);
  if(!branch)missing.push('Identificação segura da situação do imóvel.');
  for(const [id,label] of Object.entries(detailsLabels)) {
    if(!Object.hasOwn(a,id))continue;
    if(numeric.includes(id)&&area(a[id])===null)missing.push(label+'.');
    else if(typeof a[id]==='string'&&['Não sei','Nenhum/não sei'].includes(a[id]))missing.push(label+'.');
  }
  if(a.C4?.includes(unknownDocuments))missing.push('Disponibilidade dos documentos do imóvel.');
  return [...new Set(missing)];
}
export function localPackage(a,gate) {return {prototype:true,sent_to_crm:false,source:'IT075',situation:a.R1,branch:effectiveBranch(a),summary:summary(a),answers:Object.fromEntries(Object.entries(a).filter(([k])=>!k.startsWith('_')&&k!=='X4')),contact:a.X4,preview:gate==='preview'?{simulated:true,min:1500,max:2500,currency:'BRL',rule:'UX-FIXTURE-NOT-A-PRICE'}:null};}
