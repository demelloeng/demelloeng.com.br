import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,CaretDown,PencilSimple,X,DownloadSimple,ClipboardText,Plus} from '@phosphor-icons/react';
import {REFORMA,nodes,routes,starts,keyOf,titleOf,isProject,valid,toggle,updateAnswer,switchRoute,advance,routeNodes,summary,suggestedServices,safetyHold,missingData,ufs,areaZeroValid,HOURLY} from './journey.mjs';
import {packageForCRMv2} from './payload_v2.mjs';
import {initialState,deeplinkInfo} from './deeplink.mjs';
import {allowedIntents,isIntentAllowed,estimateState,canSend,INTENT_LABEL,LEAD_STAGE,SCOPE_QUESTION_MAX,scopeQuestionError,SCOPE_QUESTION_MESSAGE} from './funnel.mjs';
import {architectureReturn} from './architecture_return.mjs';
import {PADROES} from './architecture_estimator.mjs';
import {tracking} from './tracking.mjs';
import {TABLE_LABEL,ENTRY_COUNT_WORD} from './labels.mjs';
import {submitToCRM} from './submit.mjs';
import {issuePreview,caseSummaryFromRows} from './preview.mjs';
import {renderPreviewPng} from './preview_png.mjs';
import {brlStr} from './pricing/decimal.mjs';
import {referenceEntries} from './references.mjs';
import {buildClientSummary,friendlyServiceName as serviceName,NEXT_STEP} from './client_summary.mjs';

