import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,CaretDown,PencilSimple,X,DownloadSimple,ClipboardText,Plus} from '@phosphor-icons/react';
import {nodes,routes,starts,keyOf,titleOf,isProject,valid,toggle,updateAnswer,switchRoute,advance,routeNodes,summary,suggestedServices,safetyHold,missingData,ufs} from './journey.mjs';
import {packageForCRMv2} from './payload_v2.mjs';
import {brlStr} from './pricing/decimal.mjs';
import {buildClientSummary,friendlyServiceName as serviceName,NEXT_STEP} from './client_summary.mjs';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';

const descriptions={build:'Projetos para uma obra nova, reforma ou ampliação.',regularize:'Diferenças de área ou pendências nos documentos.',problem:'Entender uma situação no imóvel ou na obra.',known:'Ir direto ao projeto ou serviço que preciso.'};
function Dialog({title,onClose,children}){const ref=useRef(null);useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><header><h2 id="dialog-title">{title}</h2><button onClick={onClose} className="icon-button" aria-label="Fechar"><X size={24}/></button></header>{children}</dialog>;}
function Summary({rows,onEdit}){return <dl className="summary-list">{rows.map((row,i)=><div className={`summary-row ${row.id?'':'derived'}`} key={`${row.id}-${i}`}><dt>{row.label}</dt><dd>{row.value}</dd>{row.id&&<button type="button" className="edit-button" aria-label={`Editar ${row.label}`} onClick={()=>onEdit(row.id)}><PencilSimple size={17}/></button>}</div>)}</dl>;}
const Q_PT={Q_NOVA:'área nova',Q_TOTAL:'área total',Q_ATENDIDA:'área atendida',Q_TERRENO:'área do terreno',Q_ESCOPO:'área do escopo',Q_REGULARIZACAO:'diferença de área'};
const pricingText=pv=>pv.presented_to_customer.text.replace(/Entraremos em contato para confirmar as particularidades e o escopo\./,NEXT_STEP);
function Result({answers,isPreview}){
 const held=safetyHold(answers),missing=missingData(answers);
 const pv=packageForCRMv2(answers).pricing_preview;
 const calc=pv.services.filter(s=>s.status==='CALCULATED');
 if(isPreview&&pv.status==='CALCULATED'){
  return <div className="result-card">
   <span className="eyebrow">PREVISÃO DEMELLO</span>
   <p className="investment">{brlStr(pv.total_demello)}</p>
   <p>{pricingText(pv)}</p>
   <details className="pricing-breakdown"><summary>Como chegamos a esse valor</summary>
    <ul>{calc.map(s=><li key={s.service}><strong>{serviceName(s)}</strong> · {Q_PT[s.q_basis]??s.q_basis} {s.q} m² · SECID/PR {brlStr(s.references.secid_pr.total)}{s.references.altoqi?` · AltoQi ${brlStr(s.references.altoqi.total)}`:''} · DEMELLO {brlStr(s.demello.total)}</li>)}</ul>
    <p className="small-note">Previsão inicial pela TABELA DEMELLO V1 (fator 0,80 sobre a menor referência pública aplicável, calculada offline nesta página). Não é proposta nem contrato. O escopo final é confirmado pela equipe.</p>
   </details>
  </div>;
 }
 return <div className={`result-card ${held?'needs-review':''}`}>
  {held?<><h2>Esse caso precisa de avaliação antes de uma estimativa.</h2><p>Procure a equipe DEMELLO para avaliar o caso. Esta interface não confirma a segurança do imóvel.</p></>
   :isPreview?<><h2>Ainda não dá para calcular uma previsão automática.</h2><p>{NEXT_STEP}</p></>
   :<><h2>{missing.length?'Falta confirmar:':'O escopo precisa ser confirmado antes da estimativa.'}</h2>{missing.length>0&&<ul>{missing.map(x=><li key={x}>{x}</li>)}</ul>}</>}
 </div>;}