const SUBMIT_LABEL={proposal:'Enviar pedido de proposta',scope_question:'Enviar minha dúvida',evaluation_only:'Enviar meu caso'};
const SENT_TITLE={proposal:'Recebemos seu pedido de proposta.',scope_question:'Recebemos sua dúvida sobre o escopo.',evaluation_only:'Recebemos as informações do seu caso.'};
const SENT_TEXT={proposal:'A DEMELLO vai analisar seu caso e poderá entrar em contato pelos dados que você informou para confirmar o escopo antes de qualquer proposta. Receber o pedido não é aceite comercial, e a estimativa não é proposta nem garantia de preço. Você pode baixar um resumo legível para guardar; as fotos não são enviadas.',scope_question:'A DEMELLO vai analisar seu caso e poderá entrar em contato pelos dados que você informou para esclarecer o escopo. Você pode baixar um resumo legível para guardar; as fotos não são enviadas.',evaluation_only:'A DEMELLO vai analisar e poderá entrar em contato pelos dados que você informou. Você pode baixar um resumo legível para guardar; as fotos não são enviadas.'};
const descriptions={build:'Projetos para uma obra nova, reforma ou ampliação.',regularize:'Diferenças de área ou pendências nos documentos.',problem:'Entender uma situação no imóvel ou na obra.',known:'Ir direto ao projeto ou serviço que preciso.',support:'Consultoria ou mentoria técnica, por hora.'};
function Dialog({title,onClose,children}){const ref=useRef(null);useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><header><h2 id="dialog-title">{title}</h2><button onClick={onClose} className="icon-button" aria-label="Fechar"><X size={24}/></button></header>{children}</dialog>;}
// Devolutiva da Arquitetura (cliente sem a área do projeto): ponto de partida, referência do orçamento, origem, preço inicial, explicação, ressalva e próximo passo.
function ArchitectureReturn({ret,combined}){
 if(!ret)return null;
 return <section className="arch-return" aria-labelledby="arch-return-title"><h2 id="arch-return-title">{ret.title}</h2>
  {ret.rows.length>0&&<dl className="arch-facts">{ret.rows.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
  {ret.paragraphs.map(t=><p key={t}>{t}</p>)}
  {combined&&ret.price&&<p className="small-note">Este valor é só o da Arquitetura. Os demais serviços seguem a avaliação da equipe, cada um com a sua área.</p>}
  {ret.why&&<><h3>{ret.why.title}</h3><p>{ret.why.text}</p></>}
  <p className="small-note">{ret.disclaimer}</p>
  <p className="arch-next">{ret.next}</p>
 </section>;
}
const NUMS=(max,min=0)=>Array.from({length:max-min+1},(_,i)=>String(min+i));
const PADRAO_LABEL={compacto:'Compacto',confortavel:'Confortável',amplo:'Amplo'};
// Programa de necessidades (só quando a área do projeto de Arquitetura é desconhecida). Só escolhas estruturadas — nenhum texto livre.
function ProgramForm({value,onChange}){
 const unknown=value?.unknown===true,v=unknown?{}:(value??{});
 const set=(k,val)=>onChange({...v,[k]:val});
 const sel=(k,label,max,min=0)=><label key={k}>{label}<select value={v[k]??''} disabled={unknown} onChange={e=>set(k,e.target.value)}><option value="">Selecione</option>{NUMS(max,min).map(n=><option key={n} value={n}>{n}</option>)}</select></label>;
 const chk=(k,label)=><label className="program-check" key={k}><input type="checkbox" checked={v[k]===true} disabled={unknown} onChange={e=>set(k,e.target.checked)}/>{label}</label>;
 return <div className="program-form">
  <div className="program-grid">{sel('quartos','Quartos (sem contar suítes)',10)}{sel('suites','Suítes',10)}{sel('banheiros','Banheiros (fora das suítes)',10)}{sel('garagem','Vagas de garagem',6)}{sel('pavimentos','Pavimentos',4,1)}</div>
  <fieldset className="program-checks" disabled={unknown}><legend>Ambientes</legend>{chk('sala','Sala')}{chk('cozinha','Cozinha')}{chk('lavanderia','Lavanderia')}{chk('escritorio','Escritório')}{chk('varanda','Varanda ou área gourmet')}</fieldset>
  <fieldset className="choices compact program-padrao" disabled={unknown}><legend>Padrão pretendido</legend>{PADROES.map(p=><label className={`choice ${v.padrao===p?'selected':''}`} key={p}><span>{PADRAO_LABEL[p]}</span><input type="radio" name="arq-padrao" checked={v.padrao===p} onChange={()=>set('padrao',p)}/></label>)}</fieldset>
  <label className="unknown"><input type="checkbox" checked={unknown} onChange={e=>onChange(e.target.checked?{unknown:true}:{})}/>Ainda não sei os ambientes</label>
 </div>;
}
function Summary({rows,onEdit}){return <dl className="summary-list">{rows.map((row,i)=><div className={`summary-row ${row.id?'':'derived'}`} key={`${row.id}-${i}`}><dt>{row.label}</dt><dd>{row.value}</dd>{row.id&&<button type="button" className="edit-button" aria-label={`Editar ${row.label}`} onClick={()=>onEdit(row.id)}><PencilSimple size={17}/></button>}</div>)}</dl>;}
const Q_PT={Q_NOVA:'área nova',Q_TOTAL:'área total',Q_ATENDIDA:'área atendida',Q_TERRENO:'área do terreno',Q_ESCOPO:'área do escopo',Q_REGULARIZACAO:'diferença de área',Q_SUPERESTRUTURA:'área estrutural total',Q_FUNDACAO:'área de projeção',Q_HORAS:'horas técnicas'};
const qUnit=s=>s.q_basis==='Q_HORAS'?'h':'m²';
const pricingText=pv=>pv.presented_to_customer.text.replace(/Entraremos em contato para confirmar as particularidades e o escopo\./,NEXT_STEP).replace(/nossa previsão inicial/g,'nossa estimativa inicial');
function Result({answers,isPreview}){
 const held=safetyHold(answers),missing=missingData(answers);
 const payload=packageForCRMv2(answers);
 const pv=payload.pricing_preview;
 const calc=pv.services.filter(s=>s.status==='CALCULATED');
 const archRet=architectureReturn(answers),reformNote=answers.route==='build'&&answers.CA1===REFORMA?'Reforma sem aumento de área: só calculamos quando há dados suficientes para o serviço escolhido. Quando não há, a equipe avalia o caso — nenhuma área nova é presumida.':null;
 const notes=<>{archRet&&<ArchitectureReturn ret={archRet} combined={(answers.services??[]).length>1}/>}{reformNote&&<p className="small-note">{reformNote}</p>}</>;
 const [pState,setPState]=useState('idle');
 const [pRecord,setPRecord]=useState(null);
 const [pngUrl,setPngUrl]=useState('');
 useEffect(()=>()=>{if(pngUrl)URL.revokeObjectURL(pngUrl);},[pngUrl]);
 async function gerarPrevia(){
  if(pState==='issuing')return;
  setPState('issuing');
  const cs=caseSummaryFromRows(payload.summary,pv.services.map(serviceName));
  const r=await issuePreview(payload.pricing_inputs,cs);
  if(!r.ok){setPState('error');return;}
  setPRecord(r.record);
  try{const blob=await renderPreviewPng(r.record);setPngUrl(URL.createObjectURL(blob));setPState('ready');}
  catch{setPState('error');}
 }
 if(isPreview&&pv.status==='CALCULATED'){
  return <div className="result-card">
   <span className="eyebrow">ESTIMATIVA INICIAL DEMELLO</span>
   <p className="investment">{brlStr(pv.total_demello)}</p>
   <p>{pricingText(pv)}</p>
   <details className="pricing-breakdown"><summary>Como chegamos a esse valor</summary>
    <ul>{calc.map(s=><li key={s.service}><strong>{serviceName(s)}</strong> · {Q_PT[s.q_basis]??s.q_basis} {s.q} {qUnit(s)}{s.q_fundacao!=null?` · área de projeção ${s.q_fundacao} m²`:''}{referenceEntries(s.references).map(r=>` · ${r.label} ${brlStr(r.total)}`).join('')} · DEMELLO {brlStr(s.demello.total)}</li>)}</ul>
    {notes}
    <p className="small-note">Estimativa calculada a partir da referência pública aplicável e da metodologia DEMELLO. Não é proposta, contrato nem garantia de preço; o escopo final é confirmado pela equipe.</p>
   </details>
   <div className="preview-issue">
    {pState!=='ready'&&<button type="button" className="secondary-button" disabled={pState==='issuing'} onClick={gerarPrevia}>{pState==='issuing'?'Gerando prévia…':'Gerar prévia DEMELLO'}</button>}
    {pState==='error'&&<p className="field-error" role="alert">Não foi possível gerar a prévia agora. A estimativa acima continua disponível.</p>}
    {pState==='ready'&&pRecord&&<div className="preview-ready" role="status">
     <p>Prévia emitida · código <strong>{pRecord.verification_code}</strong></p>
     <p className="small-note">Registro verificável em demelloeng.com.br/verificar. A imagem é uma representação da prévia registrada — não é proposta, contrato nem orçamento de obra.</p>
     <a className="secondary-button" href={pngUrl} download={`demello-previa-${pRecord.verification_code}.png`}><DownloadSimple size={20}/>Baixar prévia</a>
    </div>}
   </div>
  </div>;
 }
 return <div className={`result-card ${held?'needs-review':''}`}>
  {held?<><h2>Esse caso precisa de avaliação antes de uma estimativa.</h2><p>Procure a equipe DEMELLO para avaliar o caso. Esta interface não confirma a segurança do imóvel.</p></>
   :isPreview?<><h2>Ainda não dá para calcular uma estimativa automática.</h2>{notes}<p>{NEXT_STEP}</p></>
   :<><h2>{missing.length?'Falta confirmar:':'O escopo precisa ser confirmado antes da estimativa.'}</h2>{missing.length>0&&<ul>{missing.map(x=><li key={x}>{x}</li>)}</ul>}{notes}</>}
 </div>;}

export function App(){
 const [init]=useState(()=>initialState(typeof window!=='undefined'?window.location.search:''));
 const [deeplink]=useState(()=>deeplinkInfo(typeof window!=='undefined'?window.location.search:''));
 const entries=useRef({first:true,byRoute:{}});
 const [id,setId]=useState(init.id),[answers,setAnswers]=useState(init.answers),[history,setHistory]=useState(init.history),[modal,setModal]=useState(null),[expanded,setExpanded]=useState(false),[aux,setAux]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const [sendState,setSendState]=useState('idle'),[sendResult,setSendResult]=useState(null),[hp,setHp]=useState('');
 const mode='preview';
 const heading=useRef(null),fileInput=useRef(null),photoRef=useRef([]),sentPayload=useRef(null);
 function sendCase(payload){setSendState('sending');submitToCRM(payload,hp).then(r=>{setSendResult(r);setSendState(r.ok?'sent':'error');if(r.ok)tracking.submissionAccepted({answers:payload.answers,sendResult:r,contactValid:valid('X4',{contact:payload.contact}),mode});});}
 const node=nodes[id],sqError=answers.request_intent==='scope_question'?scopeQuestionError(answers.scope_question):null,key=keyOf(id),value=answers[key],rows=summary(answers),home=id==='HOME',canContinue=valid(id,answers)&&(id!=='X4'||canSend(answers,mode))&&!id.startsWith('X3'),resultStep=id==='X3A'||id==='X3B',project=isProject(answers),suggesting=id==='CA7'&&answers.services?.includes('Não sei quais preciso');
 useEffect(()=>{photoRef.current=answers.photos??[];},[answers.photos]);
 useEffect(()=>()=>photoRef.current.forEach(p=>URL.revokeObjectURL(p.url)),[]);
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});setError('');setCopied(false);},[id]);
 // Mensuração (adaptador neutro; só parâmetros controlados; deduplicada — ver src/tracking.mjs e docs/MENSURACAO_FUNIL.md).
 useEffect(()=>{tracking.pageView();},[]);
 useEffect(()=>{const route=answers.route;if(!route||id!==starts[route])return;let rec=entries.current.byRoute[route];if(!rec){const first=entries.current.first;entries.current.first=false;const entry=first&&deeplink&&deeplink.route===route?'deeplink':answers.redirectedFrom?'redirect':'manual';rec={entry,service:entry==='deeplink'?deeplink.analyticsService:null};entries.current.byRoute[route]=rec;}tracking.situation({route,entry:rec.entry,service:rec.service??undefined,step:id});},[id,answers.route]);
 useEffect(()=>{if(id==='X3A'||id==='X3B')tracking.result(answers,id,mode);},[id]);
 const release=photos=>(photos??[]).forEach(p=>URL.revokeObjectURL(p.url));
 function change(value){if(id==='HOME'&&value!==answers.route)release(answers.photos);setAnswers(a=>updateAnswer(a,id,value));if(id!=='X4')setHistory(h=>h.filter(x=>!x.startsWith('X')));setSubmitted(false);setSendState('idle');setError('');}
 function patch(values){setAnswers(a=>({...a,...values}));setSubmitted(false);setSendState('idle');setError('');}
 function chooseIntent(intent){if(!resultStep||!isIntentAllowed(answers,intent,mode))return;const a={...answers,request_intent:intent,estimate_state:estimateState(answers,mode),lead_stage:LEAD_STAGE[intent]};if(answers.request_intent!==intent)delete a.scope_question;const result=advance(id,a,mode);setAnswers(result.answers);setHistory(h=>[...h,id]);setId(result.id);setExpanded(false);}
 function next(e){e.preventDefault();if(!canContinue)return;if(id==='X4'){if(sendState==='sending')return;const snapshot=packageForCRMv2(answers);sentPayload.current=snapshot;setSubmitted(true);sendCase(snapshot);return;}const result=advance(id,answers,mode);setAnswers(result.answers);setHistory(h=>result.answers.route!==answers.route?['HOME']:[...h,id]);setId(result.id);setExpanded(false);}
 function back(){if(!history.length)return;setId(history.at(-1));setHistory(h=>h.slice(0,-1));setSubmitted(false);setExpanded(false);}
 function edit(target){const path=routeNodes(answers),index=path.indexOf(target);setHistory(target==='HOME'?[]:['HOME',...path.slice(0,Math.max(0,index))]);setId(target);setSubmitted(false);setExpanded(false);}
 function reset(){release(answers.photos);setAnswers({});setId('HOME');setHistory([]);setSubmitted(false);setSendState('idle');setSendResult(null);setHp('');sentPayload.current=null;setExpanded(false);setAux(false);setModal(null);}
 function redirect(route){release(answers.photos);setAnswers(a=>switchRoute(a,route,{redirect:id==='S1'}));setHistory(['HOME']);setId(starts[route]);setAux(false);setSubmitted(false);}
 async function addPhotos(e){
   const files=Array.from(e.target.files??[]);e.target.value='';const next=[...(answers.photos??[])];let issue='';
   for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)){issue='Use fotos JPG, PNG ou WebP.';continue;}if(file.size>8*1024*1024){issue='Cada foto pode ter até 8 MB.';continue;}if(next.length>=6){issue='Você pode adicionar até 6 fotos nesta demonstração.';break;}next.push({name:file.name,size:file.size,type:file.type,url:URL.createObjectURL(file)});}
   patch({photos:next});setError(issue);
 }
 function removePhoto(index){const photos=answers.photos??[];URL.revokeObjectURL(photos[index].url);patch({photos:photos.filter((_,i)=>i!==index)});}
 function download(){const payload=sentPayload.current??packageForCRMv2(answers);const text=buildClientSummary(payload);const url=URL.createObjectURL(new Blob([`\uFEFF${text}`],{type:'text/plain;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='demello-resumo-do-seu-caso.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function copy(){try{await navigator.clipboard.writeText(rows.map(r=>`${r.label}: ${r.value}`).join('\n'));setCopied(true);}catch{setError('Selecione o texto do resumo para copiar.');}}
 const selectCards=()=>{const multi=node.type==='multi';return <fieldset className={`choices ${home?'entry-grid':''} ${node.options.length>5&&!home?'compact':''} ${id==='S1'?'service-grid':''}`}><legend className="sr-only">{node.title}</legend>{node.options.map(option=><label className={`choice ${(multi?value?.includes(option.value):value===option.value)?'selected':''}`} key={option.value}><span>{home?<><strong>{option.label}</strong><small>{descriptions[option.value]}</small></>:option.label}</span><input type={multi?'checkbox':'radio'} name={id} checked={multi?!!value?.includes(option.value):value===option.value} onChange={()=>change(multi?toggle(value,option.value,id==='REG_C4'?'Não sei/não tenho agora':id==='CA7'?'Não sei quais preciso':undefined):option.value)}/></label>)}</fieldset>;};
 const stage=home?0:id==='X4'?3:id.startsWith('X3')?2:id==='X1'?1:1;
 return <div className={`app-shell global-v1 ${home?'is-entry':''}`}>
 <a className="skip-link" href="#question">Ir para a pergunta</a>
 <header className="site-header"><a href="/" aria-label="DEMELLO — página inicial"><img src="/assets/images/logo.png" alt="DEMELLO Engenharia"/></a><span>CALCULAR ESTIMATIVA</span><a className="site-link" href="/" aria-label="Voltar ao site"><span>Voltar ao site</span></a></header>
 <div className="workspace"><main className="question-panel" id="question" data-state={id}>
 {!home&&<div className="section-label"><button type="button" className="icon-button" onClick={back} aria-label="Voltar à pergunta anterior"><ArrowLeft size={18}/></button><span>{routes[answers.route]}</span></div>}
 <h1 tabIndex={-1} ref={heading}>{titleOf(id,answers)}</h1>
 {home&&<p className="helper entry-helper">Escolha o que mais se aproxima do seu caso. Não precisa saber o nome técnico.</p>}
 {node.type==='multi'&&!suggesting&&<p className="helper">Pode marcar mais de uma opção.</p>}
 {id==='SUP1'&&<p className="helper">Consultoria é apoio técnico pontual; mentoria é acompanhamento para você aprender e se desenvolver. Nenhuma das duas é execução de projeto nem gera ART automaticamente.</p>}
 {id==='S1'&&value?.some(s=>HOURLY.includes(s))&&<p className="helper">Consultoria e mentoria técnica são apoio por hora: não são execução de projeto nem geram ART automaticamente.</p>}
 {id==='P2'&&<p className="helper">Não precisa saber o nome técnico. Explique do seu jeito ou envie uma foto.</p>}
 {id==='S3'&&answers.services?.includes('Arquitetura')&&<p className="helper">Para a arquitetura, é a área construída pretendida do projeto. Não sabe? Marque “Ainda não sei”: perguntamos o terreno e o que você imagina para a casa, e estimamos uma área de referência para o orçamento.</p>}
 {id==='ARQ_PROG'&&<p className="helper">Conte o que você imagina — é só para estimar a área, não é projeto. Se ainda não sabe, marque “Ainda não sei os ambientes”.</p>}
 {id==='Q_TERR_ARQ'&&<p className="helper">O terreno ajuda a estimar uma faixa de referência para o orçamento. Não é potencial construtivo, e a construção normalmente não ocupa o terreno todo. Não sabe? Marque “Ainda não sei”.</p>}
 
 {id==='Q_TERR'&&<p className="helper">Informe somente a área do terreno. Não usamos área construída, área nova nem volume no lugar dela.</p>}
 {id==='Q_ORC'&&<p className="helper">É a área que o orçamento técnico vai abranger. Orçamento técnico é um serviço contratado: não é esta estimativa nem o orçamento final da obra.</p>}
 {id==='Q_FUND'&&<p className="helper">É a área que a construção ocupa no chão. Em um térreo, é igual à área construída; com mais de um pavimento, informe só a área do pavimento que toca o solo.</p>}
 {id==='X1'&&<p className="helper">Confira as informações. Você pode editar qualquer resposta.</p>}
 <form id="question-form" onSubmit={next} noValidate>
 {['entry','single','multi'].includes(node.type)&&!suggesting&&selectCards()}
 {id==='S1'&&value?.includes('Outro')&&<label className="text-field contextual-field">Qual serviço?<input maxLength={180} placeholder="Nome do serviço que você procura" value={answers.otherService??''} onChange={e=>patch({otherService:e.target.value})}/><span className="small-note">Regularização e avaliação técnica seguem para suas rotas, com os dados compatíveis preservados.</span></label>}
 {id==='S1'&&<div className="route-shortcuts"><span>É outro tipo de atendimento?</span><button type="button" className="text-button" onClick={()=>redirect('regularize')}>Regularização</button><button type="button" className="text-button" onClick={()=>redirect('problem')}>Avaliação técnica</button></div>}
 {suggesting&&<section className="suggestions" aria-labelledby="suggestions-title"><h2 id="suggestions-title">Projetos que fazem sentido avaliar</h2><p>Sugestão ilustrativa com base no tipo de empreendimento e nos pavimentos informados. Ajuste e confirme; não é uma definição técnica do escopo.</p><fieldset className="choices"><legend className="sr-only">Ajustar projetos sugeridos</legend>{nodes.CA7.options.filter(o=>o.value!=='Não sei quais preciso').map(o=><label className={`choice ${(answers.confirmedSuggestions??suggestedServices(answers)).includes(o.value)?'selected':''}`} key={o.value}><span>{o.label}</span><input type="checkbox" checked={(answers.confirmedSuggestions??suggestedServices(answers)).includes(o.value)} onChange={()=>patch({confirmedSuggestions:toggle(answers.confirmedSuggestions??suggestedServices(answers),o.value),suggestionConfirmed:false})}/></label>)}</fieldset><button type="button" className="secondary-button" disabled={!(answers.confirmedSuggestions??suggestedServices(answers)).length} onClick={()=>patch({confirmedSuggestions:answers.confirmedSuggestions??suggestedServices(answers),suggestionConfirmed:true})}>{answers.suggestionConfirmed?<><Check size={18}/>Seleção confirmada</>:'Confirmar projetos para avaliação'}</button><button type="button" className="text-button" onClick={()=>change([])}>Voltar à seleção de projetos</button></section>}
 {node.type==='location'&&<div className="location-fields"><label>Cidade<input autoComplete="address-level2" maxLength={90} value={value?.city??''} onChange={e=>change({...value,city:e.target.value})}/></label><label>UF<select autoComplete="address-level1" value={value?.uf??''} onChange={e=>change({...value,uf:e.target.value})}><option value="">Selecione</option>{ufs.map(uf=><option key={uf}>{uf}</option>)}</select></label></div>}
 {node.type==='program'&&<ProgramForm value={value} onChange={change}/>}
 {['area','integer','hours'].includes(node.type)&&<div className="area-fields"><label htmlFor="measure">{node.type==='integer'?'Número de pavimentos':(node.label??'Área informada')}</label><div className="measure"><input id="measure" inputMode={node.type==='integer'?'numeric':'decimal'} maxLength={node.type==='integer'?3:14} placeholder={node.type==='integer'?'Ex.: 2':node.type==='hours'?'Ex.: 5':'0,00'} disabled={value?.unknown??false} value={value?.value??''} onChange={e=>change({value:e.target.value,unknown:false})}/>{node.type==='area'&&<span>m²</span>}{node.type==='hours'&&<span>h</span>}</div>{node.type!=='hours'&&<label className="unknown"><input type="checkbox" checked={value?.unknown??false} onChange={e=>change({value:'',unknown:e.target.checked})}/>{id.startsWith('REG_')?'Não sei':'Ainda não sei'}</label>}{value?.value&&!canContinue&&<p className="field-error">{node.type==='integer'?'Informe um número inteiro entre 1 e 200.':areaZeroValid(id)?'Use um número igual ou maior que zero, sem separador de milhar e com até duas casas decimais.':'Use um valor maior que zero, sem separador de milhar, com até duas casas decimais.'}</p>}</div>}
 {['text','story'].includes(node.type)&&<><label className="text-field" htmlFor="story">{node.type==='story'?'Seu relato':id==='HRS_CTX'?'O que você precisa?':'O que está acontecendo?'}</label><textarea id="story" rows={3} maxLength={node.type==='story'?600:280} placeholder={node.type==='story'?'Conte em poucas palavras...':'Uma frase é suficiente.'} value={value??''} onChange={e=>change(e.target.value)}/><div className="character-count">{value?.length??0}/{node.type==='story'?600:280}</div></>}
 {id==='P2'&&<div className="photos"><input className="sr-only" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Selecionar fotos opcionais" onChange={addPhotos}/><button type="button" className="secondary-button" onClick={()=>fileInput.current?.click()}><Plus size={20}/>Adicionar fotos</button><p className="small-note">Opcional · Até 6 fotos JPG, PNG ou WebP, de até 8 MB cada. As imagens ficam apenas nesta página, sem envio ou análise automática.</p>{!!answers.photos?.length&&<ul className="photo-list">{answers.photos.map((p,i)=><li key={p.url}><img src={p.url} alt={`Foto anexada: ${p.name}`}/><span>{p.name}</span><button type="button" className="icon-button" aria-label={`Remover foto ${i+1}`} onClick={()=>removePhoto(i)}><X size={18}/></button></li>)}</ul>}<p className="examples">Exemplos: “Apareceu uma rachadura depois da reforma.” · “Quero tirar uma parede.” · “Tem água aparecendo no teto.” · “Quero avaliar o imóvel antes de comprar.”</p></div>}
 {id==='X1'&&<div className="review-summary"><Summary rows={rows} onEdit={edit}/></div>}
 {(id==='X3A'||id==='X3B')&&<Result answers={answers} isPreview={id==='X3A'}/>}
 {id==='X4'&&!submitted&&answers.request_intent==='scope_question'&&<div className="scope-question"><label className="text-field" htmlFor="scope-question">Qual é a sua dúvida?</label><textarea id="scope-question" rows={3} maxLength={SCOPE_QUESTION_MAX} placeholder="Uma ou duas frases bastam." aria-describedby="scope-question-count scope-question-error" aria-invalid={!!(sqError&&answers.scope_question)} value={answers.scope_question??''} onChange={e=>patch({scope_question:e.target.value})}/><div id="scope-question-count" className="character-count">{(answers.scope_question??'').length}/{SCOPE_QUESTION_MAX} · limite de {SCOPE_QUESTION_MAX} caracteres</div><p id="scope-question-error" className="field-error" role="alert">{sqError&&answers.scope_question?SCOPE_QUESTION_MESSAGE[sqError]:''}</p></div>}
 {id==='X4'&&!submitted&&<><p className="helper">Seu nome e pelo menos um meio de contato.</p><div className="contact-fields">{[['name','Nome','text'],['whatsapp','WhatsApp','tel'],['email','E-mail','email']].map(([field,label,type])=><label key={field}>{label}<input type={type} autoComplete={field==='whatsapp'?'tel':field} maxLength={field==='whatsapp'?24:160} value={value?.[field]??''} onChange={e=>change({...value,[field]:e.target.value})}/></label>)}</div><div aria-hidden="true" style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0 0 0 0)',whiteSpace:'nowrap'}}><label>Não preencha este campo<input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={e=>setHp(e.target.value)}/></label></div><p className="small-note">Ao concluir, você envia estes dados e as respostas do seu caso para a DEMELLO Engenharia, que poderá usá-los para analisar seu caso e entrar em contato pelos meios informados. As fotos não são enviadas. {answers.request_intent==='scope_question'?'A sua dúvida segue junto com o caso. ':''}Veja Privacidade.</p></>}
 {id==='X4'&&submitted&&sendState==='sending'&&<div className="result-card" role="status" aria-live="polite"><p>Enviando as informações do seu caso…</p></div>}
 {id==='X4'&&submitted&&sendState==='sent'&&<div className="result-card success" role="status"><Check size={36}/><h2>{SENT_TITLE[answers.request_intent]??'Recebemos as informações do seu caso.'}</h2><p>{SENT_TEXT[answers.request_intent]??SENT_TEXT.evaluation_only}</p><button type="button" className="secondary-button" onClick={download}><DownloadSimple size={20}/>Baixar resumo do seu caso</button></div>}
 {id==='X4'&&submitted&&sendState==='error'&&<div className="result-card needs-review" role="alert"><h2>Não foi possível enviar agora.</h2><p>Sua estimativa e o resumo continuam disponíveis. Tente enviar novamente ou fale com a DEMELLO pelos canais do site.</p><div className="actions"><button type="button" className="secondary-button" onClick={()=>sendCase(sentPayload.current)}>Tentar enviar novamente</button><button type="button" className="secondary-button" onClick={download}><DownloadSimple size={20}/>Baixar resumo do seu caso</button></div></div>}
 </form>
 {home&&<div className="auxiliary"><button type="button" className="text-button" onClick={()=>setAux(x=>!x)} aria-expanded={aux}>Meu caso é outro<ArrowRight size={18}/></button>{aux&&<div className="aux-content"><p>Use “Avaliar um problema” para relatar o que precisa entender, sem escolher um serviço técnico.</p><button className="secondary-button" onClick={()=>redirect('problem')}>Ir para Avaliar um problema<ArrowRight size={18}/></button></div>}</div>}
 {id==='REG_C4'&&<p className="small-note">Não precisa enviar os documentos agora.</p>}
 {error&&<p className="field-error" role="alert">{error}</p>}
 {(id==='X1'||id.startsWith('X3'))&&<button type="button" className="text-button copy-button" onClick={copy}>{copied?'Resumo copiado':'Copiar resumo'}</button>}
 <div className="actions">{!home&&!submitted&&<button className="back-button" onClick={back}><ArrowLeft size={19}/>Voltar</button>}{submitted?(sendState==='sending'?<button className="primary-button" disabled>Enviando…</button>:<button className="primary-button" onClick={reset}>Recomeçar<ArrowRight size={22}/></button>):resultStep?<div className="intent-actions" role="group" aria-label="Como você quer continuar">{allowedIntents(answers,mode).map((intent,i)=><button key={intent} type="button" className={i===0?'primary-button':'secondary-button'} onClick={()=>chooseIntent(intent)}>{INTENT_LABEL[intent]}{i===0&&<ArrowRight size={22}/>}</button>)}</div>:<button className="primary-button" type="submit" form="question-form" disabled={!canContinue}>{id==='X4'?SUBMIT_LABEL[answers.request_intent]??'Enviar meu caso':'Continuar'}<ArrowRight size={22}/></button>}</div>
 {!canContinue&&!resultStep&&<p className="continue-hint">{home||node.type==='single'?'Selecione uma opção para continuar.':suggesting?'Confirme os projetos para avaliação.':node.type==='story'?'Escreva um relato curto ou adicione uma foto.':node.type==='program'?'Preencha quartos, suítes, banheiros, garagem, pavimentos e padrão — ou marque “Ainda não sei os ambientes”.':node.type==='contact'?(sqError?SCOPE_QUESTION_MESSAGE[sqError]:'Informe nome e um contato válido.'):node.type==='location'?'Informe cidade e UF.':['area','integer'].includes(node.type)?'Informe o valor ou marque que ainda não sabe.':'Preencha a informação indicada para continuar.'}</p>}
 </main>
 <aside className={`case-panel ${expanded?'expanded':''}`} aria-label="Resumo"><div className="case-heading"><h2>{home?'Seu caso, organizado.':project?'Seu projeto':'Seu caso'}</h2>{!home&&<button className="mobile-summary-toggle" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-controls="case-body">{expanded?'Recolher':'Expandir'}<CaretDown size={18}/></button>}</div>{home?<><p className="entry-summary-intro">Suas escolhas vão formar o escopo da sua estimativa.</p><div className="entry-promise"><ClipboardText size={38}/><div><strong>Primeiro, a estimativa.<br/>Depois, seu contato.</strong><p>Alguns casos precisam de avaliação técnica antes do valor.</p></div></div></>:<><p className="case-subtitle">{routes[answers.route]}</p><div className="case-body" id="case-body"><Summary rows={rows} onEdit={edit}/></div></>}</aside>
 </div>
 <footer className="site-footer"><ol className="progress" aria-label="Etapas">{['Seu caso','Escopo','Estimativa',...(home?[]:['Contato'])].map((label,i)=><li key={label} className={`${i===stage?'active':''} ${i<stage?'done':''}`} aria-current={i===stage?'step':undefined}><span className="step-number">{i<stage?<Check size={12}/>:i+1}</span><span>{label}</span></li>)}</ol><nav aria-label="Informações"><button onClick={()=>setModal('how')}>Como funciona</button><button onClick={()=>setModal('privacy')}>Privacidade</button></nav></footer>
 <div className="demo-bar">Estimativa inicial DEMELLO · Cálculo nesta página pela {TABLE_LABEL} · Envio só ao concluir</div>
 {modal&&<Dialog title={modal==='privacy'?'Privacidade':'Como funciona'} onClose={()=>setModal(null)}>{modal==='privacy'?<><p>As respostas e a estimativa ficam nesta página enquanto você a usa. Quando você conclui e confirma o envio, os dados do seu caso e o contato informado são enviados à DEMELLO Engenharia para análise e eventual retorno. As fotos não são enviadas. A estimativa é um valor inicial calculado nesta página — não é proposta, contrato nem garantia de preço.</p><p>Recomeçar ou atualizar a página apaga o conteúdo. O arquivo baixado é um resumo humano do caso e não inclui fotos nem dados técnicos internos.</p></>:<><p>Escolha uma das {ENTRY_COUNT_WORD} entradas e responda apenas às perguntas do seu percurso. Todas chegam ao mesmo resumo e ao mesmo resultado, e o seu contato só é pedido depois dele.</p><p>O lápis permite revisar respostas. Informações compatíveis podem ser reaproveitadas; áreas e escopos não são transferidos automaticamente entre rotas.</p><p>A estimativa é calculada nesta página pela {TABLE_LABEL}, por serviço, com um motor determinístico — nunca a IA. É uma estimativa inicial, não uma proposta; o escopo final é confirmado pela equipe.</p><p>Depois do resultado, você escolhe entre receber uma proposta ou tirar uma dúvida sobre o escopo. Só então pedimos seu contato.</p></>}</Dialog>}
 </div>;
}