export function App(){
 const [id,setId]=useState('HOME'),[answers,setAnswers]=useState({}),[history,setHistory]=useState([]),[modal,setModal]=useState(null),[expanded,setExpanded]=useState(false),[aux,setAux]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const mode='preview';
 const heading=useRef(null),fileInput=useRef(null),photoRef=useRef([]);
 const node=nodes[id],key=keyOf(id),value=answers[key],rows=summary(answers),home=id==='HOME',canContinue=valid(id,answers),project=isProject(answers),suggesting=id==='CA7'&&answers.services?.includes('Não sei quais preciso');
 useEffect(()=>{photoRef.current=answers.photos??[];},[answers.photos]);
 useEffect(()=>()=>photoRef.current.forEach(p=>URL.revokeObjectURL(p.url)),[]);
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});setError('');setCopied(false);},[id]);
 const release=photos=>(photos??[]).forEach(p=>URL.revokeObjectURL(p.url));
 function change(value){if(id==='HOME'&&value!==answers.route)release(answers.photos);setAnswers(a=>updateAnswer(a,id,value));if(id!=='X4')setHistory(h=>h.filter(x=>!x.startsWith('X')));setSubmitted(false);setError('');}
 function patch(values){setAnswers(a=>({...a,...values}));setSubmitted(false);setError('');}
 function next(e){e.preventDefault();if(!canContinue)return;if(id==='X4'){setSubmitted(true);return;}const result=advance(id,answers,mode);setAnswers(result.answers);setHistory(h=>result.answers.route!==answers.route?['HOME']:[...h,id]);setId(result.id);setExpanded(false);}
 function back(){if(!history.length)return;setId(history.at(-1));setHistory(h=>h.slice(0,-1));setSubmitted(false);setExpanded(false);}
 function edit(target){const path=routeNodes(answers),index=path.indexOf(target);setHistory(target==='HOME'?[]:['HOME',...path.slice(0,Math.max(0,index))]);setId(target);setSubmitted(false);setExpanded(false);}
 function reset(){release(answers.photos);setAnswers({});setId('HOME');setHistory([]);setSubmitted(false);setExpanded(false);setAux(false);setModal(null);}
 function redirect(route){release(answers.photos);setAnswers(a=>switchRoute(a,route,{redirect:id==='S1'}));setHistory(['HOME']);setId(starts[route]);setAux(false);setSubmitted(false);}
 async function addPhotos(e){
   const files=Array.from(e.target.files??[]);e.target.value='';const next=[...(answers.photos??[])];let issue='';
   for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)){issue='Use fotos JPG, PNG ou WebP.';continue;}if(file.size>8*1024*1024){issue='Cada foto pode ter até 8 MB.';continue;}if(next.length>=6){issue='Você pode adicionar até 6 fotos nesta demonstração.';break;}next.push({name:file.name,size:file.size,type:file.type,url:URL.createObjectURL(file)});}
   patch({photos:next});setError(issue);
 }
 function removePhoto(index){const photos=answers.photos??[];URL.revokeObjectURL(photos[index].url);patch({photos:photos.filter((_,i)=>i!==index)});}
 function download(){const payload=packageForCRMv2(answers);const text=buildClientSummary(payload);const url=URL.createObjectURL(new Blob([`\uFEFF${text}`],{type:'text/plain;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='demello-resumo-do-seu-caso.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function copy(){try{await navigator.clipboard.writeText(rows.map(r=>`${r.label}: ${r.value}`).join('\n'));setCopied(true);}catch{setError('Selecione o texto do resumo para copiar.');}}
 const selectCards=()=>{const multi=node.type==='multi';return <fieldset className={`choices ${home?'entry-grid':''} ${node.options.length>5&&!home?'compact':''} ${id==='S1'?'service-grid':''}`}><legend className="sr-only">{node.title}</legend>{node.options.map(option=><label className={`choice ${(multi?value?.includes(option.value):value===option.value)?'selected':''}`} key={option.value}><span>{home?<><strong>{option.label}</strong><small>{descriptions[option.value]}</small></>:option.label}</span><input type={multi?'checkbox':'radio'} name={id} checked={multi?!!value?.includes(option.value):value===option.value} onChange={()=>change(multi?toggle(value,option.value,id==='REG_C4'?'Não sei/não tenho agora':id==='CA7'?'Não sei quais preciso':undefined):option.value)}/></label>)}</fieldset>;};
 const stage=home?0:id==='X4'?3:id.startsWith('X3')?2:id==='X1'?1:1;
 return <div className={`app-shell global-v1 ${home?'is-entry':''}`}>
 <a className="skip-link" href="#question">Ir para a pergunta</a>
 <header className="site-header"><a href="/" aria-label="DEMELLO — página inicial"><img src="/assets/images/logo.png" alt="DEMELLO Engenharia"/></a><span>FAÇA SEU ORÇAMENTO</span><a className="site-link" href="/" aria-label="Voltar ao site"><span>Voltar ao site</span></a></header>
 <div className="workspace"><main className="question-panel" id="question" data-state={id}>
 {!home&&<div className="section-label"><button type="button" className="icon-button" onClick={back} aria-label="Voltar à pergunta anterior"><ArrowLeft size={18}/></button><span>{routes[answers.route]}</span></div>}
 <h1 tabIndex={-1} ref={heading}>{titleOf(id,answers)}</h1>
 {home&&<p className="helper entry-helper">Escolha o que mais se aproxima do seu caso. Não precisa saber o nome técnico.</p>}
 {node.type==='multi'&&!suggesting&&<p className="helper">Pode marcar mais de uma opção.</p>}
 {id==='P2'&&<p className="helper">Não precisa saber o nome técnico. Explique do seu jeito ou envie uma foto.</p>}
 {id==='X1'&&<p className="helper">Confira as informações. Você pode editar qualquer resposta.</p>}
 <form id="question-form" onSubmit={next} noValidate>
 {['entry','single','multi'].includes(node.type)&&!suggesting&&selectCards()}
 {id==='S1'&&value?.includes('Outro')&&<label className="text-field contextual-field">Qual serviço?<input maxLength={180} placeholder="Nome do serviço que você procura" value={answers.otherService??''} onChange={e=>patch({otherService:e.target.value})}/><span className="small-note">Regularização e avaliação técnica seguem para suas rotas, com os dados compatíveis preservados.</span></label>}
 {id==='S1'&&<div className="route-shortcuts"><span>É outro tipo de atendimento?</span><button type="button" className="text-button" onClick={()=>redirect('regularize')}>Regularização</button><button type="button" className="text-button" onClick={()=>redirect('problem')}>Avaliação técnica</button></div>}
 {suggesting&&<section className="suggestions" aria-labelledby="suggestions-title"><h2 id="suggestions-title">Projetos que fazem sentido avaliar</h2><p>Sugestão ilustrativa com base no tipo de empreendimento e nos pavimentos informados. Ajuste e confirme; não é uma definição técnica do escopo.</p><fieldset className="choices"><legend className="sr-only">Ajustar projetos sugeridos</legend>{nodes.CA7.options.filter(o=>o.value!=='Não sei quais preciso').map(o=><label className={`choice ${(answers.confirmedSuggestions??suggestedServices(answers)).includes(o.value)?'selected':''}`} key={o.value}><span>{o.label}</span><input type="checkbox" checked={(answers.confirmedSuggestions??suggestedServices(answers)).includes(o.value)} onChange={()=>patch({confirmedSuggestions:toggle(answers.confirmedSuggestions??suggestedServices(answers),o.value),suggestionConfirmed:false})}/></label>)}</fieldset><button type="button" className="secondary-button" disabled={!(answers.confirmedSuggestions??suggestedServices(answers)).length} onClick={()=>patch({confirmedSuggestions:answers.confirmedSuggestions??suggestedServices(answers),suggestionConfirmed:true})}>{answers.suggestionConfirmed?<><Check size={18}/>Seleção confirmada</>:'Confirmar projetos para avaliação'}</button><button type="button" className="text-button" onClick={()=>change([])}>Voltar à seleção de projetos</button></section>}
 {node.type==='location'&&<div className="location-fields"><label>Cidade<input autoComplete="address-level2" maxLength={90} value={value?.city??''} onChange={e=>change({...value,city:e.target.value})}/></label><label>UF<select autoComplete="address-level1" value={value?.uf??''} onChange={e=>change({...value,uf:e.target.value})}><option value="">Selecione</option>{ufs.map(uf=><option key={uf}>{uf}</option>)}</select></label></div>}
 {['area','integer'].includes(node.type)&&<div className="area-fields"><label htmlFor="measure">{node.type==='integer'?'Número de pavimentos':(node.label??'Área informada')}</label><div className="measure"><input id="measure" inputMode={node.type==='integer'?'numeric':'decimal'} maxLength={node.type==='integer'?3:14} placeholder={node.type==='integer'?'Ex.: 2':'0,00'} disabled={value?.unknown??false} value={value?.value??''} onChange={e=>change({value:e.target.value,unknown:false})}/>{node.type==='area'&&<span>m²</span>}</div><label className="unknown"><input type="checkbox" checked={value?.unknown??false} onChange={e=>change({value:'',unknown:e.target.checked})}/>{id.startsWith('REG_')?'Não sei':'Ainda não sei'}</label>{value?.value&&!canContinue&&<p className="field-error">{node.type==='integer'?'Informe um número inteiro entre 1 e 200.':'Use um valor maior que zero, sem separador de milhar, com até duas casas decimais.'}</p>}</div>}
 {['text','story'].includes(node.type)&&<><label className="text-field" htmlFor="story">{node.type==='story'?'Seu relato':'O que está acontecendo?'}</label><textarea id="story" rows={3} maxLength={node.type==='story'?600:280} placeholder={node.type==='story'?'Conte em poucas palavras...':'Uma frase é suficiente.'} value={value??''} onChange={e=>change(e.target.value)}/><div className="character-count">{value?.length??0}/{node.type==='story'?600:280}</div></>}
 {id==='P2'&&<div className="photos"><input className="sr-only" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Selecionar fotos opcionais" onChange={addPhotos}/><button type="button" className="secondary-button" onClick={()=>fileInput.current?.click()}><Plus size={20}/>Adicionar fotos</button><p className="small-note">Opcional · Até 6 fotos JPG, PNG ou WebP, de até 8 MB cada. As imagens ficam apenas nesta página, sem envio ou análise automática.</p>{!!answers.photos?.length&&<ul className="photo-list">{answers.photos.map((p,i)=><li key={p.url}><img src={p.url} alt={`Foto anexada: ${p.name}`}/><span>{p.name}</span><button type="button" className="icon-button" aria-label={`Remover foto ${i+1}`} onClick={()=>removePhoto(i)}><X size={18}/></button></li>)}</ul>}<p className="examples">Exemplos: “Apareceu uma rachadura depois da reforma.” · “Quero tirar uma parede.” · “Tem água aparecendo no teto.” · “Quero avaliar o imóvel antes de comprar.”</p></div>}
 {id==='X1'&&<div className="review-summary"><Summary rows={rows} onEdit={edit}/></div>}
 {(id==='X3A'||id==='X3B')&&<Result answers={answers} isPreview={id==='X3A'}/>}
 {id==='X4'&&!submitted&&<><p className="helper">Seu nome e pelo menos um meio de contato.</p><div className="contact-fields">{[['name','Nome','text'],['whatsapp','WhatsApp','tel'],['email','E-mail','email']].map(([field,label,type])=><label key={field}>{label}<input type={type} autoComplete={field==='whatsapp'?'tel':field} maxLength={field==='whatsapp'?24:160} value={value?.[field]??''} onChange={e=>change({...value,[field]:e.target.value})}/></label>)}</div><p className="small-note">Esses dados permanecem somente nesta página e no arquivo que você decidir baixar. Nada é enviado automaticamente.</p></>}
 {id==='X4'&&submitted&&<div className="result-card success" role="status"><Check size={36}/><h2>Seu caso foi organizado.</h2><p>Nada foi enviado. Baixe um resumo legível para consultar ou compartilhar por sua escolha; fotos não são incluídas.</p><p>{NEXT_STEP}</p><button type="button" className="secondary-button" onClick={download}><DownloadSimple size={20}/>Baixar resumo do seu caso</button></div>}
 </form>
 {home&&<div className="auxiliary"><button type="button" className="text-button" onClick={()=>setAux(x=>!x)} aria-expanded={aux}>Meu caso é outro<ArrowRight size={18}/></button>{aux&&<div className="aux-content"><p>Use “Avaliar um problema” para relatar o que precisa entender, sem escolher um serviço técnico.</p><button className="secondary-button" onClick={()=>redirect('problem')}>Ir para Avaliar um problema<ArrowRight size={18}/></button></div>}</div>}
 {id==='REG_C4'&&<p className="small-note">Não precisa enviar os documentos agora.</p>}
 {error&&<p className="field-error" role="alert">{error}</p>}
 {(id==='X1'||id.startsWith('X3'))&&<button type="button" className="text-button copy-button" onClick={copy}>{copied?'Resumo copiado':'Copiar resumo'}</button>}
 <div className="actions">{!home&&<button className="back-button" onClick={back}><ArrowLeft size={19}/>Voltar</button>}{submitted?<button className="primary-button" onClick={reset}>Recomeçar<ArrowRight size={22}/></button>:<button className="primary-button" type="submit" form="question-form" disabled={!canContinue}>{id==='X4'?'Preparar resumo':'Continuar'}<ArrowRight size={22}/></button>}</div>
 {!canContinue&&<p className="continue-hint">{home||node.type==='single'?'Selecione uma opção para continuar.':suggesting?'Confirme os projetos para avaliação.':node.type==='story'?'Escreva um relato curto ou adicione uma foto.':node.type==='contact'?'Informe nome e um contato válido.':node.type==='location'?'Informe cidade e UF.':['area','integer'].includes(node.type)?'Informe o valor ou marque que ainda não sabe.':'Preencha a informação indicada para continuar.'}</p>}
 </main>
 <aside className={`case-panel ${expanded?'expanded':''}`} aria-label="Resumo"><div className="case-heading"><h2>{home?'Seu caso, organizado.':project?'Seu projeto':'Seu caso'}</h2>{!home&&<button className="mobile-summary-toggle" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-controls="case-body">{expanded?'Recolher':'Expandir'}<CaretDown size={18}/></button>}</div>{home?<><p className="entry-summary-intro">Suas escolhas vão formar o escopo da sua prévia.</p><div className="entry-promise"><ClipboardText size={38}/><div><strong>Primeiro, a prévia.<br/>Depois, seu contato.</strong><p>Alguns casos precisam de avaliação técnica antes do valor.</p></div></div></>:<><p className="case-subtitle">{routes[answers.route]}</p><div className="case-body" id="case-body"><Summary rows={rows} onEdit={edit}/></div></>}</aside>
 </div>
 <footer className="site-footer"><ol className="progress" aria-label="Etapas">{['Seu caso','Escopo','Prévia',...(home?[]:['Contato'])].map((label,i)=><li key={label} className={`${i===stage?'active':''} ${i<stage?'done':''}`} aria-current={i===stage?'step':undefined}><span className="step-number">{i<stage?<Check size={12}/>:i+1}</span><span>{label}</span></li>)}</ol><nav aria-label="Informações"><button onClick={()=>setModal('how')}>Como funciona</button><button onClick={()=>setModal('privacy')}>Privacidade</button></nav></footer>
 <div className="demo-bar">Previsão inicial DEMELLO · Cálculo offline pela TABELA V1 · Sem envio de dados</div>
 {modal&&<Dialog title={modal==='privacy'?'Privacidade':'Como funciona'} onClose={()=>setModal(null)}>{modal==='privacy'?<><p>Respostas e fotos ficam somente na memória desta página. Não há envio para servidor, IA, WhatsApp, e-mail ou CRM.</p><p>Recomeçar ou atualizar a página apaga o conteúdo. O arquivo baixado é um resumo humano do caso e não inclui fotos nem dados técnicos internos.</p></>:<><p>Escolha uma das quatro entradas e responda apenas às perguntas do seu percurso. Todas chegam ao mesmo resumo, resultado e contato.</p><p>O lápis permite revisar respostas. Informações compatíveis podem ser reaproveitadas; áreas e escopos não são transferidos automaticamente entre rotas.</p><p>A previsão é calculada nesta página pela TABELA DEMELLO V1, por serviço, com um motor determinístico — nunca a IA. É uma previsão inicial, não uma proposta; o escopo final é confirmado pela equipe.</p></>}</Dialog>}
 </div>;
}
